// /js/adminAuth.js
// PIN gate for the admin "Uredi obrazec" editor. Talks to DB directly
// (its own dependency) and to everyone else only via EventBus.
//
// IMPORTANT: this is a frontend-only, offline app with no server. This PIN
// deters ACCIDENTAL access (e.g. a visitor tapping the wrong button) — it
// is not a real security boundary. Anyone with browser dev tools can
// bypass it. Never present this as protecting sensitive data.

import DB from './db.js';
import EventBus from './eventBus.js';

async function sha256Hex(text) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const bytes = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (err) {
      console.error('[AdminAuth] SubtleCrypto hashing failed, using fallback hash', err);
    }
  }
  // Fallback for contexts without Web Crypto (e.g. some non-secure origins).
  // Not cryptographically secure — fine here, since this was never a real
  // security boundary to begin with, only a deterrent.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return 'fallback_' + (hash >>> 0).toString(16);
}

async function hasPin() {
  try {
    const stored = await DB.getPin();
    return Boolean(stored);
  } catch (err) {
    console.error('[AdminAuth] Failed to check for existing PIN', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'PIN-a ni bilo mogoče preveriti (baza ni na voljo).',
    });
    throw err;
  }
}

async function setPin(pin) {
  if (!pin || pin.trim().length < 4) {
    const err = new Error('PIN mora imeti vsaj 4 znake.');
    EventBus.emit('ui:notify', { type: 'error', message: err.message });
    throw err;
  }
  const hash = await sha256Hex(pin.trim());
  try {
    await DB.savePin(hash);
  } catch (err) {
    console.error('[AdminAuth] Failed to save PIN', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'PIN-a ni bilo mogoče shraniti v bazo.',
    });
    throw err;
  }
  EventBus.emit('ui:notify', { type: 'success', message: 'Admin PIN je nastavljen.' });
}

async function verifyPin(pin) {
  let stored;
  try {
    stored = await DB.getPin();
  } catch (err) {
    console.error('[AdminAuth] Failed to read stored PIN', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'PIN-a ni bilo mogoče preveriti (baza ni na voljo).',
    });
    throw err;
  }
  if (!stored) return false;
  const hash = await sha256Hex((pin || '').trim());
  return hash === stored;
}

const AdminAuth = { hasPin, setPin, verifyPin };

export default AdminAuth;
