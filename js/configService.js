// /js/configService.js
// Owns the form schema (Config). Talks to DB directly (its own dependency),
// and to everyone else only via EventBus.
//
// Config shape:
// {
//   version: 1,
//   groups: [{ id, label }],         // user-defined sections, in display order
//   fields:  [{ id, label, type, required, options, color, group }] // group: id | null (ungrouped)
// }

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';

const DEFAULT_CONFIG = {
  version: 1,
  groups: [
    { id: 'group_basic', label: 'Osnovni podatki' },
    { id: 'group_physical', label: 'Fizične lastnosti' },
    { id: 'group_status', label: 'Stanje in lokacija' },
    { id: 'group_media', label: 'Dokumentacija' },
  ],
  fields: [
    {
      id: 'inventory_number',
      label: 'Inventarna številka',
      type: 'text',
      required: true,
      options: [],
      color: '#B8934A',
      group: 'group_basic',
    },
    {
      id: 'title',
      label: 'Naziv predmeta',
      type: 'text',
      required: true,
      options: [],
      color: '#B8934A',
      group: 'group_basic',
    },
    {
      id: 'period',
      label: 'Obdobje',
      type: 'text',
      required: false,
      options: [],
      color: '#B8934A',
      group: 'group_basic',
    },
    {
      id: 'material',
      label: 'Material',
      type: 'text',
      required: false,
      options: [],
      color: '#6B7A5E',
      group: 'group_physical',
    },
    {
      id: 'dimensions',
      label: 'Mere',
      type: 'text',
      required: false,
      options: [],
      color: '#6B7A5E',
      group: 'group_physical',
    },
    {
      id: 'condition',
      label: 'Stanje ohranjenosti',
      type: 'select',
      required: true,
      options: ['Odlično', 'Dobro', 'Zmerno', 'Slabo', 'Za restavracijo'],
      color: '#9B4A3F',
      group: 'group_status',
    },
    {
      id: 'location',
      label: 'Lokacija',
      type: 'text',
      required: false,
      options: [],
      color: '#9B4A3F',
      group: 'group_status',
    },
    {
      id: 'photo',
      label: 'Fotografija',
      type: 'image',
      required: false,
      options: [],
      color: '#B8934A',
      group: 'group_media',
    },
  ],
};

let cachedConfig = null;

function normalizeConfig(config) {
  // Defensive normalization for configs saved before groups existed,
  // or where a field references a group that was since removed.
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const groupIds = new Set(groups.map((g) => g.id));
  const fields = (config.fields || []).map((f) => ({
    ...f,
    group: f.group && groupIds.has(f.group) ? f.group : null,
  }));
  return { ...config, groups, fields };
}

async function getConfig() {
  if (cachedConfig) return Utils.deepClone(cachedConfig);

  let config;
  try {
    config = await DB.getConfig();
    if (!config) {
      config = Utils.deepClone(DEFAULT_CONFIG);
      await DB.saveConfig(config);
    }
  } catch (err) {
    console.error('[ConfigService] Failed to load/seed config from DB', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'Konfiguracije ni bilo mogoče naložiti iz baze.',
    });
    throw err;
  }

  config = normalizeConfig(config);
  cachedConfig = config;
  return Utils.deepClone(config);
}

async function updateConfig(newConfig) {
  if (!newConfig || !Array.isArray(newConfig.fields)) {
    const err = new Error('updateConfig: neveljavna konfiguracija (manjka fields[])');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Napaka pri posodabljanju konfiguracije.' });
    throw err;
  }

  const current = await getConfig();
  const updated = normalizeConfig({
    ...Utils.deepClone(newConfig),
    version: (current.version || 0) + 1,
  });

  try {
    await DB.saveConfig(updated);
  } catch (err) {
    console.error('[ConfigService] Failed to save config to DB', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'Konfiguracije ni bilo mogoče shraniti v bazo.',
    });
    throw err;
  }

  cachedConfig = updated;
  EventBus.emit('config:updated', Utils.deepClone(updated));
  return Utils.deepClone(updated);
}

async function addField(field) {
  if (!field || !field.id || !field.label || !field.type) {
    const err = new Error('addField: polje potrebuje id, label in type');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Polja ni bilo mogoče dodati.' });
    throw err;
  }

  const current = await getConfig();
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
    color: field.color || '#B8934A',
    group: groupId,
  };

  const updated = {
    ...current,
    fields: [...current.fields, normalized],
  };

  return updateConfig(updated);
}

async function updateField(fieldId, updates) {
  const current = await getConfig();
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
    id: fieldId, // never changes — this is how existing entries stay linked to the field
    label: updates.label,
    type: updates.type,
    required: Boolean(updates.required),
    options: Array.isArray(updates.options) ? updates.options : [],
    color: updates.color || existing.color || '#B8934A',
    group: groupId,
  };

  const updated = {
    ...current,
    fields: current.fields.map((f) => (f.id === fieldId ? merged : f)),
  };

  return updateConfig(updated);
}

async function removeField(fieldId) {
  const current = await getConfig();
  const updated = {
    ...current,
    fields: current.fields.filter((f) => f.id !== fieldId),
  };
  return updateConfig(updated);
}

async function addGroup(group) {
  if (!group || !group.label || !group.label.trim()) {
    const err = new Error('addGroup: skupina potrebuje label');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Skupine ni bilo mogoče dodati.' });
    throw err;
  }

  const current = await getConfig();
  const id = group.id || Utils.slugify(group.label) + '_' + Date.now().toString(36).slice(-4);

  if (current.groups.some((g) => g.id === id)) {
    const err = new Error(`addGroup: skupina z id "${id}" že obstaja`);
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Skupina s tem imenom že obstaja.' });
    throw err;
  }

  const updated = {
    ...current,
    groups: [...current.groups, { id, label: group.label.trim() }],
  };

  return updateConfig(updated);
}

async function removeGroup(groupId) {
  const current = await getConfig();
  const updated = {
    ...current,
    groups: current.groups.filter((g) => g.id !== groupId),
    // fields in the removed group become ungrouped rather than being deleted
    fields: current.fields.map((f) => (f.group === groupId ? { ...f, group: null } : f)),
  };
  return updateConfig(updated);
}

async function renameGroup(groupId, newLabel) {
  if (!newLabel || !newLabel.trim()) {
    const err = new Error('renameGroup: newLabel je obvezen');
    console.error('[ConfigService]', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Ime skupine ne more biti prazno.' });
    throw err;
  }
  const current = await getConfig();
  const updated = {
    ...current,
    groups: current.groups.map((g) => (g.id === groupId ? { ...g, label: newLabel.trim() } : g)),
  };
  return updateConfig(updated);
}

const ConfigService = {
  getConfig,
  updateConfig,
  addField,
  updateField,
  removeField,
  addGroup,
  removeGroup,
  renameGroup,
  DEFAULT_CONFIG,
};

export default ConfigService;
