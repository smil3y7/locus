// /js/app.js
// BOOTSTRAP ONLY: init DB/config, init modules, wire top-level buttons.
// No business logic lives here — it delegates to each module's public API.

import EventBus from './eventBus.js';
import ConfigService from './configService.js';
import FormBuilder from './formBuilder.js';
import Storage from './storage.js';
import Viewer from './viewer.js';
import UI from './ui.js';
import Utils from './utils.js';
import AdminAuth from './adminAuth.js';
import SessionService from './sessionService.js';
import ExportImport from './exportImport.js';
import DB from './db.js';

async function openAddEntryModal() {
  const session = await SessionService.getSession();

  if (!session || !session.userName) {
    UI.toast({ type: 'info', message: 'Najprej nastavi ime vnašalca za to sejo.' });
    openSessionSettingsModal();
    return;
  }

  const config = await ConfigService.getLiveConfig();
  const container = document.createElement('div');
  UI.openModal({ title: 'Dodaj predmet', content: container, wide: true });
  FormBuilder.build(container, config);
}

async function openEditEntryModal(entry, config) {
  const container = document.createElement('div');
  UI.openModal({ title: 'Uredi predmet', content: container, wide: true });
  FormBuilder.build(container, config, { entry });
}

function fieldTypeOptions() {
  return `
    <option value="text">Besedilo</option>
    <option value="number">Število</option>
    <option value="date">Datum</option>
    <option value="select">Izbira (select)</option>
    <option value="image">Slika</option>
    <option value="document">Dokument (PDF ipd.)</option>
    <option value="link">Povezava (URL)</option>
    <option value="measurements">Mere (CDWA: vrsta + vrednost + enota)</option>
    <option value="group">Skupina (sklop pod-polj)</option>
  `;
}

function subFieldTypeOptions() {
  return `
    <option value="text">Besedilo</option>
    <option value="number">Število</option>
    <option value="date">Datum</option>
    <option value="select">Izbira (select)</option>
    <option value="image">Slika</option>
    <option value="document">Dokument</option>
    <option value="link">Povezava (URL)</option>
  `;
}

// ---------------------------------------------------------------------
// "Skupine" tab — groups (kartice), their order, and their razdelki
// ---------------------------------------------------------------------

function renderGroupsTabContent(config) {
  const groups = config.groups || [];

  const groupBlocks = groups
    .map((g, i) => {
      const fieldCount = config.fields.filter((f) => f.group === g.id).length;
      const sections = g.sections || [];
      const sectionRows =
        sections
          .map(
            (s, si) => `
          <li class="mf-config-row" data-section-id="${s.id}">
            <button type="button" class="mf-icon-btn mf-move-section" data-group="${g.id}" data-id="${s.id}" data-dir="up" ${si === 0 ? 'disabled' : ''} aria-label="Premakni razdelek navzgor">&uarr;</button>
            <button type="button" class="mf-icon-btn mf-move-section" data-group="${g.id}" data-id="${s.id}" data-dir="down" ${si === sections.length - 1 ? 'disabled' : ''} aria-label="Premakni razdelek navzdol">&darr;</button>
            <span class="mf-config-row-label">${Utils.escapeHtml(s.label)}</span>
            <button type="button" class="mf-icon-btn mf-remove-section" data-group="${g.id}" data-id="${s.id}" aria-label="Odstrani razdelek">&times;</button>
          </li>
        `
          )
          .join('') || '<li class="mf-empty">Ni razdelkov — polja se prikažejo brez podnaslovov.</li>';

      return `
        <li class="mf-config-row mf-group-block-row" data-group-id="${g.id}">
          <div class="mf-group-row-header">
            <button type="button" class="mf-icon-btn mf-move-group" data-id="${g.id}" data-dir="up" ${i === 0 ? 'disabled' : ''} aria-label="Premakni skupino navzgor">&uarr;</button>
            <button type="button" class="mf-icon-btn mf-move-group" data-id="${g.id}" data-dir="down" ${i === groups.length - 1 ? 'disabled' : ''} aria-label="Premakni skupino navzdol">&darr;</button>
            <span class="mf-config-row-label">${Utils.escapeHtml(g.label)}</span>
            <span class="mf-config-row-type">${fieldCount} polj</span>
            <button type="button" class="mf-icon-btn mf-remove-group" data-id="${g.id}" aria-label="Odstrani skupino">&times;</button>
          </div>
          <div class="mf-group-sections">
            <span class="mf-config-group-heading">Razdelki v tej kartici</span>
            <ul class="mf-config-list">${sectionRows}</ul>
            <div class="mf-measurement-inline-fields">
              <input type="text" class="mf-new-section-label" data-group="${g.id}" placeholder="npr. Status in identifikacija" autocomplete="off" />
              <button type="button" class="mf-btn mf-btn-ghost mf-btn-small mf-add-section" data-group="${g.id}">+ Dodaj razdelek</button>
            </div>
          </div>
        </li>
      `;
    })
    .join('');

  return `
    <ul class="mf-config-list">${groupBlocks || '<li class="mf-empty">Ni skupin — polja bodo prikazana brez razvrstitve.</li>'}</ul>
    <form id="mf-add-group-form" class="mf-add-field-form">
      <div class="mf-field">
        <label for="cg-label">Nova skupina (kartica)</label>
        <input type="text" id="cg-label" required autocomplete="off" placeholder="npr. Fizične lastnosti" />
      </div>
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-ghost">Dodaj skupino</button>
      </div>
    </form>
  `;
}

function wireGroupsTab(wrapper, refresh) {
  wrapper.querySelectorAll('.mf-move-group').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await ConfigService.moveGroup(btn.dataset.id, btn.dataset.dir);
      await refresh();
    });
  });

  wrapper.querySelectorAll('.mf-remove-group').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await UI.confirm(
        'Odstraniti to skupino? Polja v njej ne bodo izbrisana, le prestavljena med "Brez skupine".',
        'Odstrani skupino'
      );
      if (!confirmed) return;
      await ConfigService.removeGroup(btn.dataset.id);
      await refresh();
    });
  });

  wrapper.querySelectorAll('.mf-move-section').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await ConfigService.moveSection(btn.dataset.group, btn.dataset.id, btn.dataset.dir);
      await refresh();
    });
  });

  wrapper.querySelectorAll('.mf-remove-section').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await UI.confirm(
        'Odstraniti ta razdelek? Polja vanj ne bodo izbrisana, le prestavljena med neuvrščena.',
        'Odstrani razdelek'
      );
      if (!confirmed) return;
      await ConfigService.removeSection(btn.dataset.group, btn.dataset.id);
      await refresh();
    });
  });

  wrapper.querySelectorAll('.mf-add-section').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const input = wrapper.querySelector(`.mf-new-section-label[data-group="${btn.dataset.group}"]`);
      const label = input.value.trim();
      if (!label) return;
      try {
        await ConfigService.addSection(btn.dataset.group, label);
        await refresh();
      } catch (err) {
        console.error('[App] addSection failed', err);
      }
    });
  });

  const addGroupForm = wrapper.querySelector('#mf-add-group-form');
  if (addGroupForm) {
    addGroupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const label = wrapper.querySelector('#cg-label').value.trim();
      if (!label) return;
      try {
        await ConfigService.addGroup({ label });
        await refresh();
      } catch (err) {
        console.error('[App] addGroup failed', err);
      }
    });
  }
}

// ---------------------------------------------------------------------
// "Polja" tab — field list (by group, in its own inner tabs) + field form
// ---------------------------------------------------------------------

function fieldRowHtml(f, isFirst, isLast) {
  return `
    <li class="mf-config-row" data-id="${f.id}" style="--field-accent:${f.color || Utils.DEFAULT_FIELD_COLOR}">
      <button type="button" class="mf-icon-btn mf-move-field" data-id="${f.id}" data-dir="up" ${isFirst ? 'disabled' : ''} aria-label="Premakni navzgor">&uarr;</button>
      <button type="button" class="mf-icon-btn mf-move-field" data-id="${f.id}" data-dir="down" ${isLast ? 'disabled' : ''} aria-label="Premakni navzdol">&darr;</button>
      <span class="mf-config-row-label">${Utils.escapeHtml(f.label)}</span>
      <span class="mf-config-row-type">${Utils.escapeHtml(f.type)}${f.required ? ' · obvezno' : ''}</span>
      <button type="button" class="mf-icon-btn mf-edit-field" data-id="${f.id}" aria-label="Uredi polje" title="Uredi">&#9998;</button>
      <button type="button" class="mf-icon-btn mf-remove-field" data-id="${f.id}" aria-label="Odstrani polje">&times;</button>
    </li>
  `;
}

function fieldRowsHtml(fields) {
  return fields.map((f, i) => fieldRowHtml(f, i === 0, i === fields.length - 1)).join('') || '<li class="mf-empty">Ni polj.</li>';
}

function renderFieldsListMarkup(config) {
  const fieldSectionEntries = Utils.groupFieldsIntoSections(config, {
    includeEmptyGroups: true,
    alwaysIncludeUngrouped: true,
  }).map((s) => (s.id === '__ungrouped' ? { ...s, label: 'Brez skupine' } : s));

  const useFieldTabs = fieldSectionEntries.length > 1;
  return useFieldTabs
    ? UI.renderTabsHtml(fieldSectionEntries, (s) => `<ul class="mf-config-list">${fieldRowsHtml(s.fields)}</ul>`)
    : fieldSectionEntries
        .map((s) => `<div class="mf-config-group-block"><span class="mf-config-group-heading">${Utils.escapeHtml(s.label)}</span><ul class="mf-config-list">${fieldRowsHtml(s.fields)}</ul></div>`)
        .join('');
}

function renderFieldFormMarkup(config) {
  const groupOptions = (config.groups || []).map((g) => `<option value="${g.id}">${Utils.escapeHtml(g.label)}</option>`).join('');

  return `
    <p class="mf-config-section-title" id="cf-form-title">Novo polje</p>
    <form id="mf-add-field-form" class="mf-add-field-form">
      <input type="hidden" id="cf-edit-id" value="" />
      <div class="mf-field">
        <label for="cf-label">Ime polja</label>
        <input type="text" id="cf-label" required autocomplete="off" />
      </div>
      <div class="mf-field">
        <label for="cf-group">Skupina</label>
        <select id="cf-group">
          <option value="">Brez skupine</option>
          ${groupOptions}
        </select>
      </div>
      <div class="mf-field" id="cf-section-wrap" style="display:none">
        <label for="cf-section">Razdelek</label>
        <select id="cf-section"><option value="">Brez razdelka</option></select>
      </div>
      <div class="mf-field">
        <label for="cf-type">Tip polja</label>
        <select id="cf-type">${fieldTypeOptions()}</select>
      </div>
      <div class="mf-field" id="cf-options-wrap" style="display:none">
        <label for="cf-options">Možnosti (ločene z vejico)</label>
        <input type="text" id="cf-options" autocomplete="off" placeholder="npr. Dobro, Slabo" />
      </div>
      <div class="mf-field" id="cf-placeholder-wrap">
        <label for="cf-placeholder">Namig (placeholder)</label>
        <input type="text" id="cf-placeholder" autocomplete="off" placeholder="npr. npr. 2023.145" />
        <p class="mf-field-hint">Sivo besedilo v praznem polju, ki nakaže pričakovan format. Ni nadomestilo za ime polja.</p>
      </div>
      <div class="mf-field mf-field-inline" id="cf-fixed-precision-wrap" style="display:none">
        <label for="cf-fixed-precision">Vedno točen dan (brez izbire natančnosti)</label>
        <input type="checkbox" id="cf-fixed-precision" />
      </div>
      <div class="mf-field mf-field-inline">
        <label for="cf-color">Barva oznake</label>
        <input type="color" id="cf-color" value="${Utils.DEFAULT_FIELD_COLOR}" />
      </div>
      <p class="mf-field-hint">Poljem, ki spadajo skupaj (ne glede na skupino/zavihek), lahko dodeliš isto barvo, da jih uporabnik prepozna na prvi pogled.</p>
      <div class="mf-field mf-field-inline">
        <label for="cf-bg-highlight">Poudari z barvo ozadja</label>
        <input type="checkbox" id="cf-bg-highlight" />
      </div>
      <p class="mf-field-hint">Polje dobi rahlo obarvano ozadje (v izbrani barvi) namesto samo obrobe — za polja, ki naj resnično izstopajo.</p>
      <div class="mf-field" id="cf-measurement-types-wrap" style="display:none">
        <label>Dovoljene vrste mer</label>
        <ul class="mf-config-list" id="cf-measurement-types-list"></ul>
        <div class="mf-measurement-inline-fields">
          <input type="text" id="cf-mtype-label" placeholder="npr. Višina" autocomplete="off" />
          <input type="text" id="cf-mtype-units" placeholder="Enote, ločene z vejico (npr. cm, mm, m)" autocomplete="off" />
        </div>
        <div class="mf-form-actions">
          <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="cf-mtype-add">+ Dodaj vrsto mere</button>
        </div>
        <p class="mf-field-hint">Uporabnik bo pri vnosu izbral eno od teh vrst (npr. Višina, Teža, Premer) in vnesel vrednost v eni od dovoljenih enot.</p>
      </div>
      <div class="mf-field" id="cf-subfields-wrap" style="display:none">
        <label>Pod-polja skupine</label>
        <ul class="mf-config-list" id="cf-subfields-list"></ul>
        <div class="mf-measurement-inline-fields">
          <input type="text" id="cf-subfield-label" placeholder="npr. Avtor fotografije" autocomplete="off" />
          <select id="cf-subfield-type">${subFieldTypeOptions()}</select>
          <input type="text" id="cf-subfield-options" placeholder="Možnosti za izbiro, ločene z vejico" autocomplete="off" style="display:none" />
          <label class="mf-field-inline"><input type="checkbox" id="cf-subfield-required" /> Obvezno</label>
        </div>
        <div class="mf-form-actions">
          <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="cf-subfield-add">+ Dodaj pod-polje</button>
        </div>
        <p class="mf-field-hint">Vsak primerek te skupine (npr. ena fotografija) bo imel vnos za vsako od teh pod-polj.</p>
        <div class="mf-field mf-field-inline" id="cf-repeatable-wrap">
          <label for="cf-repeatable">Ponavljajoča (dovoli več primerkov)</label>
          <input type="checkbox" id="cf-repeatable" checked />
        </div>
        <p class="mf-field-hint">Če ni ponavljajoča, se pod-polja prikažejo enkrat, brez gumba "+ Dodaj" (npr. "Čas izdelave", "Avers/Revers").</p>
      </div>
      <div class="mf-field mf-field-inline">
        <label for="cf-required">Obvezno polje</label>
        <input type="checkbox" id="cf-required" />
      </div>
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-primary" id="cf-submit-btn">Dodaj polje</button>
        <button type="button" class="mf-btn mf-btn-ghost" id="cf-cancel-edit" style="display:none">Prekliči urejanje</button>
      </div>
    </form>
  `;
}

function wireFieldsTab(wrapper, config, refresh, restore) {
  const typeSelect = wrapper.querySelector('#cf-type');
  const optionsWrap = wrapper.querySelector('#cf-options-wrap');
  const placeholderWrap = wrapper.querySelector('#cf-placeholder-wrap');
  const fixedPrecisionWrap = wrapper.querySelector('#cf-fixed-precision-wrap');
  const fixedPrecisionInput = wrapper.querySelector('#cf-fixed-precision');
  const measurementTypesWrap = wrapper.querySelector('#cf-measurement-types-wrap');
  const measurementTypesList = wrapper.querySelector('#cf-measurement-types-list');
  const placeholderInput = wrapper.querySelector('#cf-placeholder');
  const subFieldsWrap = wrapper.querySelector('#cf-subfields-wrap');
  const subFieldsList = wrapper.querySelector('#cf-subfields-list');
  const repeatableInput = wrapper.querySelector('#cf-repeatable');
  const groupSelect = wrapper.querySelector('#cf-group');
  const sectionWrap = wrapper.querySelector('#cf-section-wrap');
  const sectionSelect = wrapper.querySelector('#cf-section');

  let currentMeasurementTypes = [];
  let currentSubFields = [];

  function renderMeasurementTypesList() {
    measurementTypesList.innerHTML =
      currentMeasurementTypes
        .map(
          (t, i) => `
        <li class="mf-config-row" data-index="${i}">
          <span class="mf-config-row-label">${Utils.escapeHtml(t.label)}</span>
          <span class="mf-config-row-type">${Utils.escapeHtml((t.units || []).join(', ')) || 'brez enot'}</span>
          <button type="button" class="mf-icon-btn mf-remove-mtype" data-index="${i}" aria-label="Odstrani vrsto mere">&times;</button>
        </li>
      `
        )
        .join('') || '<li class="mf-empty">Ni še dodanih vrst mer.</li>';

    measurementTypesList.querySelectorAll('.mf-remove-mtype').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentMeasurementTypes.splice(Number(btn.dataset.index), 1);
        renderMeasurementTypesList();
      });
    });
  }

  function renderSubFieldsList() {
    subFieldsList.innerHTML =
      currentSubFields
        .map(
          (sf, i) => `
        <li class="mf-config-row" data-index="${i}">
          <span class="mf-config-row-label">${Utils.escapeHtml(sf.label)}</span>
          <span class="mf-config-row-type">${Utils.escapeHtml(sf.type)}${sf.required ? ' · obvezno' : ''}</span>
          <button type="button" class="mf-icon-btn mf-move-subfield" data-index="${i}" data-dir="up" ${i === 0 ? 'disabled' : ''} aria-label="Premakni navzgor">&uarr;</button>
          <button type="button" class="mf-icon-btn mf-move-subfield" data-index="${i}" data-dir="down" ${i === currentSubFields.length - 1 ? 'disabled' : ''} aria-label="Premakni navzdol">&darr;</button>
          <button type="button" class="mf-icon-btn mf-remove-subfield" data-index="${i}" aria-label="Odstrani pod-polje">&times;</button>
        </li>
      `
        )
        .join('') || '<li class="mf-empty">Ni še dodanih pod-polj.</li>';

    subFieldsList.querySelectorAll('.mf-remove-subfield').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentSubFields.splice(Number(btn.dataset.index), 1);
        renderSubFieldsList();
      });
    });
    subFieldsList.querySelectorAll('.mf-move-subfield').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.index);
        const swap = btn.dataset.dir === 'up' ? idx - 1 : idx + 1;
        if (swap < 0 || swap >= currentSubFields.length) return;
        [currentSubFields[idx], currentSubFields[swap]] = [currentSubFields[swap], currentSubFields[idx]];
        renderSubFieldsList();
      });
    });
  }

  function refreshSectionOptions() {
    const groupId = groupSelect.value;
    const groupDef = (config.groups || []).find((g) => g.id === groupId);
    const sections = groupDef ? groupDef.sections || [] : [];
    sectionSelect.innerHTML =
      '<option value="">Brez razdelka</option>' +
      sections.map((s) => `<option value="${s.id}">${Utils.escapeHtml(s.label)}</option>`).join('');
    sectionWrap.style.display = sections.length > 0 ? '' : 'none';
  }

  function updateVisibilityForType() {
    const type = typeSelect.value;
    optionsWrap.style.display = type === 'select' ? '' : 'none';
    measurementTypesWrap.style.display = type === 'measurements' ? '' : 'none';
    subFieldsWrap.style.display = type === 'group' ? '' : 'none';
    fixedPrecisionWrap.style.display = type === 'date' ? '' : 'none';
    placeholderWrap.style.display = ['image', 'document', 'measurements', 'group'].includes(type) ? 'none' : '';
  }

  typeSelect.addEventListener('change', updateVisibilityForType);
  groupSelect.addEventListener('change', refreshSectionOptions);
  updateVisibilityForType();
  refreshSectionOptions();
  renderMeasurementTypesList();
  renderSubFieldsList();

  if (restore.lastGroup) {
    groupSelect.value = restore.lastGroup;
    refreshSectionOptions();
  }

  const subFieldTypeSelect = wrapper.querySelector('#cf-subfield-type');
  const subFieldOptionsInput = wrapper.querySelector('#cf-subfield-options');
  subFieldTypeSelect.addEventListener('change', () => {
    subFieldOptionsInput.style.display = subFieldTypeSelect.value === 'select' ? '' : 'none';
  });

  wrapper.querySelector('#cf-subfield-add').addEventListener('click', () => {
    const labelInputEl = wrapper.querySelector('#cf-subfield-label');
    const requiredInputEl = wrapper.querySelector('#cf-subfield-required');
    const label = labelInputEl.value.trim();
    if (!label) return;
    const options = subFieldOptionsInput.value.split(',').map((o) => o.trim()).filter(Boolean);
    currentSubFields.push({ label, type: subFieldTypeSelect.value, required: requiredInputEl.checked, options });
    renderSubFieldsList();
    labelInputEl.value = '';
    subFieldOptionsInput.value = '';
    requiredInputEl.checked = false;
  });

  wrapper.querySelector('#cf-mtype-add').addEventListener('click', () => {
    const labelInputEl = wrapper.querySelector('#cf-mtype-label');
    const unitsInputEl = wrapper.querySelector('#cf-mtype-units');
    const label = labelInputEl.value.trim();
    if (!label) return;
    const units = unitsInputEl.value.split(',').map((u) => u.trim()).filter(Boolean);
    currentMeasurementTypes.push({ label, units });
    renderMeasurementTypesList();
    labelInputEl.value = '';
    unitsInputEl.value = '';
  });

  const fieldListTabController = UI.tabify(wrapper.querySelector('#mf-fields-list-wrap'));
  if (restore.activeFieldTab && fieldListTabController) {
    fieldListTabController.activate(restore.activeFieldTab);
  }

  const formTitle = wrapper.querySelector('#cf-form-title');
  const editIdInput = wrapper.querySelector('#cf-edit-id');
  const submitBtn = wrapper.querySelector('#cf-submit-btn');
  const cancelEditBtn = wrapper.querySelector('#cf-cancel-edit');
  const labelInput = wrapper.querySelector('#cf-label');
  const requiredInput = wrapper.querySelector('#cf-required');
  const optionsInput = wrapper.querySelector('#cf-options');
  const colorInput = wrapper.querySelector('#cf-color');
  const bgHighlightInput = wrapper.querySelector('#cf-bg-highlight');

  function enterEditMode(field) {
    editIdInput.value = field.id;
    labelInput.value = field.label;
    groupSelect.value = field.group || '';
    refreshSectionOptions();
    sectionSelect.value = field.section || '';
    typeSelect.value = field.type;
    updateVisibilityForType();
    optionsInput.value = (field.options || []).join(', ');
    placeholderInput.value = field.placeholder || '';
    colorInput.value = field.color || Utils.DEFAULT_FIELD_COLOR;
    bgHighlightInput.checked = Boolean(field.backgroundHighlight);
    fixedPrecisionInput.checked = Boolean(field.fixedPrecision);
    repeatableInput.checked = field.repeatable !== false;
    currentMeasurementTypes = field.measurementTypes ? Utils.deepClone(field.measurementTypes) : [];
    renderMeasurementTypesList();
    currentSubFields = field.subFields ? Utils.deepClone(field.subFields) : [];
    renderSubFieldsList();
    requiredInput.checked = Boolean(field.required);
    formTitle.textContent = `Urejaš polje: ${field.label}`;
    submitBtn.textContent = 'Shrani spremembe';
    cancelEditBtn.style.display = '';
    wrapper.querySelector('#mf-add-field-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function exitEditMode() {
    editIdInput.value = '';
    wrapper.querySelector('#mf-add-field-form').reset();
    currentMeasurementTypes = [];
    renderMeasurementTypesList();
    currentSubFields = [];
    renderSubFieldsList();
    updateVisibilityForType();
    refreshSectionOptions();
    formTitle.textContent = 'Novo polje';
    submitBtn.textContent = 'Dodaj polje';
    cancelEditBtn.style.display = 'none';
  }

  cancelEditBtn.addEventListener('click', exitEditMode);

  wrapper.querySelectorAll('.mf-edit-field').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = config.fields.find((f) => f.id === btn.dataset.id);
      if (field) enterEditMode(field);
    });
  });

  wrapper.querySelectorAll('.mf-move-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await ConfigService.moveField(btn.dataset.id, btn.dataset.dir);
      await refresh();
    });
  });

  wrapper.querySelectorAll('.mf-remove-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await UI.confirm('Odstraniti to polje iz obrazca?', 'Odstrani polje');
      if (!confirmed) return;
      await ConfigService.removeField(btn.dataset.id);
      await refresh();
    });
  });

  wrapper.querySelector('#mf-add-field-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = labelInput.value.trim();
    const group = groupSelect.value || null;
    const section = sectionSelect.value || null;
    const type = typeSelect.value;
    const required = requiredInput.checked;
    const optionsRaw = optionsInput.value.trim();
    const options = optionsRaw ? optionsRaw.split(',').map((o) => o.trim()).filter(Boolean) : [];
    const placeholder = placeholderInput.value.trim();
    const color = colorInput.value;
    const backgroundHighlight = bgHighlightInput.checked;
    const fixedPrecision = type === 'date' && fixedPrecisionInput.checked ? 'day' : null;
    const repeatable = repeatableInput.checked;

    if (!label) return;

    if (type === 'measurements' && currentMeasurementTypes.length === 0) {
      UI.toast({ type: 'error', message: 'Dodaj vsaj eno vrsto mere (npr. Višina), preden shraniš polje.' });
      return;
    }

    if (type === 'group' && currentSubFields.length === 0) {
      UI.toast({ type: 'error', message: 'Dodaj vsaj eno pod-polje (npr. Avtor fotografije), preden shraniš skupino.' });
      return;
    }

    const editingId = editIdInput.value;
    const fieldPayload = {
      label,
      type,
      required,
      options,
      group,
      section,
      placeholder,
      color,
      backgroundHighlight,
      fixedPrecision,
      repeatable,
      measurementTypes: currentMeasurementTypes,
      subFields: currentSubFields,
    };

    try {
      if (editingId) {
        await ConfigService.updateField(editingId, fieldPayload);
      } else {
        await ConfigService.addField({ id: Utils.slugify(label) + '_' + Date.now().toString(36).slice(-4), ...fieldPayload });
      }
      await refresh();
    } catch (err) {
      console.error('[App] field save failed', err);
    }
  });
}

// ---------------------------------------------------------------------
// "Nastavitve in podatki" tab — PIN, schema publish/import/template, DB tools
// ---------------------------------------------------------------------

function renderSettingsTabContent() {
  return `
    <div class="mf-config-toolbar">
      <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-change-pin-btn">Spremeni admin PIN</button>
    </div>

    <p class="mf-draft-notice">
      Tu urejaš <strong>osnutek</strong> sheme — spremembe ne vplivajo na obrazec, ki ga trenutno vidijo uporabniki,
      dokler osnutka ne izvoziš kot <code>config.json</code> in ga ne objaviš (zamenjaj datoteko v repozitoriju,
      <code>git push</code>, Vercel samodejno objavi).
    </p>
    <div class="mf-form-actions">
      <button type="button" class="mf-btn mf-btn-primary" id="mf-export-schema-btn">Izvozi shemo obrazca (config.json)</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-reset-draft-btn">Ponastavi osnutek na objavljeno shemo</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-import-schema-btn">Uvozi shemo (JSON)</button>
      <input type="file" id="mf-import-schema-input" accept="application/json" style="display:none" />
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-load-spectrum-btn">Naloži predlogo: SPECTRUM jedro</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-load-spectrum-detailed-btn">Naloži predlogo: SPECTRUM podrobno (10 kartic)</button>
    </div>

    <hr class="mf-divider" />

    <p class="mf-config-section-title">Upravljanje podatkov</p>
    <div class="mf-form-actions">
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-export-btn">Izvozi bazo</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-import-btn">Uvozi bazo</button>
      <button type="button" class="mf-btn mf-btn-danger" id="mf-reset-btn">Ponastavi bazo</button>
      <input type="file" id="mf-import-input" accept="application/json" style="display:none" />
    </div>
    <p class="mf-field-hint">Izvoz vključuje vse vnose, slike/dokumente in trenutno objavljeno konfiguracijo obrazca. Ponastavitev izbriše vnose in podatke seje na tem računalniku — objavljena shema in PIN ostaneta.</p>
  `;
}

function wireSettingsTab(wrapper, refresh) {
  wrapper.querySelector('#mf-export-schema-btn').addEventListener('click', () => {
    ConfigService.exportDraftFile();
  });

  wrapper.querySelector('#mf-reset-draft-btn').addEventListener('click', async () => {
    const confirmed = await UI.confirm(
      'To bo prepisalo trenutni osnutek z zadnjo objavljeno shemo. Neizvožene spremembe v osnutku bodo izgubljene. Nadaljujem?',
      'Ponastavi osnutek'
    );
    if (!confirmed) return;
    await ConfigService.resetDraftToLive();
    await refresh();
  });

  const importSchemaInput = wrapper.querySelector('#mf-import-schema-input');
  wrapper.querySelector('#mf-import-schema-btn').addEventListener('click', () => importSchemaInput.click());
  importSchemaInput.addEventListener('change', async () => {
    const file = importSchemaInput.files && importSchemaInput.files[0];
    importSchemaInput.value = '';
    if (!file) return;
    const confirmed = await UI.confirm(
      `To bo prepisalo trenutni osnutek z vsebino datoteke "${file.name}". Neizvožene spremembe v osnutku bodo izgubljene. Nadaljujem?`,
      'Uvozi shemo'
    );
    if (!confirmed) return;
    try {
      const text = await file.text();
      await ConfigService.importDraftFromObject(JSON.parse(text));
      await refresh();
    } catch (err) {
      console.error('[App] Schema import failed', err);
      UI.toast({ type: 'error', message: 'Datoteke ni bilo mogoče prebrati kot veljavno shemo (JSON).' });
    }
  });

  wrapper.querySelector('#mf-load-spectrum-btn').addEventListener('click', async () => {
    const confirmed = await UI.confirm(
      'To bo prepisalo trenutni osnutek s predlogo SPECTRUM jedro. Neizvožene spremembe v osnutku bodo izgubljene. Nadaljujem?',
      'Naloži predlogo'
    );
    if (!confirmed) return;
    try {
      await ConfigService.loadTemplate('./templates/spectrum-core.json');
      await refresh();
    } catch (err) {
      console.error('[App] Template load failed', err);
    }
  });

  wrapper.querySelector('#mf-load-spectrum-detailed-btn').addEventListener('click', async () => {
    const confirmed = await UI.confirm(
      'To bo prepisalo trenutni osnutek s podrobno predlogo SPECTRUM (10 kartic, ~65 polj). Neizvožene spremembe v osnutku bodo izgubljene. Nadaljujem?',
      'Naloži predlogo'
    );
    if (!confirmed) return;
    try {
      await ConfigService.loadTemplate('./templates/spectrum-podrobno.json');
      await refresh();
    } catch (err) {
      console.error('[App] Template load failed', err);
    }
  });

  wrapper.querySelector('#mf-change-pin-btn').addEventListener('click', changeAdminPin);

  wrapper.querySelector('#mf-export-btn').addEventListener('click', () => {
    ExportImport.exportArchive();
  });

  const importInput = wrapper.querySelector('#mf-import-input');
  wrapper.querySelector('#mf-import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (!file) return;
    await ExportImport.importArchive(file);
  });

  wrapper.querySelector('#mf-reset-btn').addEventListener('click', async () => {
    const confirmed = await UI.confirm(
      'To bo trajno izbrisalo VSE vnesene predmete in podatke seje na tem računalniku. Konfiguracija obrazca in PIN ostaneta nespremenjena. Priporočamo, da pred tem izvoziš bazo. Nadaljujem?',
      'Ponastavi bazo'
    );
    if (!confirmed) return;
    await Storage.clearAllEntries();
    await SessionService.clearSession();
    UI.toast({ type: 'success', message: 'Baza je ponastavljena in pripravljena za naslednjo skupino.' });
  });
}

// ---------------------------------------------------------------------
// Top-level admin editor: outer tabs = Skupine | Polja | Nastavitve in podatki
// ---------------------------------------------------------------------

async function renderConfigEditorBody(restore = {}) {
  const config = await ConfigService.getDraftConfig();

  const outerSections = [
    { id: 'groups', label: 'Skupine' },
    { id: 'fields', label: 'Polja' },
    { id: 'settings', label: 'Nastavitve in podatki' },
  ];

  const wrapper = document.createElement('div');
  wrapper.className = 'mf-config-editor';
  wrapper.innerHTML = UI.renderTabsHtml(outerSections, (s) => {
    if (s.id === 'groups') return `<div class="mf-outer-tab-panel">${renderGroupsTabContent(config)}</div>`;
    if (s.id === 'fields')
      return `
        <div class="mf-outer-tab-panel">
          <p class="mf-config-section-title">Polja obrazca</p>
          <div id="mf-fields-list-wrap">${renderFieldsListMarkup(config)}</div>
          <hr class="mf-divider" />
          ${renderFieldFormMarkup(config)}
        </div>
      `;
    return `<div class="mf-outer-tab-panel">${renderSettingsTabContent()}</div>`;
  });

  const outerTabController = UI.tabify(wrapper);
  if (restore.activeOuterTab && outerTabController) outerTabController.activate(restore.activeOuterTab);

  const refresh = () => refreshConfigEditor(wrapper);

  wireGroupsTab(wrapper, refresh);
  wireFieldsTab(wrapper, config, refresh, restore);
  wireSettingsTab(wrapper, refresh);

  return wrapper;
}

async function refreshConfigEditor(oldWrapper) {
  const activeOuterBtn = oldWrapper.querySelector('.mf-tab-btn-active');
  const innerFieldsWrap = oldWrapper.querySelector('#mf-fields-list-wrap');
  const activeInnerBtn = innerFieldsWrap ? innerFieldsWrap.querySelector('.mf-tab-btn-active') : null;
  const groupSelect = oldWrapper.querySelector('#cf-group');
  const scrollParent = oldWrapper.closest('.mf-modal-body');

  const restore = {
    activeOuterTab: activeOuterBtn ? activeOuterBtn.dataset.tab : null,
    activeFieldTab: activeInnerBtn ? activeInnerBtn.dataset.tab : null,
    lastGroup: groupSelect ? groupSelect.value : '',
  };
  const scrollTop = scrollParent ? scrollParent.scrollTop : 0;

  const fresh = await renderConfigEditorBody(restore);
  oldWrapper.replaceWith(fresh);

  const newScrollParent = fresh.closest('.mf-modal-body');
  if (newScrollParent) newScrollParent.scrollTop = scrollTop;
}

async function openConfigEditorModal() {
  const body = await renderConfigEditorBody();
  UI.openModal({ title: 'Uredi obrazec', content: body, wide: true });
}

async function changeAdminPin() {
  const oldPin = await UI.promptPin('Vnesi trenutni PIN');
  if (oldPin === null) return;
  const valid = await AdminAuth.verifyPin(oldPin);
  if (!valid) {
    UI.toast({ type: 'error', message: 'Napačen trenutni PIN.' });
    return;
  }
  const newPin = await UI.promptPin('Vnesi nov PIN (najmanj 4 znake)');
  if (newPin === null) return;
  const confirmPin = await UI.promptPin('Ponovi nov PIN');
  if (confirmPin === null) return;
  if (newPin !== confirmPin) {
    UI.toast({ type: 'error', message: 'Novi PIN-a se ne ujemata.' });
    return;
  }
  try {
    await AdminAuth.setPin(newPin);
  } catch (err) {
    console.error('[App] changeAdminPin failed', err);
  }
}

async function guardedOpenConfigEditor() {
  let pinAlreadySet;
  try {
    pinAlreadySet = await AdminAuth.hasPin();
  } catch (err) {
    return; // AdminAuth already emitted ui:fatal
  }

  if (!pinAlreadySet) {
    const first = await UI.promptPin('Nastavi admin PIN za urejanje obrazca (najmanj 4 znake)');
    if (first === null) return;
    const confirmPin = await UI.promptPin('Ponovi PIN za potrditev');
    if (confirmPin === null) return;
    if (first !== confirmPin) {
      UI.toast({ type: 'error', message: 'PIN-a se ne ujemata. Poskusi znova.' });
      return;
    }
    try {
      await AdminAuth.setPin(first);
    } catch (err) {
      return; // AdminAuth already emitted a toast/banner on failure
    }
    openConfigEditorModal();
    return;
  }

  const pin = await UI.promptPin('Vnesi admin PIN za urejanje obrazca');
  if (pin === null) return;

  let valid;
  try {
    valid = await AdminAuth.verifyPin(pin);
  } catch (err) {
    return; // AdminAuth already emitted ui:fatal
  }

  if (!valid) {
    UI.toast({ type: 'error', message: 'Napačen PIN.' });
    return;
  }

  openConfigEditorModal();
}

async function openSessionSettingsModal() {
  const session = await SessionService.getSession();

  const content = document.createElement('div');
  content.innerHTML = `
    <form id="mf-session-form" novalidate>
      <div class="mf-field">
        <label for="ss-training-title">Naslov izobraževanja</label>
        <input type="text" id="ss-training-title" autocomplete="off" value="${Utils.escapeHtml(session?.trainingTitle || '')}" placeholder="npr. Osnove katalogizacije" />
      </div>
      <div class="mf-field">
        <label for="ss-user-name">Ime vnašalca</label>
        <input type="text" id="ss-user-name" autocomplete="off" value="${Utils.escapeHtml(session?.userName || '')}" placeholder="npr. Janez Novak" />
      </div>
      <p class="mf-field-hint">To ime se bo prikazovalo na obrazcu za vnos predmetov za celotno sejo in se uporabi za poimenovanje izvožene datoteke.</p>
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-primary">Shrani</button>
        <button type="button" class="mf-btn mf-btn-ghost" id="mf-session-cancel">Prekliči</button>
      </div>
    </form>
  `;

  UI.openModal({ title: 'Nastavitve seje', content });

  content.querySelector('#mf-session-cancel').addEventListener('click', () => EventBus.emit('ui:closeModal'));

  content.querySelector('#mf-session-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const trainingTitle = content.querySelector('#ss-training-title').value.trim();
    const userName = content.querySelector('#ss-user-name').value.trim();
    try {
      await SessionService.startSession({ trainingTitle, userName });
      UI.closeModal();
    } catch (err) {
      console.error('[App] Failed to save session settings', err);
    }
  });
}

async function printCatalog() {
  const [entries, config, session] = await Promise.all([
    DB.getAllEntries(),
    ConfigService.getLiveConfig(),
    SessionService.getSession(),
  ]);

  if (entries.length === 0) {
    UI.toast({ type: 'info', message: 'Zbirka je prazna — ni česa natisniti.' });
    return;
  }

  // Keep the printed catalogue to a reasonable width: inventory number,
  // title/naziv, and up to two more short, single-value fields. Document and
  // group fields don't summarize well in a compact table cell, so they're
  // left out of the catalogue view (still visible on each entry's own
  // printed card).
  const previewFields = config.fields
    .filter((f) => ['text', 'number', 'select', 'date', 'measurements', 'link'].includes(f.type) && f.id !== 'inventory_number' && f.id !== 'title')
    .slice(0, 3);

  const headerCells = ['Inv. št.', 'Naziv', ...previewFields.map((f) => f.label), 'Datum vnosa']
    .map((h) => `<th>${Utils.escapeHtml(h)}</th>`)
    .join('');

  const rows = entries
    .sort((a, b) => a.created - b.created)
    .map((entry) => {
      const inv = entry.values.inventory_number || '—';
      const title = entry.values.title || '—';
      const cells = previewFields
        .map((f) => {
          let val;
          if (f.type === 'measurements') val = Utils.formatMeasurements(entry.values[f.id], f);
          else if (f.type === 'date') val = Utils.formatPartialDate(entry.values[f.id]);
          else val = entry.values[f.id];
          return `<td>${Utils.escapeHtml(val) || '—'}</td>`;
        })
        .join('');
      return `<tr><td>${Utils.escapeHtml(inv)}</td><td>${Utils.escapeHtml(title)}</td>${cells}<td>${Utils.formatDate(entry.created)}</td></tr>`;
    })
    .join('');

  const html = `
    <div class="mf-print-catalog">
      <div class="mf-print-header">
        <span class="mf-print-eyebrow">LOCUS · Muzejska dokumentacijska platforma</span>
        <h2>${Utils.escapeHtml(session?.trainingTitle || 'Katalog predmetov')}</h2>
        <span class="mf-print-inventory">${entries.length} predmetov ${session?.userName ? '· ' + Utils.escapeHtml(session.userName) : ''}</span>
      </div>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  UI.printHtml(html);
}

function wireHeaderButtons() {
  const addBtn = document.getElementById('mf-add-entry-btn');
  const configBtn = document.getElementById('mf-edit-config-btn');
  const sessionBtn = document.getElementById('mf-session-btn');
  const printCatalogBtn = document.getElementById('mf-print-catalog-btn');

  if (addBtn) addBtn.addEventListener('click', openAddEntryModal);
  if (configBtn) configBtn.addEventListener('click', guardedOpenConfigEditor);
  if (sessionBtn) sessionBtn.addEventListener('click', openSessionSettingsModal);
  if (printCatalogBtn) printCatalogBtn.addEventListener('click', printCatalog);
}

function wireGlobalFormSubmission() {
  EventBus.on('form:submitted', async (payload) => {
    if (payload.entryId) {
      const result = await Storage.updateEntry(payload.entryId, payload);
      if (result.success) UI.closeModal();
      return;
    }

    const result = await Storage.saveEntry(payload);
    if (result.success) UI.closeModal();
  });

  EventBus.on('entry:editRequested', ({ entry, config }) => {
    openEditEntryModal(entry, config);
  });
}

async function bootstrap() {
  UI.init();

  const versionEl = document.getElementById('mf-app-version');
  if (versionEl) versionEl.textContent = `LOCUS v${Utils.APP_VERSION}`;

  try {
    await ConfigService.getLiveConfig(); // warms the fetched/cached form schema; emits ui:fatal/ui:notify itself on failure
  } catch (err) {
    console.error('[App] Failed to initialize config — app will run in a degraded state', err);
  }

  const listContainer = document.getElementById('mf-entries-list');
  Viewer.init(listContainer);

  wireHeaderButtons();
  wireGlobalFormSubmission();
}

document.addEventListener('DOMContentLoaded', bootstrap);
