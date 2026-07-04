// /js/formBuilder.js
// Renders a dynamic form from ConfigService's config and collects raw input.
// Does NOT validate authoritatively (Validator does that downstream) — but
// does a lightweight pre-submit check so that, when fields are split across
// tabs, a missing required field switches to the right tab and focuses it
// instead of failing silently or relying on native validation of hidden
// (display:none) inputs, which browsers skip entirely.
// Does NOT save. Emits 'form:submitted' with raw data.

import EventBus from './eventBus.js';
import UI from './ui.js';

let currentContainer = null;
let currentForm = null;

function fieldInputHtml(field, value) {
  const req = field.required ? 'required' : '';
  const val = value !== undefined && value !== null ? String(value) : '';
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : '';
  switch (field.type) {
    case 'text':
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} autocomplete="off" value="${escapeHtml(val)}"${placeholder} />`;
    case 'number':
      return `<input type="number" id="f_${field.id}" name="${field.id}" ${req} step="any" value="${escapeHtml(val)}"${placeholder} />`;
    case 'date':
      return `<input type="date" id="f_${field.id}" name="${field.id}" ${req} value="${escapeHtml(val)}"${placeholder} />`;
    case 'select': {
      const opts = (field.options || [])
        .map((opt) => `<option value="${escapeHtml(opt)}"${opt === value ? ' selected' : ''}>${escapeHtml(opt)}</option>`)
        .join('');
      const placeholderLabel = field.placeholder ? escapeHtml(field.placeholder) : 'Izberi …';
      return `<select id="f_${field.id}" name="${field.id}" ${req}>
        <option value="" disabled${value ? '' : ' selected'}>${placeholderLabel}</option>
        ${opts}
      </select>`;
    }
    case 'image':
      return `<input type="file" id="f_${field.id}" name="${field.id}" accept="image/*" />
        <div class="mf-image-preview" id="preview_${field.id}" aria-hidden="true"></div>`;
    case 'measurements':
      // Real widget is attached after render (attachMeasurementsWidget) — this
      // hidden input is what FormData actually reads on submit (JSON string).
      return `
        <input type="hidden" id="f_${field.id}" name="${field.id}" value="[]" />
        <div class="mf-measurements-chips" id="chips_${field.id}"></div>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="addmeasure_${field.id}">+ Dodaj mero</button>
        <div class="mf-measurement-add-form" id="addform_${field.id}" hidden></div>
      `;
    default:
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} value="${escapeHtml(val)}"${placeholder} />`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attachImagePreview(field, form) {
  if (field.type !== 'image') return;
  const input = form.querySelector(`#f_${field.id}`);
  const preview = form.querySelector(`#preview_${field.id}`);
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    preview.innerHTML = '';
    if (!file) return;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    preview.appendChild(img);
  });
}

function attachMeasurementsWidget(field, form, existingValues) {
  if (field.type !== 'measurements') return;

  const hiddenInput = form.querySelector(`#f_${field.id}`);
  const chipsEl = form.querySelector(`#chips_${field.id}`);
  const addBtn = form.querySelector(`#addmeasure_${field.id}`);
  const addFormEl = form.querySelector(`#addform_${field.id}`);
  if (!hiddenInput || !chipsEl || !addBtn || !addFormEl) return;

  const types = field.measurementTypes || [];
  let rows = Array.isArray(existingValues && existingValues[field.id]) ? [...existingValues[field.id]] : [];

  function sync() {
    hiddenInput.value = JSON.stringify(rows);
    renderChips();
  }

  function renderChips() {
    if (rows.length === 0) {
      chipsEl.innerHTML = '<span class="mf-field-hint">Še ni dodanih mer.</span>';
      return;
    }
    chipsEl.innerHTML = rows
      .map((row, index) => {
        const typeDef = types.find((t) => t.id === row.type);
        const label = typeDef ? typeDef.label : row.type;
        const extent = row.extent ? ` (${escapeHtml(row.extent)})` : '';
        return `
          <span class="mf-measurement-chip">
            ${escapeHtml(label)}: ${escapeHtml(row.value)} ${escapeHtml(row.unit)}${extent}
            <button type="button" class="mf-chip-remove" data-index="${index}" aria-label="Odstrani mero">&times;</button>
          </span>
        `;
      })
      .join('');

    chipsEl.querySelectorAll('.mf-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        rows.splice(Number(btn.dataset.index), 1);
        sync();
      });
    });
  }

  function renderAddForm() {
    if (types.length === 0) {
      addFormEl.innerHTML = '<p class="mf-field-hint">Admin za to polje še ni določil dovoljenih vrst mer.</p>';
      return;
    }
    const typeOptions = types.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('');
    addFormEl.innerHTML = `
      <div class="mf-measurement-inline-fields">
        <select class="mf-mtype-select" aria-label="Vrsta mere">${typeOptions}</select>
        <input type="number" step="any" class="mf-mvalue-input" placeholder="Vrednost" aria-label="Vrednost" />
        <select class="mf-munit-select" aria-label="Enota"></select>
        <input type="text" class="mf-mextent-input" placeholder="Del predmeta (neobvezno)" aria-label="Del predmeta" />
      </div>
      <div class="mf-form-actions">
        <button type="button" class="mf-btn mf-btn-primary mf-btn-small mf-madd-confirm">Dodaj</button>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small mf-madd-cancel">Prekliči</button>
      </div>
    `;

    const typeSelect = addFormEl.querySelector('.mf-mtype-select');
    const unitSelect = addFormEl.querySelector('.mf-munit-select');
    const valueInput = addFormEl.querySelector('.mf-mvalue-input');
    const extentInput = addFormEl.querySelector('.mf-mextent-input');

    function refreshUnits() {
      const typeDef = types.find((t) => t.id === typeSelect.value) || types[0];
      const units = (typeDef && typeDef.units) || [];
      unitSelect.innerHTML = units.map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('');
    }
    typeSelect.addEventListener('change', refreshUnits);
    refreshUnits();

    addFormEl.querySelector('.mf-madd-cancel').addEventListener('click', () => {
      addFormEl.hidden = true;
    });

    addFormEl.querySelector('.mf-madd-confirm').addEventListener('click', () => {
      const value = valueInput.value.trim();
      if (!value || Number.isNaN(Number(value))) {
        EventBus.emit('ui:notify', { type: 'error', message: 'Vnesi veljavno številsko vrednost mere.' });
        return;
      }
      rows.push({
        type: typeSelect.value,
        value: Number(value),
        unit: unitSelect.value,
        extent: extentInput.value.trim() || undefined,
      });
      sync();
      addFormEl.hidden = true;
    });
  }

  addBtn.addEventListener('click', () => {
    renderAddForm();
    addFormEl.hidden = !addFormEl.hidden;
  });

  sync();
}

function fieldHtml(field, existingValues, existingPhoto) {
  const value = existingValues ? existingValues[field.id] : undefined;
  const currentPhotoHint =
    field.type === 'image' && existingPhoto
      ? `<p class="mf-field-hint">Trenutna slika ostane, če ne izbereš nove.</p>
         <div class="mf-image-preview" aria-hidden="true"><img src="${existingPhoto}" alt="" /></div>`
      : '';
  return `
    <div class="mf-field" data-type="${field.type}" style="--field-accent:${field.color || '#A65A3A'}">
      <label for="f_${field.id}">${escapeHtml(field.label)}${field.required ? ' <span class="mf-required">*</span>' : ''}</label>
      ${fieldInputHtml(field, value)}
      ${currentPhotoHint}
    </div>
  `;
}

// Groups fields into "sections" (one per config.groups entry that actually
// has fields, plus a trailing "Splošno" section for ungrouped fields).
function computeSections(config) {
  const groups = Array.isArray(config.groups) ? config.groups : [];
  const fieldsByGroup = new Map(groups.map((g) => [g.id, []]));
  const ungrouped = [];

  for (const field of config.fields) {
    if (field.group && fieldsByGroup.has(field.group)) {
      fieldsByGroup.get(field.group).push(field);
    } else {
      ungrouped.push(field);
    }
  }

  const sections = groups
    .filter((g) => fieldsByGroup.get(g.id).length > 0)
    .map((g) => ({ id: g.id, label: g.label, fields: fieldsByGroup.get(g.id) }));

  if (ungrouped.length) {
    sections.push({ id: '__ungrouped', label: 'Splošno', fields: ungrouped });
  }

  return sections;
}

function updateTabDots(container, sections) {
  sections.forEach((section) => {
    const dot = container.querySelector(`[data-tab-dot="${section.id}"]`);
    if (!dot) return;
    const incomplete = section.fields.some((field) => {
      if (!field.required || field.type === 'image') return false;
      const el = container.querySelector(`#f_${field.id}`);
      if (!el) return false;
      return !el.value || !el.value.trim();
    });
    dot.hidden = !incomplete;
  });
}

function wireTabNav(container, sections, tabController) {
  const prevBtn = container.querySelector('#mf-tab-prev');
  const nextBtn = container.querySelector('#mf-tab-next');
  const positionEl = container.querySelector('#mf-tab-position');

  function currentIndex() {
    const activeBtn = container.querySelector('.mf-tab-btn-active');
    return activeBtn ? sections.findIndex((s) => s.id === activeBtn.dataset.tab) : 0;
  }

  function updatePositionUi() {
    const idx = currentIndex();
    if (positionEl) positionEl.textContent = `${idx + 1} / ${sections.length}`;
    if (prevBtn) prevBtn.disabled = idx <= 0;
    if (nextBtn) nextBtn.disabled = idx >= sections.length - 1;
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const idx = currentIndex();
      if (idx > 0) tabController.activate(sections[idx - 1].id);
      updatePositionUi();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const idx = currentIndex();
      if (idx < sections.length - 1) tabController.activate(sections[idx + 1].id);
      updatePositionUi();
    });
  }

  updatePositionUi();
  return updatePositionUi;
}

function build(container, config, options) {
  if (!container) {
    console.error('[FormBuilder] build() requires a container element');
    return;
  }
  if (!config || !Array.isArray(config.fields)) {
    console.error('[FormBuilder] build() requires a valid config with fields[]');
    container.innerHTML = '<p class="mf-empty">Konfiguracija obrazca ni na voljo.</p>';
    return;
  }

  const existingEntry = options && options.entry ? options.entry : null;
  const isEdit = Boolean(existingEntry);

  currentContainer = container;

  let existingPhotoUrl = null;
  if (isEdit && existingEntry.photo) {
    try {
      existingPhotoUrl = URL.createObjectURL(existingEntry.photo);
    } catch (err) {
      console.error('[FormBuilder] Failed to create preview URL for existing photo', err);
    }
  }

  const existingValues = isEdit ? existingEntry.values : null;
  const renderField = (field) => fieldHtml(field, existingValues, existingPhotoUrl);

  const sections = computeSections(config);
  const useTabs = sections.length > 1;

  let fieldsMarkup;
  if (useTabs) {
    const tabButtons = sections
      .map(
        (s) => `
        <button type="button" class="mf-tab-btn" data-tab="${s.id}" role="tab">
          ${escapeHtml(s.label)}<span class="mf-tab-dot" data-tab-dot="${s.id}" hidden></span>
        </button>
      `
      )
      .join('');

    const panels = sections
      .map(
        (s) => `
        <div class="mf-tab-panel" data-tab-panel="${s.id}">
          ${s.fields.map(renderField).join('')}
        </div>
      `
      )
      .join('');

    fieldsMarkup = `
      <div class="mf-tabs">
        <div class="mf-tab-list" role="tablist">${tabButtons}</div>
        <div class="mf-tab-nav">
          <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-tab-prev">← Prejšnja skupina</button>
          <span class="mf-tab-position" id="mf-tab-position"></span>
          <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-tab-next">Naslednja skupina →</button>
        </div>
        <div class="mf-tab-panels">${panels}</div>
      </div>
    `;
  } else {
    fieldsMarkup = sections.map((s) => s.fields.map(renderField).join('')).join('');
  }

  container.innerHTML = `
    <form id="mf-entry-form" novalidate>
      ${fieldsMarkup}
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-primary">${isEdit ? 'Shrani spremembe' : 'Shrani predmet'}</button>
        <button type="button" class="mf-btn mf-btn-ghost" id="mf-form-cancel">Prekliči</button>
      </div>
    </form>
  `;

  currentForm = container.querySelector('#mf-entry-form');

  config.fields.forEach((field) => {
    attachImagePreview(field, currentForm);
    attachMeasurementsWidget(field, currentForm, existingValues);
  });

  let tabController = null;
  let updateTabPositionUi = null;
  if (useTabs) {
    tabController = UI.tabify(container);
    updateTabPositionUi = wireTabNav(container, sections, tabController);
    updateTabDots(container, sections);
    currentForm.addEventListener('input', () => {
      updateTabDots(container, sections);
      if (updateTabPositionUi) updateTabPositionUi();
    });
  }

  currentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(currentForm);
    const values = {};
    let photo; // undefined in edit mode means "keep existing photo, none re-selected"

    for (const field of config.fields) {
      if (field.type === 'image') {
        const file = formData.get(field.id);
        const chosenFile = file && file.size > 0 ? file : null;
        photo = isEdit ? chosenFile || undefined : chosenFile;
      } else if (field.type === 'measurements') {
        const raw = formData.get(field.id);
        try {
          values[field.id] = raw ? JSON.parse(raw) : [];
        } catch (err) {
          console.error('[FormBuilder] Failed to parse measurements JSON', err);
          values[field.id] = [];
        }
      } else {
        values[field.id] = formData.get(field.id);
      }
    }

    if (useTabs) {
      const missing = sections
        .flatMap((s) => s.fields.map((f) => ({ ...f, sectionId: s.id })))
        .find((f) => {
          if (!f.required || f.type === 'image') return false;
          if (f.type === 'measurements') return !Array.isArray(values[f.id]) || values[f.id].length === 0;
          return !values[f.id] || !String(values[f.id]).trim();
        });

      if (missing) {
        tabController.activate(missing.sectionId);
        if (updateTabPositionUi) updateTabPositionUi();
        const input = currentForm.querySelector(`#f_${missing.id}`);
        if (input) input.focus();
        const sectionLabel = sections.find((s) => s.id === missing.sectionId)?.label || '';
        EventBus.emit('ui:notify', {
          type: 'error',
          message: `Manjka obvezno polje "${missing.label}" v skupini "${sectionLabel}".`,
        });
        return;
      }
    }

    const payload = { values, photo, configVersion: config.version };
    if (isEdit) payload.entryId = existingEntry.id;

    const enteredByInput = currentForm.querySelector('[name="entered_by"]');
    if (enteredByInput) payload.enteredBy = enteredByInput.value.trim();

    EventBus.emit('form:submitted', payload);
  });

  const cancelBtn = container.querySelector('#mf-form-cancel');
  cancelBtn.addEventListener('click', () => {
    EventBus.emit('ui:closeModal');
  });
}

function reset() {
  if (currentForm) currentForm.reset();
  if (currentContainer) {
    currentContainer.querySelectorAll('.mf-image-preview').forEach((el) => (el.innerHTML = ''));
  }
}

function destroy() {
  if (currentContainer) currentContainer.innerHTML = '';
  currentContainer = null;
  currentForm = null;
}

const FormBuilder = { build, reset, destroy };

export default FormBuilder;
