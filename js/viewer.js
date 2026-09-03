// /js/viewer.js
// Displays entries. Reads persisted data via DB only. Reacts to EventBus.
// Delegates delete *action* to Storage's public API (allowed: public APIs only).
//
// createViewer(moduleId, configService, storage) builds one self-contained
// viewer per module. Each instance only reacts to entry:*/draft:updated
// events carrying its own moduleId, so two modules mounted at once never
// step on each other.

import EventBus from './eventBus.js';
import DB from './db.js';
import UI from './ui.js';
import Utils from './utils.js';

function primaryFieldValue(entry, config, preferredIds) {
  for (const id of preferredIds) {
    if (entry.values && entry.values[id]) return entry.values[id];
  }
  const firstText = config.fields.find((f) => f.type === 'text');
  return firstText ? entry.values[firstText.id] : entry.id;
}

function blobUrl(blob) {
  if (!blob || !(blob instanceof Blob)) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// A "hero" image for the card thumbnail / detail header: prefer a top-level
// image field; fall back to the first image found inside a "group" field's
// items (e.g. the first photo in a repeatable "Fotografije" group).
function findPrimaryImageBlob(entry, config) {
  const topImageField = config.fields.find((f) => f.type === 'image');
  if (topImageField && entry.values[topImageField.id] instanceof Blob) {
    return entry.values[topImageField.id];
  }

  const groupField = config.fields.find((f) => f.type === 'group' && (f.subFields || []).some((sf) => sf.type === 'image'));
  if (groupField) {
    const imageSubField = groupField.subFields.find((sf) => sf.type === 'image');
    const stored = entry.values[groupField.id];
    if (groupField.repeatable === false) {
      if (stored && stored[imageSubField.id] instanceof Blob) return stored[imageSubField.id];
    } else if (Array.isArray(stored)) {
      const withImage = stored.find((item) => item && item[imageSubField.id] instanceof Blob);
      if (withImage) return withImage[imageSubField.id];
    }
  }
  return null;
}

function documentLinkHtml(file, label, interactive) {
  if (!(file instanceof Blob)) return '—';
  const url = blobUrl(file);
  const name = file.name || label;
  const isPdf = file.type === 'application/pdf';
  const previewBtn =
    interactive && isPdf
      ? `<button type="button" class="mf-doc-preview-btn mf-lightbox-trigger" data-lightbox-src="${url}" data-lightbox-kind="pdf" title="Predogled" aria-label="Predogled dokumenta">&#128065;</button>`
      : '';
  return `<a href="${url}" download="${Utils.escapeHtml(name)}" class="mf-doc-link">&#128196; ${Utils.escapeHtml(name)}</a>${previewBtn}`;
}

function renderGroupItemHtml(item, subFields, interactive) {
  const parts = (subFields || [])
    .map((sf) => {
      const v = item ? item[sf.id] : undefined;
      if (v === undefined || v === null || v === '') return '';
      if (sf.type === 'image') {
        const url = blobUrl(v);
        if (!url) return '';
        const triggerAttrs = interactive ? ` class="mf-lightbox-trigger" data-lightbox-src="${url}"` : '';
        return `<span class="mf-group-item-photo"><img src="${url}" alt=""${triggerAttrs} /></span>`;
      }
      if (sf.type === 'document') return documentLinkHtml(v, sf.label, interactive);
      if (sf.type === 'date') return `<strong>${Utils.escapeHtml(sf.label)}:</strong> ${Utils.escapeHtml(Utils.formatPartialDate(v))}`;
      if (sf.type === 'link') return `<strong>${Utils.escapeHtml(sf.label)}:</strong> ${linkHtml(v)}`;
      return `<strong>${Utils.escapeHtml(sf.label)}:</strong> ${Utils.escapeHtml(v)}`;
    })
    .filter(Boolean);
  return `<div class="mf-group-item">${parts.join(' &middot; ')}</div>`;
}

function linkHtml(url) {
  if (!url || !Utils.isValidUrl(url)) return url ? Utils.escapeHtml(url) : '—';
  return `<a href="${Utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="mf-doc-link">${Utils.escapeHtml(url)}</a>`;
}

// Reference field: a list of clickable chips, each jumping to the linked
// entry in its (possibly different) module. Actual navigation is left to
// the app shell — this just emits an event with enough info to act on.
function referenceValueHtml(raw) {
  const refs = Array.isArray(raw) ? raw : [];
  if (refs.length === 0) return '—';
  return refs
    .map(
      (ref) =>
        `<button type="button" class="mf-reference-link" data-ref-id="${Utils.escapeHtml(ref.id)}" data-ref-module="${Utils.escapeHtml(ref.module || '')}">${Utils.escapeHtml(ref.label || '(brez oznake)')}</button>`
    )
    .join(' ');
}

function referenceValueTextOnly(raw) {
  const refs = Array.isArray(raw) ? raw : [];
  if (refs.length === 0) return '—';
  return refs.map((ref) => Utils.escapeHtml(ref.label || '(brez oznake)')).join(', ');
}

function detailRowHtml(field, entry, { interactive }) {
  const raw = entry.values[field.id];
  let valueHtml;

  if (field.type === 'measurements') {
    valueHtml = Utils.escapeHtml(Utils.formatMeasurements(raw, field)) || '—';
  } else if (field.type === 'date') {
    valueHtml = Utils.escapeHtml(Utils.formatPartialDate(raw)) || '—';
  } else if (field.type === 'document') {
    valueHtml = documentLinkHtml(raw, field.label, interactive);
  } else if (field.type === 'link') {
    valueHtml = linkHtml(raw);
  } else if (field.type === 'reference') {
    valueHtml = interactive ? referenceValueHtml(raw) : referenceValueTextOnly(raw);
  } else if (field.type === 'multiselect') {
    valueHtml = Array.isArray(raw) && raw.length > 0 ? Utils.escapeHtml(raw.join(', ')) : '—';
  } else if (field.type === 'group') {
    if (field.repeatable === false) {
      valueHtml = raw ? renderGroupItemHtml(raw, field.subFields, interactive) : '—';
    } else {
      const items = Array.isArray(raw) ? raw : [];
      valueHtml = items.length === 0 ? '—' : items.map((item) => renderGroupItemHtml(item, field.subFields, interactive)).join('');
    }
  } else {
    valueHtml = Utils.escapeHtml(raw) || '—';
  }

  const bgStyle = field.backgroundHighlight ? `background-color:${Utils.hexToRgba(field.color || Utils.DEFAULT_FIELD_COLOR, 0.14)};` : '';
  return `
    <div class="mf-detail-row" style="--field-accent:${field.color || Utils.DEFAULT_FIELD_COLOR};${bgStyle}">
      <span class="mf-detail-label">${Utils.escapeHtml(field.label)}</span>
      <span class="mf-detail-value">${valueHtml}</span>
    </div>
  `;
}

function renderSectionedRows(s, entry, opts) {
  const blocks = Utils.groupFieldsBySection(s.fields, s.razdelki);
  return blocks
    .map((b) => {
      const heading = b.label ? `<h4 class="mf-section-heading">${Utils.escapeHtml(b.label)}</h4>` : '';
      return heading + b.fields.map((f) => detailRowHtml(f, entry, opts)).join('');
    })
    .join('');
}

// On-screen detail view — tabbed, so a museum profession with many groups
// and long field lists doesn't turn the modal into an endless scroll.
function tabbedDetailHtml(entry, config) {
  const sections = Utils.groupFieldsIntoSections(config, { excludeTypes: ['image'] });
  if (sections.length <= 1) {
    return sections.map((s) => renderSectionedRows(s, entry, { interactive: true })).join('');
  }
  return UI.renderTabsHtml(sections, (s) => renderSectionedRows(s, entry, { interactive: true }));
}

// Flat, fully-expanded rendering for print — a printed page has no concept
// of "switch tabs", so every group must show at once, headed by its label.
function groupedDetailHtml(entry, config) {
  const sections = Utils.groupFieldsIntoSections(config, { excludeTypes: ['image'] });
  return sections
    .map(
      (s) => `
      <div class="mf-detail-group">
        <h4 class="mf-detail-group-title">${Utils.escapeHtml(s.label)}</h4>
        ${renderSectionedRows(s, entry, { interactive: false })}
      </div>
    `
    )
    .join('');
}

function createViewer(moduleId, configService, storage, moduleDef) {
  let listContainer = null;

  function renderCard(entry, config) {
    const title = primaryFieldValue(entry, config, moduleDef.titleFieldIds || ['title', 'naziv']);
    const identifier = (moduleDef.identifierFieldId && entry.values[moduleDef.identifierFieldId]) || '';
    const imgUrl = blobUrl(findPrimaryImageBlob(entry, config));

    const card = document.createElement('article');
    card.className = 'mf-tag-card';
    card.dataset.id = entry.id;
    card.innerHTML = `
      <div class="mf-tag-thumb">
        ${imgUrl ? `<img src="${imgUrl}" alt="" />` : `<span class="mf-tag-thumb-empty">brez slike</span>`}
      </div>
      <div class="mf-tag-body">
        <span class="mf-tag-inventory">${Utils.escapeHtml(identifier) || '—'}</span>
        <h3 class="mf-tag-title">${Utils.escapeHtml(title) || 'Neimenovan zapis'}</h3>
        <span class="mf-tag-date">${Utils.formatDate(entry.created)}</span>
      </div>
    `;
    card.addEventListener('click', () => openDetail(entry, config));
    return card;
  }

  async function renderList() {
    if (!listContainer) return;
    try {
      const [entries, config] = await Promise.all([DB.getAllEntries(moduleId), configService.getLiveConfig()]);
      listContainer.innerHTML = '';

      if (entries.length === 0) {
        listContainer.innerHTML = `
          <div class="mf-empty-state">
            <p>${Utils.escapeHtml(moduleDef.emptyStateTitle || 'Zbirka je še prazna.')}</p>
            <span>${Utils.escapeHtml(moduleDef.emptyStateHint || 'Dodaj prvi zapis, da začneš.')}</span>
          </div>
        `;
        return;
      }

      entries
        .sort((a, b) => b.created - a.created)
        .forEach((entry) => listContainer.appendChild(renderCard(entry, config)));
    } catch (err) {
      console.error(`[Viewer:${moduleId}] Failed to render list`, err);
      EventBus.emit('ui:notify', { type: 'error', message: 'Seznama ni bilo mogoče naložiti.' });
    }
  }

  function printCardHtml(entry, config) {
    const imgUrl = blobUrl(findPrimaryImageBlob(entry, config));
    const rows = groupedDetailHtml(entry, config);
    const title = primaryFieldValue(entry, config, moduleDef.titleFieldIds || ['title', 'naziv']) || 'Zapis';
    const identifier = (moduleDef.identifierFieldId && entry.values[moduleDef.identifierFieldId]) || '';

    return `
      <div class="mf-print-card">
        <div class="mf-print-header">
          <span class="mf-print-eyebrow">Lokus · ${Utils.escapeHtml(moduleDef.label)}</span>
          <h2>${Utils.escapeHtml(title)}</h2>
          ${identifier ? `<span class="mf-print-inventory">${Utils.escapeHtml(identifier)}</span>` : ''}
        </div>
        ${imgUrl ? `<div class="mf-print-photo"><img src="${imgUrl}" alt="" /></div>` : ''}
        <div class="mf-detail-rows">${rows}</div>
        <div class="mf-print-meta">Vnesel: ${Utils.escapeHtml(entry.createdBy)} · ${Utils.formatDateTime(entry.created)}</div>
        ${entry.updatedAt ? `<div class="mf-print-meta">Nazadnje uredil: ${Utils.escapeHtml(entry.updatedBy || '—')} · ${Utils.formatDateTime(entry.updatedAt)}</div>` : ''}
      </div>
    `;
  }

  function openDetail(entry, config) {
    const imgUrl = blobUrl(findPrimaryImageBlob(entry, config));
    const rows = tabbedDetailHtml(entry, config);
    const lastEditedLine = entry.updatedAt
      ? `<div class="mf-detail-meta">Nazadnje uredil: ${Utils.escapeHtml(entry.updatedBy || '—')} · ${Utils.formatDateTime(entry.updatedAt)}</div>`
      : '';

    const content = document.createElement('div');
    content.className = 'mf-detail';
    content.innerHTML = `
      <div class="mf-detail-actions-top">
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-compact" id="mf-edit-entry">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          Uredi
        </button>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-compact" id="mf-print-entry">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          Natisni
        </button>
        <button type="button" class="mf-btn mf-btn-danger mf-btn-compact" id="mf-delete-entry">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          Izbriši
        </button>
      </div>
      ${imgUrl ? `<div class="mf-detail-photo"><img src="${imgUrl}" alt="" class="mf-lightbox-trigger" data-lightbox-src="${imgUrl}" /></div>` : ''}
      <div class="mf-detail-meta">
        Vnesel: ${Utils.escapeHtml(entry.createdBy)} · ${Utils.formatDateTime(entry.created)}
      </div>
      ${lastEditedLine}
      <div class="mf-detail-rows">${rows}</div>
    `;

    const title = primaryFieldValue(entry, config, moduleDef.titleFieldIds || ['title', 'naziv']) || 'Podrobnosti zapisa';
    UI.openModal({ title: Utils.escapeHtml(title), content, wide: true, closeOnBackdrop: false });
    UI.tabify(content);

    content.querySelector('#mf-delete-entry').addEventListener('click', async () => {
      const confirmed = await UI.confirm('Ali res želiš trajno izbrisati ta zapis?', 'Izbriši zapis');
      if (!confirmed) return;
      await storage.deleteEntry(entry.id);
      UI.closeModal();
    });

    content.querySelector('#mf-edit-entry').addEventListener('click', () => {
      EventBus.emit('ui:closeModal');
      EventBus.emit('entry:editRequested', { moduleId, entry, config });
    });

    content.querySelector('#mf-print-entry').addEventListener('click', () => {
      UI.printHtml(printCardHtml(entry, config));
    });

    // Reference chips: jump to the linked entry, possibly in another module.
    content.querySelectorAll('[data-ref-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        EventBus.emit('ui:closeModal');
        EventBus.emit('nav:openEntry', { moduleId: btn.dataset.refModule || moduleId, entryId: btn.dataset.refId });
      });
    });

    // Images (main photo + any inside repeatable groups) and PDF preview
    // buttons: click opens a full-size lightbox instead of doing nothing.
    content.querySelectorAll('.mf-lightbox-trigger').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        UI.openLightbox({ src: el.dataset.lightboxSrc, kind: el.dataset.lightboxKind || 'image' });
      });
    });
  }

  function setContainer(container) {
    if (!container) {
      console.error(`[Viewer:${moduleId}] setContainer() requires a container element`);
      return;
    }
    listContainer = container;
    renderList();
  }

  EventBus.on('entry:created', (payload) => {
    if (payload && payload.moduleId === moduleId) renderList();
  });
  EventBus.on('entry:deleted', (payload) => {
    if (!payload || payload.moduleId === moduleId) renderList();
  });
  EventBus.on('entry:updated', (payload) => {
    if (payload && payload.moduleId === moduleId) renderList();
  });

  return { moduleId, setContainer, renderList, openDetail, printCardHtml };
}

export default createViewer;
export { createViewer, primaryFieldValue };
