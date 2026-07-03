// /js/viewer.js
// Displays entries. Reads persisted data via DB only. Reacts to EventBus.
// Delegates delete *action* to Storage's public API (allowed: public APIs only).

import EventBus from './eventBus.js';
import DB from './db.js';
import ConfigService from './configService.js';
import Storage from './storage.js';
import UI from './ui.js';
import Utils from './utils.js';

let listContainer = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function primaryFieldValue(entry, config, preferredIds) {
  for (const id of preferredIds) {
    if (entry.values && entry.values[id]) return entry.values[id];
  }
  const firstText = config.fields.find((f) => f.type === 'text');
  return firstText ? entry.values[firstText.id] : entry.id;
}

function photoObjectUrl(photo) {
  if (!photo) return null;
  try {
    return URL.createObjectURL(photo);
  } catch {
    return null;
  }
}

function renderCard(entry, config) {
  const title = primaryFieldValue(entry, config, ['title', 'naziv']);
  const inventory = entry.values.inventory_number || '';
  const imgUrl = photoObjectUrl(entry.photo);

  const card = document.createElement('article');
  card.className = 'mf-tag-card';
  card.dataset.id = entry.id;
  card.innerHTML = `
    <div class="mf-tag-thumb">
      ${imgUrl ? `<img src="${imgUrl}" alt="" />` : `<span class="mf-tag-thumb-empty">brez slike</span>`}
    </div>
    <div class="mf-tag-body">
      <span class="mf-tag-inventory">${escapeHtml(inventory) || '—'}</span>
      <h3 class="mf-tag-title">${escapeHtml(title) || 'Neimenovan predmet'}</h3>
      <span class="mf-tag-date">${Utils.formatDate(entry.created)}</span>
    </div>
  `;
  card.addEventListener('click', () => openDetail(entry, config));
  return card;
}

async function renderList() {
  if (!listContainer) return;
  try {
    const [entries, config] = await Promise.all([DB.getAllEntries(), ConfigService.getConfig()]);
    listContainer.innerHTML = '';

    if (entries.length === 0) {
      listContainer.innerHTML = `
        <div class="mf-empty-state">
          <p>Zbirka je še prazna.</p>
          <span>Dodaj prvi predmet, da začneš katalog.</span>
        </div>
      `;
      return;
    }

    entries
      .sort((a, b) => b.created - a.created)
      .forEach((entry) => listContainer.appendChild(renderCard(entry, config)));
  } catch (err) {
    console.error('[Viewer] Failed to render list', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Seznama predmetov ni bilo mogoče naložiti.' });
  }
}

function detailRowHtml(field, entry) {
  const value = entry.values[field.id];
  return `
    <div class="mf-detail-row" style="--field-accent:${field.color || '#B8934A'}">
      <span class="mf-detail-label">${escapeHtml(field.label)}</span>
      <span class="mf-detail-value">${escapeHtml(value) || '—'}</span>
    </div>
  `;
}

function groupedDetailHtml(entry, config) {
  const nonImageFields = config.fields.filter((f) => f.type !== 'image');
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const fieldsByGroup = new Map(groups.map((g) => [g.id, []]));
  const ungrouped = [];

  for (const field of nonImageFields) {
    if (field.group && fieldsByGroup.has(field.group)) {
      fieldsByGroup.get(field.group).push(field);
    } else {
      ungrouped.push(field);
    }
  }

  const groupSections = groups
    .filter((g) => fieldsByGroup.get(g.id).length > 0)
    .map(
      (g) => `
      <div class="mf-detail-group">
        <h4 class="mf-detail-group-title">${escapeHtml(g.label)}</h4>
        ${fieldsByGroup.get(g.id).map((f) => detailRowHtml(f, entry)).join('')}
      </div>
    `
    )
    .join('');

  const ungroupedSection = ungrouped.length
    ? `
      <div class="mf-detail-group">
        ${groups.length ? '<h4 class="mf-detail-group-title">Splošno</h4>' : ''}
        ${ungrouped.map((f) => detailRowHtml(f, entry)).join('')}
      </div>
    `
    : '';

  return groupSections + ungroupedSection;
}

function printCardHtml(entry, config) {
  const imgUrl = photoObjectUrl(entry.photo);
  const rows = groupedDetailHtml(entry, config);
  const title = primaryFieldValue(entry, config, ['title', 'naziv']) || 'Predmet';
  const inventory = entry.values.inventory_number || '';

  return `
    <div class="mf-print-card">
      <div class="mf-print-header">
        <span class="mf-print-eyebrow">LOCUS · Muzejska dokumentacijska platforma</span>
        <h2>${escapeHtml(title)}</h2>
        ${inventory ? `<span class="mf-print-inventory">${escapeHtml(inventory)}</span>` : ''}
      </div>
      ${imgUrl ? `<div class="mf-print-photo"><img src="${imgUrl}" alt="" /></div>` : ''}
      <div class="mf-detail-rows">${rows}</div>
      <div class="mf-print-meta">Vnesel: ${escapeHtml(entry.createdBy)} · ${Utils.formatDateTime(entry.created)}</div>
    </div>
  `;
}

function openDetail(entry, config) {
  const imgUrl = photoObjectUrl(entry.photo);
  const rows = groupedDetailHtml(entry, config);

  const content = document.createElement('div');
  content.className = 'mf-detail';
  content.innerHTML = `
    ${imgUrl ? `<div class="mf-detail-photo"><img src="${imgUrl}" alt="" /></div>` : ''}
    <div class="mf-detail-meta">
      Vnesel: ${escapeHtml(entry.createdBy)} · ${Utils.formatDateTime(entry.created)}
    </div>
    <div class="mf-detail-rows">${rows}</div>
    <div class="mf-form-actions">
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-edit-entry">Uredi predmet</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-print-entry">Natisni kartico</button>
      <button type="button" class="mf-btn mf-btn-danger" id="mf-delete-entry">Izbriši predmet</button>
    </div>
  `;

  const title = primaryFieldValue(entry, config, ['title', 'naziv']) || 'Podrobnosti predmeta';
  UI.openModal({ title: escapeHtml(title), content });

  content.querySelector('#mf-delete-entry').addEventListener('click', async () => {
    const confirmed = await UI.confirm('Ali res želiš trajno izbrisati ta predmet?', 'Izbriši predmet');
    if (!confirmed) return;
    await Storage.deleteEntry(entry.id);
    UI.closeModal();
  });

  content.querySelector('#mf-edit-entry').addEventListener('click', () => {
    EventBus.emit('ui:closeModal');
    EventBus.emit('entry:editRequested', { entry, config });
  });

  content.querySelector('#mf-print-entry').addEventListener('click', () => {
    UI.printHtml(printCardHtml(entry, config));
  });
}

function init(container) {
  if (!container) {
    console.error('[Viewer] init() requires a container element');
    return;
  }
  listContainer = container;

  EventBus.on('entry:created', renderList);
  EventBus.on('entry:deleted', renderList);
  EventBus.on('entry:updated', renderList);
  EventBus.on('config:updated', renderList);

  renderList();
}

const Viewer = { init, renderList };

export default Viewer;
