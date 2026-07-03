// /js/configService.js
// Two distinct concepts, deliberately kept separate:
//
//  - LIVE config: fetched from the static /config.json shipped with the
//    deployment (same for every visitor of this site — that's the whole
//    point). This is what the entry form, validator, and viewer use.
//    Cached locally as a fallback for offline resilience.
//
//  - DRAFT config: a local design workspace used only inside the
//    PIN-protected admin editor. Editing the draft NEVER changes what
//    other users see. To actually publish a new form, the curator exports
//    the draft as config.json and replaces the file in the repository
//    (git push -> Vercel redeploys -> every visitor gets the new schema).
//
// Config shape: { version, groups: [{id,label}], fields: [{id,label,type,required,options,color,group}] }

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';

const CONFIG_URL = './config.json';

const DEFAULT_CONFIG = {
  version: 1,
  groups: [
    { id: 'group_basic', label: 'Osnovni podatki' },
    { id: 'group_physical', label: 'Fizične lastnosti' },
    { id: 'group_status', label: 'Stanje in lokacija' },
    { id: 'group_media', label: 'Dokumentacija' },
  ],
  fields: [
    { id: 'inventory_number', label: 'Inventarna številka', type: 'text', required: true, options: [], color: '#A65A3A', group: 'group_basic' },
    { id: 'title', label: 'Naziv predmeta', type: 'text', required: true, options: [], color: '#A65A3A', group: 'group_basic' },
    { id: 'period', label: 'Obdobje', type: 'text', required: false, options: [], color: '#A65A3A', group: 'group_basic' },
    { id: 'material', label: 'Material', type: 'text', required: false, options: [], color: '#6F7D5C', group: 'group_physical' },
    { id: 'dimensions', label: 'Mere', type: 'text', required: false, options: [], color: '#6F7D5C', group: 'group_physical' },
    { id: 'condition', label: 'Stanje ohranjenosti', type: 'select', required: true, options: ['Odlično', 'Dobro', 'Zmerno', 'Slabo', 'Za restavracijo'], color: '#A63A2E', group: 'group_status' },
    { id: 'location', label: 'Lokacija', type: 'text', required: false, options: [], color: '#A63A2E', group: 'group_status' },
    { id: 'photo', label: 'Fotografija', type: 'image', required: false, options: [], color: '#A65A3A', group: 'group_media' },
  ],
};

let cachedLiveConfig = null;
let cachedDraftConfig = null;

function normalizeConfig(config) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const groupIds = new Set(groups.map((g) => g.id));
  const fields = (config.fields || []).map((f) => ({
    ...f,
    group: f.group && groupIds.has(f.group) ? f.group : null,
  }));
  return { ...config, groups, fields };
}

// ---------------------------------------------------------------------
// LIVE config — what the entry form actually uses
// ---------------------------------------------------------------------

async function fetchLiveConfigFromServer() {
  const response = await fetch(CONFIG_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Strežnik je pri nalaganju config.json vrnil napako ${response.status}.`);
  }
  const json = await response.json();
  return normalizeConfig(json);
}

async function getLiveConfig() {
  if (cachedLiveConfig) return Utils.deepClone(cachedLiveConfig);

  try {
    const fromServer = await fetchLiveConfigFromServer();
    cachedLiveConfig = fromServer;
    DB.saveLiveConfigCache(fromServer).catch((err) => {
      console.error('[ConfigService] Failed to cache live config locally', err);
    });
    return Utils.deepClone(fromServer);
  } catch (err) {
    console.warn('[ConfigService] Could not fetch config.json, trying local cache', err);
  }

  try {
    const cached = await DB.getLiveConfigCache();
    if (cached) {
      cachedLiveConfig = normalizeConfig(cached);
      EventBus.emit('ui:notify', {
        type: 'info',
        message: 'Obrazec je naložen iz lokalne varnostne kopije (brez povezave do strežnika).',
      });
      return Utils.deepClone(cachedLiveConfig);
    }
  } catch (err) {
    console.error('[ConfigService] Failed to read local config cache', err);
  }

  cachedLiveConfig = normalizeConfig(Utils.deepClone(DEFAULT_CONFIG));
  EventBus.emit('ui:notify', {
    type: 'info',
    message: 'Uporabljena je vgrajena privzeta shema (config.json ni bilo mogoče naložiti).',
  });
  return Utils.deepClone(cachedLiveConfig);
}

// ---------------------------------------------------------------------
// DRAFT config — the curator's local design workspace (admin editor only)
// ---------------------------------------------------------------------

async function getDraftConfig() {
  if (cachedDraftConfig) return Utils.deepClone(cachedDraftConfig);

  let draft;
  try {
    draft = await DB.getDraftConfig();
  } catch (err) {
    console.error('[ConfigService] Failed to load draft config', err);
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
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Napaka pri posodabljanju osnutka.' });
    throw err;
  }

  const current = await getDraftConfig();
  const normalized = normalizeConfig({
    ...Utils.deepClone(newDraft),
    version: (current.version || 0) + 1,
  });

  try {
    await DB.saveDraftConfig(normalized);
  } catch (err) {
    console.error('[ConfigService] Failed to save draft config', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Osnutka ni bilo mogoče shraniti.' });
    throw err;
  }

  cachedDraftConfig = normalized;
  EventBus.emit('draft:updated', Utils.deepClone(normalized));
  return Utils.deepClone(normalized);
}

async function resetDraftToLive() {
  const live = await getLiveConfig();
  return saveDraft(live);
}

async function addField(field) {
  if (!field || !field.id || !field.label || !field.type) {
    const err = new Error('addField: polje potrebuje id, label in type');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Polja ni bilo mogoče dodati.' });
    throw err;
  }

  const current = await getDraftConfig();
  if (current.fields.some((f) => f.id === field.id)) {
    const err = new Error(`addField: polje z id "${field.id}" že obstaja`);
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Polje s tem imenom že obstaja.' });
    throw err;
  }

  const groupId = field.group && current.groups.some((g) => g.id === field.group) ? field.group : null;

  const normalized = {
    id: field.id,
    label: field.label,
    type: field.type,
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? field.options : [],
    color: field.color || '#A65A3A',
    group: groupId,
  };

  return saveDraft({ ...current, fields: [...current.fields, normalized] });
}

async function updateField(fieldId, updates) {
  const current = await getDraftConfig();
  const existing = current.fields.find((f) => f.id === fieldId);

  if (!existing) {
    const err = new Error(`updateField: polje z id "${fieldId}" ne obstaja`);
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Polja ni bilo mogoče najti.' });
    throw err;
  }

  if (!updates || !updates.label || !updates.type) {
    const err = new Error('updateField: label in type sta obvezna');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Ime in tip polja sta obvezna.' });
    throw err;
  }

  const groupId = updates.group && current.groups.some((g) => g.id === updates.group) ? updates.group : null;

  const merged = {
    id: fieldId,
    label: updates.label,
    type: updates.type,
    required: Boolean(updates.required),
    options: Array.isArray(updates.options) ? updates.options : [],
    color: updates.color || existing.color || '#A65A3A',
    group: groupId,
  };

  return saveDraft({ ...current, fields: current.fields.map((f) => (f.id === fieldId ? merged : f)) });
}

async function removeField(fieldId) {
  const current = await getDraftConfig();
  return saveDraft({ ...current, fields: current.fields.filter((f) => f.id !== fieldId) });
}

async function addGroup(group) {
  if (!group || !group.label || !group.label.trim()) {
    const err = new Error('addGroup: skupina potrebuje label');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Skupine ni bilo mogoče dodati.' });
    throw err;
  }

  const current = await getDraftConfig();
  const id = group.id || Utils.slugify(group.label) + '_' + Date.now().toString(36).slice(-4);

  if (current.groups.some((g) => g.id === id)) {
    const err = new Error(`addGroup: skupina z id "${id}" že obstaja`);
    console.error('[ConfigService]', err);
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
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Ime skupine ne more biti prazno.' });
    throw err;
  }
  const current = await getDraftConfig();
  return saveDraft({
    ...current,
    groups: current.groups.map((g) => (g.id === groupId ? { ...g, label: newLabel.trim() } : g)),
  });
}

function exportDraftFile() {
  return getDraftConfig().then((draft) => {
    const publishable = { version: draft.version, groups: draft.groups, fields: draft.fields };
    const blob = new Blob([JSON.stringify(publishable, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    EventBus.emit('ui:notify', {
      type: 'success',
      message: 'Shema izvožena kot config.json — zamenjaj datoteko v repozitoriju in objavi (git push).',
    });
  });
}

const ConfigService = {
  getLiveConfig,
  getDraftConfig,
  saveDraft,
  resetDraftToLive,
  addField,
  updateField,
  removeField,
  addGroup,
  removeGroup,
  renameGroup,
  exportDraftFile,
  DEFAULT_CONFIG,
};

export default ConfigService;
