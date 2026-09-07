// /js/configService.js
// Two distinct concepts, deliberately kept separate:
//
//  - LIVE config: fetched from a static JSON file shipped with the
//    deployment (same for every visitor of this site — that's the whole
//    point). This is what the entry form, validator, and viewer use.
//    Cached locally as a fallback for offline resilience.
//
//  - DRAFT config: a local design workspace used only inside the
//    PIN-protected admin editor. Editing the draft NEVER changes what
//    other users see. To actually publish a new form, the curator exports
//    the draft as JSON and replaces the file in the repository
//    (git push -> Vercel redeploys -> every visitor gets the new schema).
//
// Config shape: { version, groups: [{id,label}], fields: [{id,label,type,required,options,color,group}] }
//
// --- Modules -----------------------------------------------------------
// The app can host more than one independent module (e.g. "Inventarna
// knjiga" and "Dokumentacija o enoti"), each with its own schema, its own
// config.json-equivalent file, and its own IndexedDB storage (handled by
// db.js). createConfigService(moduleId, options) builds one self-contained
// service instance per module — same logic, isolated caches. Module 1
// ("inventarna") keeps its original CONFIG_URL and DEFAULT_CONFIG so
// nothing changes for existing installations.

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';

const DEFAULT_CONFIG_INVENTARNA = {
  version: 1,
  groups: [
    { id: 'group_basic', label: 'Osnovni podatki' },
    { id: 'group_physical', label: 'Fizične lastnosti' },
    { id: 'group_status', label: 'Stanje in lokacija' },
    { id: 'group_media', label: 'Dokumentacija' },
  ],
  fields: [
    { id: 'inventory_number', label: 'Inventarna številka', type: 'text', required: true, options: [], color: Utils.DEFAULT_FIELD_COLOR, group: 'group_basic' },
    { id: 'title', label: 'Naziv predmeta', type: 'text', required: true, options: [], color: Utils.DEFAULT_FIELD_COLOR, group: 'group_basic' },
    { id: 'period', label: 'Obdobje', type: 'text', required: false, options: [], color: Utils.DEFAULT_FIELD_COLOR, group: 'group_basic' },
    { id: 'material', label: 'Material', type: 'text', required: false, options: [], color: '#6F7D5C', group: 'group_physical', placeholder: '' },
    {
      id: 'measurements',
      label: 'Mere',
      type: 'measurements',
      required: false,
      options: [],
      color: '#6F7D5C',
      group: 'group_physical',
      measurementTypes: [
        { id: 'visina', label: 'Višina', units: ['cm', 'mm', 'm'] },
        { id: 'sirina', label: 'Širina', units: ['cm', 'mm', 'm'] },
        { id: 'dolzina', label: 'Dolžina', units: ['cm', 'mm', 'm'] },
        { id: 'globina', label: 'Globina', units: ['cm', 'mm', 'm'] },
        { id: 'premer', label: 'Premer', units: ['cm', 'mm', 'm'] },
        { id: 'obseg', label: 'Obseg', units: ['cm', 'mm', 'm'] },
        { id: 'teza', label: 'Teža', units: ['g', 'kg'] },
      ],
    },
    { id: 'condition', label: 'Stanje ohranjenosti', type: 'select', required: true, options: ['Odlično', 'Dobro', 'Zmerno', 'Slabo', 'Za restavracijo'], color: '#A63A2E', group: 'group_status' },
    { id: 'location', label: 'Lokacija', type: 'text', required: false, options: [], color: '#A63A2E', group: 'group_status' },
    { id: 'photo', label: 'Fotografija', type: 'image', required: false, options: [], color: Utils.DEFAULT_FIELD_COLOR, group: 'group_media' },
  ],
};

// Minimal built-in fallback for the "Dokumentacija o enoti" module, used
// only if config-dokumentacija.json can't be fetched AND there is no local
// cache yet (e.g. very first load, offline). Real content ships via
// config-dokumentacija.json, filled in progressively.
const DEFAULT_CONFIG_DOKUMENTACIJA = {
  version: 1,
  groups: [{ id: 'group_identifikacija', label: 'Identifikacija' }],
  fields: [
    {
      id: 'identifikacijska_stevilka',
      label: 'Identifikacijska številka dokumentirane enote',
      type: 'text',
      required: true,
      options: [],
      color: Utils.DEFAULT_FIELD_COLOR,
      group: 'group_identifikacija',
    },
    {
      id: 'dokumentirana_enota',
      label: 'Dokumentirana enota dediščine',
      type: 'reference',
      required: false,
      options: [],
      color: Utils.DEFAULT_FIELD_COLOR,
      group: 'group_identifikacija',
      targetModule: 'inventarna',
      multiple: true,
      tooltip: 'Poišči po inventarni številki ali kateri koli drugi številčni označbi predmeta.',
    },
  ],
};

// Sub-field types allowed inside a "group" field. No nesting (no "group" or
// "measurements" as a sub-field type) and no repeatable-file sprawl beyond
// what a group item already provides.
const GROUP_SUBFIELD_TYPES = ['text', 'number', 'date', 'select', 'image', 'document', 'link'];

function normalizeConfig(config) {
  const groups = Array.isArray(config.groups)
    ? config.groups.map((g) => ({ ...g, sections: Array.isArray(g.sections) ? g.sections : [] }))
    : [];
  const groupIds = new Set(groups.map((g) => g.id));
  const sectionsByGroup = new Map(groups.map((g) => [g.id, new Set(g.sections.map((s) => s.id))]));
  const fields = (config.fields || []).map((f) => {
    const group = f.group && groupIds.has(f.group) ? f.group : null;
    const validSections = group ? sectionsByGroup.get(group) : null;
    const section = group && f.section && validSections && validSections.has(f.section) ? f.section : null;
    return { ...f, group, section };
  });
  return { ...config, groups, fields };
}

// For the "group" field type (repeatable composite, e.g. "Fotografije" made
// of slika + avtor + datacija + lastništvo, or "Napisi" made of napis +
// lokacija): the curator defines the sub-fields once; each entry can then
// add as many items as it needs, each with its own values for those
// sub-fields.
function normalizeSubFields(subFields) {
  if (!Array.isArray(subFields)) return [];
  return subFields
    .filter((sf) => sf && sf.label && GROUP_SUBFIELD_TYPES.includes(sf.type))
    .map((sf) => ({
      id: sf.id || Utils.slugify(sf.label) + '_' + Date.now().toString(36).slice(-4),
      label: String(sf.label),
      type: sf.type,
      required: Boolean(sf.required),
      options: Array.isArray(sf.options) ? sf.options.filter(Boolean).map(String) : [],
      tooltip: sf.tooltip ? String(sf.tooltip) : '',
    }));
}

// For the "measurements" field type (CDWA Type/Value/Unit pattern): the
// curator defines which measurement types are allowed (e.g. height, weight)
// and which units apply to each, so users pick from a controlled list
// rather than typing free text.
function normalizeMeasurementTypes(types) {
  if (!Array.isArray(types)) return [];
  return types
    .filter((t) => t && t.label)
    .map((t) => ({
      id: t.id || t.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      label: String(t.label),
      units: Array.isArray(t.units) ? t.units.filter(Boolean).map(String) : [],
    }));
}

// Builds one self-contained config service for a given module. Each
// instance has its own in-memory caches — modules never share state.
function createConfigService(moduleId, { configUrl, defaultConfig }) {
  let cachedLiveConfig = null;
  let cachedDraftConfig = null;

  // -------------------------------------------------------------------
  // LIVE config — what the entry form actually uses
  // -------------------------------------------------------------------

  async function fetchLiveConfigFromServer() {
    const response = await fetch(configUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Strežnik je pri nalaganju ${configUrl} vrnil napako ${response.status}.`);
    }
    const json = await response.json();
    return normalizeConfig(json);
  }

  async function getLiveConfig() {
    if (cachedLiveConfig) return Utils.deepClone(cachedLiveConfig);

    try {
      const fromServer = await fetchLiveConfigFromServer();
      cachedLiveConfig = fromServer;
      DB.saveLiveConfigCache(fromServer, moduleId).catch((err) => {
        console.error(`[ConfigService:${moduleId}] Failed to cache live config locally`, err);
      });
      return Utils.deepClone(fromServer);
    } catch (err) {
      console.warn(`[ConfigService:${moduleId}] Could not fetch ${configUrl}, trying local cache`, err);
    }

    try {
      const cached = await DB.getLiveConfigCache(moduleId);
      if (cached) {
        cachedLiveConfig = normalizeConfig(cached);
        EventBus.emit('ui:notify', {
          type: 'info',
          message: 'Obrazec je naložen iz lokalne varnostne kopije (brez povezave do strežnika).',
        });
        return Utils.deepClone(cachedLiveConfig);
      }
    } catch (err) {
      console.error(`[ConfigService:${moduleId}] Failed to read local config cache`, err);
    }

    cachedLiveConfig = normalizeConfig(Utils.deepClone(defaultConfig));
    EventBus.emit('ui:notify', {
      type: 'info',
      message: `Uporabljena je vgrajena privzeta shema (${configUrl} ni bilo mogoče naložiti).`,
    });
    return Utils.deepClone(cachedLiveConfig);
  }

  // -------------------------------------------------------------------
  // DRAFT config — the curator's local design workspace (admin editor only)
  // -------------------------------------------------------------------

  async function getDraftConfig() {
    if (cachedDraftConfig) return Utils.deepClone(cachedDraftConfig);

    let draft;
    try {
      draft = await DB.getDraftConfig(moduleId);
    } catch (err) {
      console.error(`[ConfigService:${moduleId}] Failed to load draft config`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Osnutka sheme ni bilo mogoče naložiti.' });
      throw err;
    }

    if (!draft) {
      // First time opening the editor — start the draft from whatever is
      // currently live, rather than from an empty form.
      draft = await getLiveConfig();
    }

    draft = normalizeConfig(draft);
    cachedDraftConfig = draft;
    return Utils.deepClone(draft);
  }

  async function saveDraft(newDraft) {
    if (!newDraft || !Array.isArray(newDraft.fields)) {
      const err = new Error('saveDraft: neveljavna konfiguracija (manjka fields[])');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Napaka pri posodabljanju osnutka.' });
      throw err;
    }

    const current = await getDraftConfig();
    const normalized = normalizeConfig({
      ...Utils.deepClone(newDraft),
      version: (current.version || 0) + 1,
    });

    try {
      await DB.saveDraftConfig(normalized, moduleId);
    } catch (err) {
      console.error(`[ConfigService:${moduleId}] Failed to save draft config`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Osnutka ni bilo mogoče shraniti.' });
      throw err;
    }

    cachedDraftConfig = normalized;
    EventBus.emit('draft:updated', { moduleId, config: Utils.deepClone(normalized) });
    return Utils.deepClone(normalized);
  }

  async function resetDraftToLive() {
    const live = await getLiveConfig();
    return saveDraft(live);
  }

  // Properties preserved on every field, regardless of type — keep this
  // list in sync whenever a new per-field setting is added anywhere in the
  // app (admin editor, formBuilder, viewer), or it will silently vanish
  // the next time the field is saved through the editor.
  function normalizeFieldPayload(id, input, existing) {
    return {
      id,
      label: input.label,
      type: input.type,
      required: Boolean(input.required),
      options: Array.isArray(input.options) ? input.options : [],
      color: input.color || (existing && existing.color) || Utils.DEFAULT_FIELD_COLOR,
      group: input.group,
      section: input.section,
      placeholder: input.placeholder ? String(input.placeholder) : '',
      tooltip: input.tooltip ? String(input.tooltip) : '',
      measurementTypes: normalizeMeasurementTypes(input.measurementTypes),
      subFields: normalizeSubFields(input.subFields),
      repeatable: input.type === 'group' ? input.repeatable !== false : undefined,
      fixedPrecision: input.type === 'date' && input.fixedPrecision ? input.fixedPrecision : null,
      backgroundHighlight: Boolean(input.backgroundHighlight),
      autoExpand: input.type === 'text' ? Boolean(input.autoExpand) : false,
      // "reference" field type: links to one or more entries in another
      // module (e.g. Dokumentacija -> Inventarna knjiga).
      targetModule: input.type === 'reference' ? input.targetModule || null : undefined,
      multiple: input.type === 'reference' ? input.multiple !== false : undefined,
    };
  }

  async function addField(field) {
    if (!field || !field.id || !field.label || !field.type) {
      const err = new Error('addField: polje potrebuje id, label in type');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Polja ni bilo mogoče dodati.' });
      throw err;
    }

    const current = await getDraftConfig();
    if (current.fields.some((f) => f.id === field.id)) {
      const err = new Error(`addField: polje z id "${field.id}" že obstaja`);
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Polje s tem imenom že obstaja.' });
      throw err;
    }

    const groupId = field.group && current.groups.some((g) => g.id === field.group) ? field.group : null;
    const groupDef = groupId ? current.groups.find((g) => g.id === groupId) : null;
    const sectionId = field.section && groupDef && groupDef.sections.some((s) => s.id === field.section) ? field.section : null;

    const normalized = normalizeFieldPayload(field.id, { ...field, group: groupId, section: sectionId }, null);

    return saveDraft({ ...current, fields: [...current.fields, normalized] });
  }

  async function moveField(fieldId, direction) {
    const current = await getDraftConfig();
    const field = current.fields.find((f) => f.id === fieldId);
    if (!field) return current;

    // Reorder relative to siblings in the same group only — moving a field
    // shouldn't jump it into an unrelated group's position in the array.
    const siblingIds = current.fields.filter((f) => f.group === field.group).map((f) => f.id);
    const idx = siblingIds.indexOf(fieldId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblingIds.length) return current; // already at the edge — no-op

    const swapId = siblingIds[swapIdx];
    const fields = [...current.fields];
    const i1 = fields.findIndex((f) => f.id === fieldId);
    const i2 = fields.findIndex((f) => f.id === swapId);
    [fields[i1], fields[i2]] = [fields[i2], fields[i1]];

    return saveDraft({ ...current, fields });
  }

  async function updateField(fieldId, updates) {
    const current = await getDraftConfig();
    const existing = current.fields.find((f) => f.id === fieldId);

    if (!existing) {
      const err = new Error(`updateField: polje z id "${fieldId}" ne obstaja`);
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Polja ni bilo mogoče najti.' });
      throw err;
    }

    if (!updates || !updates.label || !updates.type) {
      const err = new Error('updateField: label in type sta obvezna');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Ime in tip polja sta obvezna.' });
      throw err;
    }

    const groupId = updates.group && current.groups.some((g) => g.id === updates.group) ? updates.group : null;
    const groupDef = groupId ? current.groups.find((g) => g.id === groupId) : null;
    const sectionId = updates.section && groupDef && groupDef.sections.some((s) => s.id === updates.section) ? updates.section : null;

    const merged = normalizeFieldPayload(fieldId, { ...updates, group: groupId, section: sectionId }, existing);

    return saveDraft({ ...current, fields: current.fields.map((f) => (f.id === fieldId ? merged : f)) });
  }

  async function removeField(fieldId) {
    const current = await getDraftConfig();
    return saveDraft({ ...current, fields: current.fields.filter((f) => f.id !== fieldId) });
  }

  async function addGroup(group) {
    if (!group || !group.label || !group.label.trim()) {
      const err = new Error('addGroup: skupina potrebuje label');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Skupine ni bilo mogoče dodati.' });
      throw err;
    }

    const current = await getDraftConfig();
    const id = group.id || Utils.slugify(group.label) + '_' + Date.now().toString(36).slice(-4);

    if (current.groups.some((g) => g.id === id)) {
      const err = new Error(`addGroup: skupina z id "${id}" že obstaja`);
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Skupina s tem imenom že obstaja.' });
      throw err;
    }

    return saveDraft({ ...current, groups: [...current.groups, { id, label: group.label.trim() }] });
  }

  async function removeGroup(groupId) {
    const current = await getDraftConfig();
    return saveDraft({
      ...current,
      groups: current.groups.filter((g) => g.id !== groupId),
      fields: current.fields.map((f) => (f.group === groupId ? { ...f, group: null } : f)),
    });
  }

  async function renameGroup(groupId, newLabel) {
    if (!newLabel || !newLabel.trim()) {
      const err = new Error('renameGroup: newLabel je obvezen');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Ime skupine ne more biti prazno.' });
      throw err;
    }
    const current = await getDraftConfig();
    return saveDraft({
      ...current,
      groups: current.groups.map((g) => (g.id === groupId ? { ...g, label: newLabel.trim() } : g)),
    });
  }

  async function moveGroup(groupId, direction) {
    const current = await getDraftConfig();
    const idx = current.groups.findIndex((g) => g.id === groupId);
    if (idx === -1) return current;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= current.groups.length) return current;
    const groups = [...current.groups];
    [groups[idx], groups[swapIdx]] = [groups[swapIdx], groups[idx]];
    return saveDraft({ ...current, groups });
  }

  // -------------------------------------------------------------------
  // Sections ("razdelki") — a second level of organization WITHIN one
  // group/tab, used to visually cluster related fields. Scoped per-group.
  // -------------------------------------------------------------------

  async function addSection(groupId, label) {
    if (!label || !label.trim()) {
      const err = new Error('addSection: label je obvezen');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Razdelka ni bilo mogoče dodati.' });
      throw err;
    }
    const current = await getDraftConfig();
    const groupDef = current.groups.find((g) => g.id === groupId);
    if (!groupDef) {
      const err = new Error(`addSection: skupina "${groupId}" ne obstaja`);
      console.error(`[ConfigService:${moduleId}]`, err);
      throw err;
    }
    const id = Utils.slugify(label) + '_' + Date.now().toString(36).slice(-4);
    const groups = current.groups.map((g) => (g.id === groupId ? { ...g, sections: [...g.sections, { id, label: label.trim() }] } : g));
    return saveDraft({ ...current, groups });
  }

  async function removeSection(groupId, sectionId) {
    const current = await getDraftConfig();
    const groups = current.groups.map((g) =>
      g.id === groupId ? { ...g, sections: g.sections.filter((s) => s.id !== sectionId) } : g
    );
    // Fields pointing at the removed section fall back to "unsectioned" —
    // normalizeConfig (called inside saveDraft) already clears any field.section
    // that no longer resolves to a valid section on its group.
    return saveDraft({ ...current, groups });
  }

  async function renameSection(groupId, sectionId, newLabel) {
    if (!newLabel || !newLabel.trim()) {
      const err = new Error('renameSection: newLabel je obvezen');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Ime razdelka ne more biti prazno.' });
      throw err;
    }
    const current = await getDraftConfig();
    const groups = current.groups.map((g) =>
      g.id === groupId
        ? { ...g, sections: g.sections.map((s) => (s.id === sectionId ? { ...s, label: newLabel.trim() } : s)) }
        : g
    );
    return saveDraft({ ...current, groups });
  }

  async function moveSection(groupId, sectionId, direction) {
    const current = await getDraftConfig();
    const groupDef = current.groups.find((g) => g.id === groupId);
    if (!groupDef) return current;
    const idx = groupDef.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return current;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= groupDef.sections.length) return current;
    const sections = [...groupDef.sections];
    [sections[idx], sections[swapIdx]] = [sections[swapIdx], sections[idx]];
    const groups = current.groups.map((g) => (g.id === groupId ? { ...g, sections } : g));
    return saveDraft({ ...current, groups });
  }

  // Loads an arbitrary schema JSON (uploaded file, or a bundled template) into
  // the draft workspace — the curator can then keep refining it with the
  // normal field/group editor before publishing. Overwrites the current
  // draft; does not touch the live/published schema.
  async function importDraftFromObject(rawConfig) {
    if (!rawConfig || !Array.isArray(rawConfig.fields)) {
      const err = new Error('Neveljavna datoteka sheme (manjka seznam polj).');
      console.error(`[ConfigService:${moduleId}]`, err);
      EventBus.emit('ui:notify', { type: 'error', message: err.message });
      throw err;
    }
    const normalized = normalizeConfig({
      version: rawConfig.version || 1,
      groups: Array.isArray(rawConfig.groups) ? rawConfig.groups : [],
      fields: rawConfig.fields,
    });
    return saveDraft(normalized);
  }

  async function loadTemplate(templateUrl) {
    let response;
    try {
      response = await fetch(templateUrl, { cache: 'no-store' });
    } catch (err) {
      console.error(`[ConfigService:${moduleId}] Failed to fetch template`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Predloge ni bilo mogoče naložiti.' });
      throw err;
    }
    if (!response.ok) {
      const err = new Error(`Predloga ni na voljo (${response.status}).`);
      EventBus.emit('ui:notify', { type: 'error', message: err.message });
      throw err;
    }
    const json = await response.json();
    return importDraftFromObject(json);
  }

  function exportDraftFile() {
    return getDraftConfig().then((draft) => {
      const publishable = { version: draft.version, groups: draft.groups, fields: draft.fields };
      const blob = new Blob([JSON.stringify(publishable, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = configUrl.replace(/^.*\//, '');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      EventBus.emit('ui:notify', {
        type: 'success',
        message: `Shema izvožena kot ${a.download} — zamenjaj datoteko v repozitoriju in objavi (git push).`,
      });
    });
  }

  return {
    moduleId,
    getLiveConfig,
    getDraftConfig,
    saveDraft,
    resetDraftToLive,
    addField,
    updateField,
    removeField,
    moveField,
    addGroup,
    removeGroup,
    renameGroup,
    moveGroup,
    addSection,
    removeSection,
    renameSection,
    moveSection,
    exportDraftFile,
    importDraftFromObject,
    loadTemplate,
    DEFAULT_CONFIG: defaultConfig,
    GROUP_SUBFIELD_TYPES,
  };
}

// Module registry — one instance per module, built once and reused
// everywhere. Module 1 keeps the exact original CONFIG_URL/DEFAULT_CONFIG.
const ConfigServiceInventarna = createConfigService('inventarna', {
  configUrl: './config.json',
  defaultConfig: DEFAULT_CONFIG_INVENTARNA,
});
const ConfigServiceDokumentacija = createConfigService('dokumentacija', {
  configUrl: './config-dokumentacija.json',
  defaultConfig: DEFAULT_CONFIG_DOKUMENTACIJA,
});

const CONFIG_SERVICES = {
  inventarna: ConfigServiceInventarna,
  dokumentacija: ConfigServiceDokumentacija,
};

function getConfigService(moduleId) {
  return CONFIG_SERVICES[moduleId] || ConfigServiceInventarna;
}

// Default export stays fully backward-compatible: existing code that does
// `import ConfigService from './configService.js'` and calls
// `ConfigService.getLiveConfig()` etc. keeps talking to module 1
// (Inventarna knjiga) exactly as before. New, module-aware code should use
// `getConfigService(moduleId)` instead.
const ConfigService = { ...ConfigServiceInventarna, createConfigService, getConfigService, CONFIG_SERVICES };

export default ConfigService;
export { createConfigService, getConfigService };
