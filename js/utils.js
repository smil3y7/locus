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

function formatMeasurements(rows, field) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const typesById = new Map(((field && field.measurementTypes) || []).map((t) => [t.id, t.label]));
  return rows
    .map((row) => {
      const label = typesById.get(row.type) || row.type;
      const extent = row.extent ? ` (${row.extent})` : '';
      return `${label}: ${row.value} ${row.unit}${extent}`;
    })
    .join(', ');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DEFAULT_FIELD_COLOR = '#A65A3A';

// Groups config.fields by config.groups, in group order, with a trailing
// "Splošno" section for fields that have no (or an invalid) group. Used
// by formBuilder (entry form tabs), viewer (detail view tabs), and app
// (admin field list tabs) — the one grouping algorithm all three need.
function groupFieldsIntoSections(config, { excludeTypes = [], includeEmptyGroups = false, alwaysIncludeUngrouped = false } = {}) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const fieldsByGroup = new Map(groups.map((g) => [g.id, []]));
  const ungrouped = [];

  const fields = excludeTypes.length
    ? config.fields.filter((f) => !excludeTypes.includes(f.type))
    : config.fields;

  for (const field of fields) {
    if (field.group && fieldsByGroup.has(field.group)) {
      fieldsByGroup.get(field.group).push(field);
    } else {
      ungrouped.push(field);
    }
  }

  const sections = groups
    .filter((g) => includeEmptyGroups || fieldsByGroup.get(g.id).length > 0)
    .map((g) => ({ id: g.id, label: g.label, fields: fieldsByGroup.get(g.id), razdelki: g.sections || [] }));

  if (ungrouped.length || alwaysIncludeUngrouped) {
    sections.push({ id: '__ungrouped', label: 'Splošno', fields: ungrouped, razdelki: [] });
  }

  return sections;
}

// Dates can be entered with different precision (full day, month+year, or
// just a year) — chosen at data-entry time per field, since how precisely
// an object's date is *known* varies object to object, not field to field.
// Stored as { value: "2023-06-15" | "2023-06" | "2023", precision }.
function formatPartialDate(dateValue) {
  if (!dateValue || !dateValue.value) return '';
  const { value, precision } = dateValue;

  if (precision === 'text') return value; // free-text approximate dating, e.g. "prva polovica 19. stoletja"

  if (precision === 'year') return value;

  if (precision === 'month') {
    const [year, month] = value.split('-');
    if (!year || !month) return value;
    return `${month}/${year}`;
  }

  // Full day precision
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('sl-SI', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Single source of truth for the app version — shown in the footer, and
// stamped onto exported archives so it's clear which version produced them.
// Bump this by hand when you ship a meaningful set of changes; see
// CHANGELOG.md at the repo root for what each version contains.
const APP_VERSION = '0.2.0';

// Second-level grouping WITHIN one tab/group's fields — "razdelki" (sections)
// are visual sub-headers that further organize a tab's fields, defined per
// group (group.sections = [{id,label}]), referenced by field.section. If a
// group defines no sections, this is a no-op passthrough (single flat bucket,
// no sub-header rendered) — fully backward compatible with simpler forms.
function groupFieldsBySection(fields, sectionDefs) {
  const sections = Array.isArray(sectionDefs) ? sectionDefs : [];
  if (sections.length === 0) {
    return [{ id: null, label: null, fields }];
  }
  const bySectionId = new Map(sections.map((s) => [s.id, []]));
  const unsectioned = [];
  for (const f of fields) {
    if (f.section && bySectionId.has(f.section)) bySectionId.get(f.section).push(f);
    else unsectioned.push(f);
  }
  const result = [];
  if (unsectioned.length) result.push({ id: null, label: null, fields: unsectioned });
  for (const s of sections) {
    const list = bySectionId.get(s.id);
    if (list.length) result.push({ id: s.id, label: s.label, fields: list });
  }
  return result;
}

function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const Utils = {
  deepClone,
  generateId,
  formatDate,
  formatDateTime,
  slugify,
  isoDate,
  formatMeasurements,
  escapeHtml,
  groupFieldsIntoSections,
  groupFieldsBySection,
  DEFAULT_FIELD_COLOR,
  formatPartialDate,
  APP_VERSION,
  isValidUrl,
};

export default Utils;
