// /js/formBuilder.js
// Renders a dynamic form from ConfigService's config and collects raw input.
// Does NOT validate authoritatively (Validator does that downstream) — but
// does a lightweight pre-submit check so that, when fields are split across
// tabs, a missing required field switches to the right tab and focuses it
// instead of failing silently or relying on native validation of hidden
// (display:none) inputs, which browsers skip entirely.
// Does NOT save. Emits 'form:submitted' with raw data.
//
// Field types: text, number, date (with day/month/year precision chosen at
// entry time), select, image, document, measurements (CDWA), group
// (repeatable composite of admin-defined sub-fields, e.g. "Fotografije"
// made of slika+avtor+datacija+lastništvo, or "Napisi" made of napis+lokacija).

import EventBus from './eventBus.js';
import UI from './ui.js';
import Utils from './utils.js';

const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.csv';

let currentContainer = null;
let currentForm = null;

// ---------------------------------------------------------------------
// Date field (day / month / year precision, chosen at entry time)
// ---------------------------------------------------------------------

function renderDateField(field, value, idBase, withName) {
  const nameAttr = withName ? ` name="${field.id}"` : '';
  return `
    <div class="mf-date-field" data-date-wrap="${idBase}">
      <select class="mf-date-precision" aria-label="Natančnost datuma">
        <option value="day">Dan</option>
        <option value="month">Mesec</option>
        <option value="year">Leto</option>
      </select>
      <input type="date" class="mf-date-value-input" aria-label="Vrednost datuma" />
      <input type="hidden" class="mf-date-hidden" id="${idBase}"${nameAttr} value="" />
    </div>
  `;
}

function applyDatePrecisionInputType(valueInput, precision) {
  if (precision === 'year') {
    valueInput.type = 'number';
    valueInput.placeholder = 'npr. 1932';
    valueInput.min = '1000';
    valueInput.max = '9999';
    valueInput.step = '1';
  } else if (precision === 'month') {
    valueInput.type = 'month';
    valueInput.removeAttribute('placeholder');
  } else {
    valueInput.type = 'date';
    valueInput.removeAttribute('placeholder');
  }
}

function attachDateField(container, idBase, existingValue) {
  const wrap = container.querySelector(`[data-date-wrap="${CSS.escape(idBase)}"]`);
  if (!wrap) return;
  const precisionSelect = wrap.querySelector('.mf-date-precision');
  const valueInput = wrap.querySelector('.mf-date-value-input');
  const hiddenInput = wrap.querySelector('.mf-date-hidden');

  function sync() {
    const precision = precisionSelect.value;
    const raw = valueInput.value;
    hiddenInput.value = raw ? JSON.stringify({ value: String(raw), precision }) : '';
  }

  precisionSelect.addEventListener('change', () => {
    applyDatePrecisionInputType(valueInput, precisionSelect.value);
    valueInput.value = '';
    sync();
  });
  valueInput.addEventListener('input', sync);

  if (existingValue && existingValue.value) {
    precisionSelect.value = existingValue.precision || 'day';
    applyDatePrecisionInputType(valueInput, precisionSelect.value);
    valueInput.value = existingValue.value;
  } else {
    applyDatePrecisionInputType(valueInput, 'day');
  }
  sync();
}

// ---------------------------------------------------------------------
// File fields (image / document) — shared preview logic
// ---------------------------------------------------------------------

function attachFilePreview(container, idBase, type) {
  const input = container.querySelector(`#${CSS.escape(idBase)}`);
  const preview = container.querySelector(`[data-preview-for="${CSS.escape(idBase)}"]`);
  if (!input || !preview) return;

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    preview.innerHTML = '';
    if (!file) return;
    if (type === 'image') {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      preview.appendChild(img);
    } else {
      preview.innerHTML = `<span class="mf-doc-chip">&#128196; ${Utils.escapeHtml(file.name)}</span>`;
    }
  });
}

// ---------------------------------------------------------------------
// Sub-field rendering, reused both at top level and inside "group" items
// ---------------------------------------------------------------------

function renderSubFieldInput(field, idBase) {
  switch (field.type) {
    case 'number':
      return `<input type="number" id="${idBase}" step="any" />`;
    case 'date':
      return renderDateField(field, null, idBase, false);
    case 'select': {
      const opts = (field.options || [])
        .map((opt) => `<option value="${Utils.escapeHtml(opt)}">${Utils.escapeHtml(opt)}</option>`)
        .join('');
      return `<select id="${idBase}"><option value="" selected disabled>Izberi …</option>${opts}</select>`;
    }
    case 'image':
      return `<input type="file" id="${idBase}" accept="image/*" /><div class="mf-image-preview" data-preview-for="${idBase}"></div>`;
    case 'document':
      return `<input type="file" id="${idBase}" accept="${DOCUMENT_ACCEPT}" /><div class="mf-doc-preview" data-preview-for="${idBase}"></div>`;
    default:
      return `<input type="text" id="${idBase}" autocomplete="off" />`;
  }
}

function attachSubFieldBehavior(container, field, idBase) {
  if (field.type === 'date') attachDateField(container, idBase, null);
  else if (field.type === 'image') attachFilePreview(container, idBase, 'image');
  else if (field.type === 'document') attachFilePreview(container, idBase, 'document');
}

function readSubFieldValue(container, field, idBase) {
  if (field.type === 'date') {
    const hidden = container.querySelector(`#${CSS.escape(idBase)}`);
    if (!hidden || !hidden.value) return null;
    try {
      return JSON.parse(hidden.value);
    } catch {
      return null;
    }
  }
  if (field.type === 'image' || field.type === 'document') {
    const input = container.querySelector(`#${CSS.escape(idBase)}`);
    const file = input && input.files && input.files[0];
    return file || null;
  }
  const el = container.querySelector(`#${CSS.escape(idBase)}`);
  if (!el) return null;
  if (field.type === 'number') return el.value === '' ? null : Number(el.value);
  return el.value;
}

function summarizeGroupItem(item, subFields) {
  const parts = [];
  for (const sf of subFields) {
    const val = item[sf.id];
    if (val === undefined || val === null || val === '') continue;
    if (sf.type === 'image' || sf.type === 'document') parts.push(val.name || sf.label);
    else if (sf.type === 'date') parts.push(Utils.formatPartialDate(val));
    else parts.push(String(val));
    if (parts.length >= 2) break;
  }
  return parts.join(', ') || 'Brez podatkov';
}

// ---------------------------------------------------------------------
// "Group" field type — repeatable composite of admin-defined sub-fields
// ---------------------------------------------------------------------

function attachGroupWidget(field, form, existingValues) {
  if (field.type !== 'group') return;

  const hiddenInput = form.querySelector(`#f_${field.id}`);
  const chipsEl = form.querySelector(`#groupitems_${field.id}`);
  const addBtn = form.querySelector(`#addgroupitem_${field.id}`);
  const addFormEl = form.querySelector(`#addgroupform_${field.id}`);
  if (!hiddenInput || !chipsEl || !addBtn || !addFormEl) return;

  const subFields = field.subFields || [];
  let items = Array.isArray(existingValues && existingValues[field.id]) ? [...existingValues[field.id]] : [];

  function sync() {
    hiddenInput.value = JSON.stringify(items);
    renderChips();
  }

  function renderChips() {
    if (items.length === 0) {
      chipsEl.innerHTML = '<span class="mf-field-hint">Še ni dodanih primerkov.</span>';
      return;
    }
    chipsEl.innerHTML = items
      .map(
        (item, index) => `
        <span class="mf-measurement-chip">
          ${Utils.escapeHtml(summarizeGroupItem(item, subFields))}
          <button type="button" class="mf-chip-remove" data-index="${index}" aria-label="Odstrani">&times;</button>
        </span>
      `
      )
      .join('');

    chipsEl.querySelectorAll('.mf-chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        items.splice(Number(btn.dataset.index), 1);
        sync();
      });
    });
  }

  function renderAddForm() {
    if (subFields.length === 0) {
      addFormEl.innerHTML = '<p class="mf-field-hint">Admin za to polje še ni določil pod-polj.</p>';
      return;
    }
    const idBase = `subf_${field.id}`;
    addFormEl.innerHTML = `
      <div class="mf-measurement-inline-fields">
        ${subFields
          .map(
            (sf) => `
          <div class="mf-field">
            <label>${Utils.escapeHtml(sf.label)}${sf.required ? ' <span class="mf-required">*</span>' : ''}</label>
            ${renderSubFieldInput(sf, `${idBase}_${sf.id}`)}
          </div>
        `
          )
          .join('')}
      </div>
      <div class="mf-form-actions">
        <button type="button" class="mf-btn mf-btn-primary mf-btn-small mf-gadd-confirm">Dodaj</button>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small mf-gadd-cancel">Prekliči</button>
      </div>
    `;

    subFields.forEach((sf) => attachSubFieldBehavior(addFormEl, sf, `${idBase}_${sf.id}`));

    addFormEl.querySelector('.mf-gadd-cancel').addEventListener('click', () => {
      addFormEl.hidden = true;
    });

    addFormEl.querySelector('.mf-gadd-confirm').addEventListener('click', () => {
      const item = {};
      let hasError = false;
      for (const sf of subFields) {
        const val = readSubFieldValue(addFormEl, sf, `${idBase}_${sf.id}`);
        if (sf.required && (val === null || val === undefined || val === '')) {
          EventBus.emit('ui:notify', { type: 'error', message: `Polje "${sf.label}" je obvezno.` });
          hasError = true;
        }
        item[sf.id] = val;
      }
      if (hasError) return;
      items.push(item);
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

// ---------------------------------------------------------------------
// Measurements field (CDWA Type/Value/Unit) — unchanged from before
// ---------------------------------------------------------------------

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
        const extent = row.extent ? ` (${Utils.escapeHtml(row.extent)})` : '';
        return `
          <span class="mf-measurement-chip">
            ${Utils.escapeHtml(label)}: ${Utils.escapeHtml(row.value)} ${Utils.escapeHtml(row.unit)}${extent}
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
    const typeOptions = types.map((t) => `<option value="${t.id}">${Utils.escapeHtml(t.label)}</option>`).join('');
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
      unitSelect.innerHTML = units.map((u) => `<option value="${Utils.escapeHtml(u)}">${Utils.escapeHtml(u)}</option>`).join('');
    }
    typeSelect.addEventListener('change', refreshUnits);
    refreshUnits();

    addFormEl.querySelector('.mf-madd-cancel').addEventListener('click', () => {
      addFormEl.hidden = true;
    });

    addFormEl.querySelector('.mf-madd-confirm').addEventListener('click', async () => {
      const value = valueInput.value.trim();
      if (!value || Number.isNaN(Number(value))) {
        EventBus.emit('ui:notify', { type: 'error', message: 'Vnesi veljavno številsko vrednost mere.' });
        return;
      }

      const newType = typeSelect.value;
      const newExtent = extentInput.value.trim();
      const isDuplicate = !newExtent && rows.some((r) => r.type === newType && !r.extent);
      if (isDuplicate) {
        const typeDef = types.find((t) => t.id === newType);
        const confirmed = await UI.confirm(
          `Mera "${typeDef ? typeDef.label : newType}" je že dodana. Če gre za drug del predmeta, vpiši opis dela predmeta (npr. "ustje"). Ali vseeno dodam še eno enako mero?`,
          'Podvojena vrsta mere'
        );
        if (!confirmed) return;
      }

      rows.push({
        type: newType,
        value: Number(value),
        unit: unitSelect.value,
        extent: newExtent || undefined,
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

// ---------------------------------------------------------------------
// Top-level field rendering
// ---------------------------------------------------------------------

function fieldInputHtml(field, value) {
  const req = field.required ? 'required' : '';
  const val = value !== undefined && value !== null ? String(value) : '';
  const placeholder = field.placeholder ? ` placeholder="${Utils.escapeHtml(field.placeholder)}"` : '';
  switch (field.type) {
    case 'text':
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} autocomplete="off" value="${Utils.escapeHtml(val)}"${placeholder} />`;
    case 'number':
      return `<input type="number" id="f_${field.id}" name="${field.id}" ${req} step="any" value="${Utils.escapeHtml(val)}"${placeholder} />`;
    case 'date':
      return renderDateField(field, value, `f_${field.id}`, true);
    case 'select': {
      const opts = (field.options || [])
        .map((opt) => `<option value="${Utils.escapeHtml(opt)}"${opt === value ? ' selected' : ''}>${Utils.escapeHtml(opt)}</option>`)
        .join('');
      const placeholderLabel = field.placeholder ? Utils.escapeHtml(field.placeholder) : 'Izberi …';
      return `<select id="f_${field.id}" name="${field.id}" ${req}>
        <option value="" disabled${value ? '' : ' selected'}>${placeholderLabel}</option>
        ${opts}
      </select>`;
    }
    case 'image':
      return `<input type="file" id="f_${field.id}" name="${field.id}" accept="image/*" />
        <div class="mf-image-preview" data-preview-for="f_${field.id}"></div>`;
    case 'document':
      return `<input type="file" id="f_${field.id}" name="${field.id}" accept="${DOCUMENT_ACCEPT}" />
        <div class="mf-doc-preview" data-preview-for="f_${field.id}"></div>`;
    case 'measurements':
      // Real widget is attached after render (attachMeasurementsWidget) — this
      // hidden input is what FormData actually reads on submit (JSON string).
      return `
        <input type="hidden" id="f_${field.id}" name="${field.id}" value="[]" />
        <div class="mf-measurements-chips" id="chips_${field.id}"></div>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="addmeasure_${field.id}">+ Dodaj mero</button>
        <div class="mf-measurement-add-form" id="addform_${field.id}" hidden></div>
      `;
    case 'group':
      return `
        <input type="hidden" id="f_${field.id}" name="${field.id}" value="[]" />
        <div class="mf-measurements-chips" id="groupitems_${field.id}"></div>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="addgroupitem_${field.id}">+ Dodaj</button>
        <div class="mf-measurement-add-form" id="addgroupform_${field.id}" hidden></div>
      `;
    default:
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} value="${Utils.escapeHtml(val)}"${placeholder} />`;
  }
}

function fieldHtml(field, existingValues, existingPhotoUrlsByField) {
  const value = existingValues ? existingValues[field.id] : undefined;
  let currentFileHint = '';
  if ((field.type === 'image' || field.type === 'document') && existingValues && existingValues[field.id]) {
    const existingFile = existingValues[field.id];
    const label = field.type === 'image' ? 'Trenutna slika ostane, če ne izbereš nove.' : `Trenutna priloga: ${Utils.escapeHtml(existingFile.name || 'dokument')} (ostane, če ne izbereš nove).`;
    const preview =
      field.type === 'image' && existingPhotoUrlsByField && existingPhotoUrlsByField[field.id]
        ? `<div class="mf-image-preview" aria-hidden="true"><img src="${existingPhotoUrlsByField[field.id]}" alt="" /></div>`
        : '';
    currentFileHint = `<p class="mf-field-hint">${label}</p>${preview}`;
  }
  return `
    <div class="mf-field" data-type="${field.type}" style="--field-accent:${field.color || Utils.DEFAULT_FIELD_COLOR}">
      <label for="f_${field.id}">${Utils.escapeHtml(field.label)}${field.required ? ' <span class="mf-required">*</span>' : ''}</label>
      ${fieldInputHtml(field, value)}
      ${currentFileHint}
    </div>
  `;
}

function updateTabDots(container, sections) {
  sections.forEach((section) => {
    const dot = container.querySelector(`[data-tab-dot="${section.id}"]`);
    if (!dot) return;
    const incomplete = section.fields.some((field) => {
      if (!field.required || field.type === 'image' || field.type === 'document') return false;
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

  const existingValues = isEdit ? existingEntry.values : null;
  const existingPhotoUrlsByField = {};
  if (isEdit) {
    for (const field of config.fields) {
      if (field.type === 'image' && existingValues[field.id] instanceof Blob) {
        try {
          existingPhotoUrlsByField[field.id] = URL.createObjectURL(existingValues[field.id]);
        } catch (err) {
          console.error('[FormBuilder] Failed to create preview URL for existing photo', err);
        }
      }
    }
  }

  const renderField = (field) => fieldHtml(field, existingValues, existingPhotoUrlsByField);

  const sections = Utils.groupFieldsIntoSections(config);
  const useTabs = sections.length > 1;

  let fieldsMarkup;
  if (useTabs) {
    const navHtml = `
      <div class="mf-tab-nav">
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-tab-prev">← Prejšnja skupina</button>
        <span class="mf-tab-position" id="mf-tab-position"></span>
        <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-tab-next">Naslednja skupina →</button>
      </div>
    `;
    fieldsMarkup = UI.renderTabsHtml(sections, (s) => s.fields.map(renderField).join(''), {
      tabButtonExtra: (s) => `<span class="mf-tab-dot" data-tab-dot="${s.id}" hidden></span>`,
      afterTabList: navHtml,
    });
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
    if (field.type === 'image') attachFilePreview(currentForm, `f_${field.id}`, 'image');
    else if (field.type === 'document') attachFilePreview(currentForm, `f_${field.id}`, 'document');
    else if (field.type === 'date') attachDateField(currentForm, `f_${field.id}`, existingValues ? existingValues[field.id] : null);
    else if (field.type === 'measurements') attachMeasurementsWidget(field, currentForm, existingValues);
    else if (field.type === 'group') attachGroupWidget(field, currentForm, existingValues);
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

    for (const field of config.fields) {
      if (field.type === 'image' || field.type === 'document') {
        const file = formData.get(field.id);
        const chosenFile = file && file.size > 0 ? file : null;
        values[field.id] = isEdit ? chosenFile || undefined : chosenFile;
      } else if (field.type === 'date') {
        const raw = formData.get(field.id);
        try {
          values[field.id] = raw ? JSON.parse(raw) : null;
        } catch (err) {
          values[field.id] = null;
        }
      } else if (field.type === 'measurements' || field.type === 'group') {
        const raw = formData.get(field.id);
        try {
          values[field.id] = raw ? JSON.parse(raw) : [];
        } catch (err) {
          console.error('[FormBuilder] Failed to parse JSON field', field.id, err);
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
          if (!f.required) return false;
          if (f.type === 'measurements' || f.type === 'group') return !Array.isArray(values[f.id]) || values[f.id].length === 0;
          if (f.type === 'date') return !values[f.id] || !values[f.id].value;
          if (f.type === 'image' || f.type === 'document') return !values[f.id];
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

    const payload = { values, configVersion: config.version };
    if (isEdit) payload.entryId = existingEntry.id;

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
    currentContainer.querySelectorAll('.mf-image-preview, .mf-doc-preview').forEach((el) => (el.innerHTML = ''));
  }
}

function destroy() {
  if (currentContainer) currentContainer.innerHTML = '';
  currentContainer = null;
  currentForm = null;
}

const FormBuilder = { build, reset, destroy };

export default FormBuilder;
