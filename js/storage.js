// /js/storage.js
// Business logic layer. Flow: validate -> db.save -> emit event.
//
// createStorage(moduleId, configService) builds one self-contained storage
// service per module. Emitted events carry `moduleId` in their payload so
// each module's viewer only refreshes on its own module's changes.

import DB from './db.js';
import Validator from './validator.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';
import SessionService from './sessionService.js';

const FALLBACK_CREATED_BY = 'Neznan vnašalec';

function createStorage(moduleId, configService) {
  async function saveEntry(rawData) {
    const config = await configService.getLiveConfig();
    const session = await SessionService.getSession();

    const candidate = { values: rawData.values || {} };
    const { valid, errors } = Validator.validateEntry(candidate, config);

    if (!valid) {
      EventBus.emit('ui:notify', {
        type: 'error',
        message: errors[0] || 'Vnos ni veljaven.',
      });
      console.error(`[Storage:${moduleId}] Validation failed:`, errors);
      return { success: false, errors };
    }

    const entry = {
      id: Utils.generateId('entry'),
      created: Date.now(),
      createdBy: (session && session.userName) || FALLBACK_CREATED_BY,
      configVersion: config.version,
      values: candidate.values,
    };

    try {
      const saved = await DB.saveEntry(entry, moduleId);
      EventBus.emit('entry:created', { moduleId, entry: saved });
      EventBus.emit('ui:notify', { type: 'success', message: 'Zapis je bil shranjen.' });
      return { success: true, entry: saved };
    } catch (err) {
      console.error(`[Storage:${moduleId}] Failed to save entry`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Shranjevanje v bazo ni uspelo.' });
      return { success: false, errors: ['Shranjevanje v bazo ni uspelo.'] };
    }
  }

  async function updateEntry(entryId, rawData) {
    const config = await configService.getLiveConfig();
    const session = await SessionService.getSession();

    let existing;
    try {
      existing = await DB.getEntry(entryId, moduleId);
    } catch (err) {
      console.error(`[Storage:${moduleId}] Failed to load entry for update`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Zapisa ni bilo mogoče naložiti za urejanje.' });
      return { success: false };
    }

    if (!existing) {
      EventBus.emit('ui:notify', { type: 'error', message: 'Zapis ne obstaja več (morda je bil medtem izbrisan).' });
      return { success: false };
    }

    // `undefined` for any field's submitted value means "not touched — keep
    // whatever this entry already had" (used by image/document fields when no
    // new file was chosen). Every other field always submits a real value.
    const mergedValues = { ...existing.values };
    for (const [key, val] of Object.entries(rawData.values || {})) {
      if (val === undefined) continue;
      mergedValues[key] = val;
    }
    const candidate = { values: mergedValues };

    const { valid, errors } = Validator.validateEntry(candidate, config);

    if (!valid) {
      EventBus.emit('ui:notify', { type: 'error', message: errors[0] || 'Vnos ni veljaven.' });
      console.error(`[Storage:${moduleId}] Update validation failed:`, errors);
      return { success: false, errors };
    }

    const updatedEntry = {
      ...existing,
      values: candidate.values,
      configVersion: config.version,
      updatedAt: Date.now(),
      updatedBy: (session && session.userName) || FALLBACK_CREATED_BY,
    };

    try {
      const saved = await DB.saveEntry(updatedEntry, moduleId); // put() — overwrites by matching id
      EventBus.emit('entry:updated', { moduleId, entry: saved });
      EventBus.emit('ui:notify', { type: 'success', message: 'Zapis je bil posodobljen.' });
      return { success: true, entry: saved };
    } catch (err) {
      console.error(`[Storage:${moduleId}] Failed to update entry`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Posodobitev v bazi ni uspela.' });
      return { success: false, errors: ['Posodobitev v bazi ni uspela.'] };
    }
  }

  async function deleteEntry(id) {
    try {
      await DB.deleteEntry(id, moduleId);
      EventBus.emit('entry:deleted', { moduleId, id });
      EventBus.emit('ui:notify', { type: 'success', message: 'Zapis je bil izbrisan.' });
      return { success: true };
    } catch (err) {
      console.error(`[Storage:${moduleId}] Failed to delete entry`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Brisanje iz baze ni uspelo.' });
      return { success: false };
    }
  }

  async function clearAllEntries() {
    try {
      await DB.clearEntries(moduleId);
      EventBus.emit('entry:deleted', { moduleId }); // reuse existing event so Viewer refreshes to the empty state
      return { success: true };
    } catch (err) {
      console.error(`[Storage:${moduleId}] Failed to clear entries`, err);
      EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Ponastavitev baze ni uspela.' });
      return { success: false };
    }
  }

  return { moduleId, saveEntry, updateEntry, deleteEntry, clearAllEntries };
}

// Backward-compatible default export: module 1 (Inventarna knjiga), built
// against the default ConfigService export (also module 1). Existing code
// that does `import Storage from './storage.js'` keeps working unchanged.
import ConfigService from './configService.js';
const Storage = createStorage('inventarna', ConfigService);
Storage.createStorage = createStorage;

export default Storage;
export { createStorage };
