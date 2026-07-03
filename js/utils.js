// /js/utils.js
// Pure helpers only. No DOM, no DB, no EventBus.

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // fall through to JSON clone for exotic values (e.g. handled elsewhere)
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function generateId(prefix = 'id') {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${random}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('sl-SI', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('sl-SI', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isoDate(timestamp) {
  const d = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const Utils = { deepClone, generateId, formatDate, formatDateTime, slugify, isoDate };

export default Utils;
