// /js/eventBus.js
// Global communication layer. No module may talk to another module
// except through this bus (or through that module's own public API).

const listeners = new Map(); // event -> Set<callback>

function on(event, callback) {
  if (typeof callback !== 'function') {
    console.error(`[EventBus] on("${event}") requires a function callback`);
    return () => {};
  }
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(callback);
  // return an unsubscribe convenience handle
  return () => off(event, callback);
}

function off(event, callback) {
  if (!listeners.has(event)) return;
  listeners.get(event).delete(callback);
  if (listeners.get(event).size === 0) listeners.delete(event);
}

function emit(event, data) {
  if (!listeners.has(event)) return;
  for (const callback of Array.from(listeners.get(event))) {
    try {
      callback(data);
    } catch (err) {
      console.error(`[EventBus] handler for "${event}" threw an error:`, err);
    }
  }
}

const EventBus = { on, off, emit };

export default EventBus;
