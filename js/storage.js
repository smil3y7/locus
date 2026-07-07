// /js/storage.js
// Business logic layer. Flow: validate -> db.save -> emit event.

import DB from './db.js';
import Validator from './validator.js';
import ConfigService from './configService.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';
import SessionService from './sessionService.js';

const FALLBACK_CREATED_BY = 'Neznan vnašalec';

async function saveEntry(rawData) {
  const config = await ConfigService.getLiveConfig();
  const session = await SessionService.getSession();

  const candidate = {
    values: rawData.values || {},
    photo: rawData.photo || null,
  };

  const { valid, errors } = Validator.validateEntry(candidate, config);

  if (!valid) {
    EventBus.emit('ui:notify', {
      type: 'error',
      message: errors[0] || 'Vnos ni veljaven.',
    });
    console.error('[Storage] Validation failed:', errors);
    return { success: false, errors };
  }

  const entry = {
    id: Utils.generateId('entry'),
    created: Date.now(),
    createdBy: (session && session.userName) || FALLBACK_CREATED_BY,
    configVersion: config.version,
    values: candidate.values,
    photo: candidate.photo,
  };

  try {
    const saved = await DB.saveEntry(entry);
    EventBus.emit('entry:created', saved);
    EventBus.emit('ui:notify', { type: 'success', message: 'Predmet je bil shranjen.' });
    return { success: true, entry: saved };
  } catch (err) {
    console.error('[Storage] Failed to save entry', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Shranjevanje v bazo ni uspelo.' });
    return { success: false, errors: ['Shranjevanje v bazo ni uspelo.'] };
  }
}

async function updateEntry(entryId, rawData) {
  const config = await ConfigService.getLiveConfig();

  let existing;
  try {
    existing = await DB.getEntry(entryId);
  } catch (err) {
    console.error('[Storage] Failed to load entry for update', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Predmeta ni bilo mogoče naložiti za urejanje.' });
    return { success: false };
  }

  if (!existing) {
    EventBus.emit('ui:notify', { type: 'error', message: 'Predmet ne obstaja več (morda je bil medtem izbrisan).' });
    return { success: false };
  }

  const candidate = {
    values: rawData.values || {},
    // `photo === undefined` means "no new file chosen" — keep the existing one.
    // `photo === null` or a File means an explicit change.
    photo: rawData.photo !== undefined ? rawData.photo : existing.photo,
  };

  const { valid, errors } = Validator.validateEntry(candidate, config);

  if (!valid) {
    EventBus.emit('ui:notify', { type: 'error', message: errors[0] || 'Vnos ni veljaven.' });
    console.error('[Storage] Update validation failed:', errors);
    return { success: false, errors };
  }

  const updatedEntry = {
    ...existing,
    values: candidate.values,
    photo: candidate.photo,
    configVersion: config.version,
    updatedAt: Date.now(),
  };

  try {
    const saved = await DB.saveEntry(updatedEntry); // put() — overwrites by matching id
    EventBus.emit('entry:updated', saved);
    EventBus.emit('ui:notify', { type: 'success', message: 'Predmet je bil posodobljen.' });
    return { success: true, entry: saved };
  } catch (err) {
    console.error('[Storage] Failed to update entry', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Posodobitev v bazi ni uspela.' });
    return { success: false, errors: ['Posodobitev v bazi ni uspela.'] };
  }
}

async function deleteEntry(id) {
  try {
    await DB.deleteEntry(id);
    EventBus.emit('entry:deleted', { id });
    EventBus.emit('ui:notify', { type: 'success', message: 'Predmet je bil izbrisan.' });
    return { success: true };
  } catch (err) {
    console.error('[Storage] Failed to delete entry', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Brisanje iz baze ni uspelo.' });
    return { success: false };
  }
}

async function clearAllEntries() {
  try {
    await DB.clearEntries();
    EventBus.emit('entry:deleted'); // reuse existing event so Viewer refreshes to the empty state
    return { success: true };
  } catch (err) {
    console.error('[Storage] Failed to clear entries', err);
    EventBus.emit('ui:fatal', { message: err && err.message ? err.message : 'Ponastavitev baze ni uspela.' });
    return { success: false };
  }
}

const Storage = { saveEntry, updateEntry, deleteEntry, clearAllEntries };

export default Storage;
