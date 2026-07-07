// /js/sessionService.js
// Manages the current training "session": who is entering data, and what
// training this is — used to pre-fill the entry form's vnašalec field and
// to name exported archive files. Talks to DB directly, emits via EventBus.

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';

let cachedSession = null;

async function getSession() {
  if (cachedSession !== null) return Utils.deepClone(cachedSession);
  try {
    const session = await DB.getSession();
    cachedSession = session; // may be null — that's a valid "no session yet" state
    return session ? Utils.deepClone(session) : null;
  } catch (err) {
    console.error('[SessionService] Failed to load session', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'Podatkov o seji ni bilo mogoče naložiti.',
    });
    throw err;
  }
}

async function startSession({ trainingTitle, userName }) {
  const session = {
    trainingTitle: (trainingTitle || '').trim(),
    userName: (userName || '').trim(),
    startedAt: Date.now(),
  };
  try {
    await DB.saveSession(session);
  } catch (err) {
    console.error('[SessionService] Failed to save session', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'Seje ni bilo mogoče shraniti.',
    });
    throw err;
  }
  cachedSession = session;
  EventBus.emit('session:updated', Utils.deepClone(session));
  return Utils.deepClone(session);
}

async function clearSession() {
  try {
    await DB.clearSession();
  } catch (err) {
    console.error('[SessionService] Failed to clear session', err);
    EventBus.emit('ui:fatal', {
      message: err && err.message ? err.message : 'Seje ni bilo mogoče počistiti.',
    });
    throw err;
  }
  cachedSession = null;
  EventBus.emit('session:updated', null);
}

const SessionService = { getSession, startSession, clearSession };

export default SessionService;
