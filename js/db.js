// /js/db.js
// Low-level storage layer. The ONLY module allowed to touch IndexedDB.
// Rules: async only, returns cloned objects, handles DB versioning/migration.

import Utils from './utils.js';

const DB_NAME = 'LocusDB';
const DB_VERSION = 1;
const STORE_ENTRIES = 'entries';
const STORE_META = 'meta';
const CONFIG_KEY = 'config';
const PIN_KEY = 'adminPinHash';
const SESSION_KEY = 'session';

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

async function saveEntry(entry) {
  const clone = Utils.deepClone(entry);
  await runTransaction(STORE_ENTRIES, 'readwrite', (store) => {
    store.put(clone);
  });
  return Utils.deepClone(clone);
}

async function getAllEntries() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);
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

async function getEntry(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ENTRIES, 'readonly');
    const store = tx.objectStore(STORE_ENTRIES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result ? Utils.deepClone(request.result) : null);
    request.onerror = (event) => {
      console.error('[DB] getEntry failed', event.target.error);
      reject(event.target.error);
    };
  });
}

async function deleteEntry(id) {
  await runTransaction(STORE_ENTRIES, 'readwrite', (store) => {
    store.delete(id);
  });
  return id;
}

async function saveConfig(config) {
  const clone = Utils.deepClone(config);
  await runTransaction(STORE_META, 'readwrite', (store) => {
    store.put({ key: CONFIG_KEY, value: clone });
  });
  return Utils.deepClone(clone);
}

async function getConfig() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, 'readonly');
    const store = tx.objectStore(STORE_META);
    const request = store.get(CONFIG_KEY);

    request.onsuccess = () => {
      resolve(request.result ? Utils.deepClone(request.result.value) : null);
    };
    request.onerror = (event) => {
      console.error('[DB] getConfig failed', event.target.error);
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

async function clearEntries() {
  await runTransaction(STORE_ENTRIES, 'readwrite', (store) => {
    store.clear();
  });
}

const DB = {
  saveEntry,
  getAllEntries,
  getEntry,
  deleteEntry,
  clearEntries,
  saveConfig,
  getConfig,
  savePin,
  getPin,
  saveSession,
  getSession,
  clearSession,
};

export default DB;
