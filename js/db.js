// /js/db.js
// Low-level storage layer. The ONLY module allowed to touch IndexedDB.
// Rules: async only, returns cloned objects, handles DB versioning/migration.

import Utils from './utils.js';

const DB_NAME = 'LokusDB';
const DB_VERSION = 2;
const STORE_ENTRIES = 'entries';
const STORE_META = 'meta';
const PIN_KEY = 'adminPinHash';
const SESSION_KEY = 'session';

// --- Modules ---------------------------------------------------------
// Module 1 ("inventarna" / Inventarna knjiga) is the original, single
// module this app shipped with. Its object store name (STORE_ENTRIES,
// literally 'entries') and its meta keys (LIVE_CONFIG_CACHE_KEY /
// DRAFT_CONFIG_KEY, unprefixed) are kept EXACTLY as they always were —
// existing installations upgrade with zero data movement.
//
// Module 2 ("dokumentacija" / Dokumentacija o enoti) is additive: a new
// object store + new, module-suffixed meta keys, created in a fresh
// onupgradeneeded branch. Nothing about module 1's storage is touched.
const STORE_ENTRIES_DOKUMENTACIJA = 'entries_dokumentacija';
const LIVE_CONFIG_CACHE_KEY = 'liveConfigCache';
const DRAFT_CONFIG_KEY = 'configDraft';
const LIVE_CONFIG_CACHE_KEY_DOKUMENTACIJA = 'liveConfigCache:dokumentacija';
const DRAFT_CONFIG_KEY_DOKUMENTACIJA = 'configDraft:dokumentacija';

const MODULE_STORES = {
  inventarna: STORE_ENTRIES,
  dokumentacija: STORE_ENTRIES_DOKUMENTACIJA,
};
const MODULE_LIVE_CONFIG_KEYS = {
  inventarna: LIVE_CONFIG_CACHE_KEY,
  dokumentacija: LIVE_CONFIG_CACHE_KEY_DOKUMENTACIJA,
};
const MODULE_DRAFT_CONFIG_KEYS = {
  inventarna: DRAFT_CONFIG_KEY,
  dokumentacija: DRAFT_CONFIG_KEY_DOKUMENTACIJA,
};

function storeNameForModule(moduleId) {
  return MODULE_STORES[moduleId] || STORE_ENTRIES;
}
function liveConfigKeyForModule(moduleId) {
  return MODULE_LIVE_CONFIG_KEYS[moduleId] || LIVE_CONFIG_CACHE_KEY;
}
function draftConfigKeyForModule(moduleId) {
  return MODULE_DRAFT_CONFIG_KEYS[moduleId] || DRAFT_CONFIG_KEY;
}

let dbPromise = null;

// Some sandboxed/embedded contexts (e.g. preview iframes, private-browsing
// modes on mobile Safari/Chrome) silently hang on indexedDB.open() instead
// of firing onsuccess/onerror. Without a timeout, callers would await
// forever with no visible error. This guarantees the promise always settles.
const OPEN_TIMEOUT_MS = 4000;

function attemptOpen() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      const err = new Error('IndexedDB ni podprt v tem brskalniku.');
      console.error('[DB] IndexedDB unavailable', err);
      reject(err);
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      console.error('[DB] indexedDB.open threw synchronously', err);
      reject(err);
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion || 0;

      // --- Migration chain (mandatory, additive, never destructive) ---
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
          const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
          store.createIndex('created', 'created', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      }
      if (oldVersion < 2) {
        // Adds the "Dokumentacija o enoti" module's own store. Purely
        // additive — module 1's store/keys above are untouched.
        if (!db.objectStoreNames.contains(STORE_ENTRIES_DOKUMENTACIJA)) {
          const store = db.createObjectStore(STORE_ENTRIES_DOKUMENTACIJA, { keyPath: 'id' });
          store.createIndex('created', 'created', { unique: false });
        }
      }
      // Future migrations append here as `if (oldVersion < N) { ... }`
      // and must never delete existing user data.
    };

    request.onsuccess = (event) => resolve(event.target.result);

    request.onerror = (event) => {
      console.error('[DB] Failed to open database', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      console.error('[DB] Database open blocked by another connection/tab');
    };
  });
}

function openDatabase() {
  if (dbPromise) return dbPromise;

  const timeout = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          'IndexedDB se ni odzval pravočasno. To okolje (npr. vdelan predogled ali zasebno brskanje) verjetno blokira lokalno shrambo — odpri index.html neposredno v brskalniku.'
        )
      );
    }, OPEN_TIMEOUT_MS);
  });

  dbPromise = Promise.race([attemptOpen(), timeout]).catch((err) => {
    dbPromise = null; // don't cache a dead promise — allow retry on next call
    throw err;
  });

  return dbPromise;
}

function runTransaction(storeName, mode, executor) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let result;

        try {
          result = executor(store);
        } catch (err) {
          console.error(`[DB] Executor threw for store "${storeName}"`, err);
          reject(err);
          return;
        }

        tx.oncomplete = () => resolve(result);
        tx.onerror = (event) => {
          console.error(`[DB] Transaction error on "${storeName}"`, event.target.error);
          reject(event.target.error);
        };
        tx.onabort = (event) => {
          console.error(`[DB] Transaction aborted on "${storeName}"`, event.target.error);
          reject(event.target.error || new Error('Transaction aborted'));
        };
      })
  );
}

async function saveEntry(entry, moduleId = 'inventarna') {
  const clone = Utils.deepClone(entry);
  await runTransaction(storeNameForModule(moduleId), 'readwrite', (store) => {
    store.put(clone);
  });
  return Utils.deepClone(clone);
}

async function getAllEntries(moduleId = 'inventarna') {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNameForModule(moduleId), 'readonly');
    const store = tx.objectStore(storeNameForModule(moduleId));
    const request = store.getAll();

    request.onsuccess = () => {
      const entries = (request.result || []).map((e) => Utils.deepClone(e));
      resolve(entries);
    };
    request.onerror = (event) => {
      console.error('[DB] getAllEntries failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function getEntry(id, moduleId = 'inventarna') {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNameForModule(moduleId), 'readonly');
    const store = tx.objectStore(storeNameForModule(moduleId));
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result ? Utils.deepClone(request.result) : null);
    request.onerror = (event) => {
      console.error('[DB] getEntry failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function deleteEntry(id, moduleId = 'inventarna') {
  await runTransaction(storeNameForModule(moduleId), 'readwrite', (store) => {
    store.delete(id);
  });
  return id;
}

async function saveLiveConfigCache(config, moduleId = 'inventarna') {
  const clone = Utils.deepClone(config);
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.put({ key: liveConfigKeyForModule(moduleId), value: clone });
  });
  return Utils.deepClone(clone);
}

async function getLiveConfigCache(moduleId = 'inventarna') {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(liveConfigKeyForModule(moduleId));

    request.onsuccess = () => {
      resolve(request.result ? Utils.deepClone(request.result.value) : null);
    };
    request.onerror = (event) => {
      console.error('[DB] getLiveConfigCache failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function saveDraftConfig(config, moduleId = 'inventarna') {
  const clone = Utils.deepClone(config);
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.put({ key: draftConfigKeyForModule(moduleId), value: clone });
  });
  return Utils.deepClone(clone);
}

async function getDraftConfig(moduleId = 'inventarna') {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(draftConfigKeyForModule(moduleId));

    request.onsuccess = () => {
      resolve(request.result ? Utils.deepClone(request.result.value) : null);
    };
    request.onerror = (event) => {
      console.error('[DB] getDraftConfig failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function savePin(hash) {
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.put({ key: PIN_KEY, value: hash });
  });
  return hash;
}

async function getPin() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(PIN_KEY);

    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };
    request.onerror = (event) => {
      console.error('[DB] getPin failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function saveSession(session) {
  const clone = Utils.deepClone(session);
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.put({ key: SESSION_KEY, value: clone });
  });
  return Utils.deepClone(clone);
}

async function getSession() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(SESSION_KEY);

    request.onsuccess = () => {
      resolve(request.result ? Utils.deepClone(request.result.value) : null);
    };
    request.onerror = (event) => {
      console.error('[DB] getSession failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function clearSession() {
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.delete(SESSION_KEY);
  });
}

async function clearEntries(moduleId = 'inventarna') {
  await runTransaction(storeNameForModule(moduleId), 'readwrite', (store) => {
    store.clear();
  });
}

const DB = {
  MODULE_IDS: Object.keys(MODULE_STORES),
  saveEntry,
  getAllEntries,
  getEntry,
  deleteEntry,
  clearEntries,
  saveLiveConfigCache,
  getLiveConfigCache,
  saveDraftConfig,
  getDraftConfig,
  savePin,
  getPin,
  saveSession,
  getSession,
  clearSession,
};

export default DB;
