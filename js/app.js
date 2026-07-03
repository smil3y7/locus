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

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function openAddEntryModal() {
  const [config, session] = await Promise.all([ConfigService.getConfig(), SessionService.getSession()]);
  const container = document.createElement('div');
  UI.openModal({ title: 'Dodaj predmet', content: container });
  FormBuilder.build(container, config);
  injectEnteredByField(container, session);
}

function injectEnteredByField(container, session) {
  const form = container.querySelector('#mf-entry-form');
  if (!form) return;

  const locked = Boolean(session && session.userName);
  const currentValue = locked ? session.userName : '';

  const wrapper = document.createElement('div');
  wrapper.className = 'mf-field';
  wrapper.innerHTML = `
    <label for="entered_by">Ime vnašalca <span class="mf-required">*</span></label>
    <input
      type="text"
      id="entered_by"
      name="entered_by"
      required
      autocomplete="off"
      value="${escapeHtml(currentValue)}"
      ${locked ? 'readonly' : ''}
    />
    ${locked ? '<p class="mf-field-hint">Za spremembo pojdi v "Nastavitve seje" v glavi strani.</p>' : ''}
  `;
  form.insertBefore(wrapper, form.firstChild);
}

async function openEditEntryModal(entry, config) {
  const container = document.createElement('div');
  UI.openModal({ title: 'Uredi predmet', content: container });
  FormBuilder.build(container, config, { entry });
}

function fieldTypeOptions() {
  return `
    <option value="text">Besedilo</option>
    <option value="number">Število</option>
    <option value="date">Datum</option>
    <option value="select">Izbira (select)</option>
    <option value="image">Slika</option>
  `;
}

async function renderConfigEditorBody() {
  const config = await ConfigService.getConfig();
  const groups = config.groups || [];

  const groupRows = groups
    .map(
      (g) => `
      <li class="mf-config-row" data-group-id="${g.id}">
        <span class="mf-config-row-label">${escapeHtml(g.label)}</span>
        <span class="mf-config-row-type">${config.fields.filter((f) => f.group === g.id).length} polj</span>
        <button type="button" class="mf-icon-btn mf-remove-group" data-id="${g.id}" aria-label="Odstrani skupino">&times;</button>
      </li>
    `
    )
    .join('');

  const fieldsByGroup = new Map(groups.map((g) => [g.id, []]));
  const ungroupedFields = [];
  for (const f of config.fields) {
    if (f.group && fieldsByGroup.has(f.group)) fieldsByGroup.get(f.group).push(f);
    else ungroupedFields.push(f);
  }

  function fieldRowHtml(f) {
    return `
      <li class="mf-config-row" data-id="${f.id}" style="--field-accent:${f.color || '#B8934A'}">
        <span class="mf-config-row-label">${escapeHtml(f.label)}</span>
        <span class="mf-config-row-type">${escapeHtml(f.type)}${f.required ? ' · obvezno' : ''}</span>
        <button type="button" class="mf-icon-btn mf-edit-field" data-id="${f.id}" aria-label="Uredi polje" title="Uredi">&#9998;</button>
        <button type="button" class="mf-icon-btn mf-remove-field" data-id="${f.id}" aria-label="Odstrani polje">&times;</button>
      </li>
    `;
  }

  const fieldSections = groups
    .map(
      (g) => `
      <div class="mf-config-group-block">
        <span class="mf-config-group-heading">${escapeHtml(g.label)}</span>
        <ul class="mf-config-list">${fieldsByGroup.get(g.id).map(fieldRowHtml).join('') || '<li class="mf-empty">Ni polj v tej skupini.</li>'}</ul>
      </div>
    `
    )
    .join('');

  const ungroupedSection = `
    <div class="mf-config-group-block">
      <span class="mf-config-group-heading">Brez skupine</span>
      <ul class="mf-config-list">${ungroupedFields.map(fieldRowHtml).join('') || '<li class="mf-empty">Ni polj.</li>'}</ul>
    </div>
  `;

  const groupOptions = groups.map((g) => `<option value="${g.id}">${escapeHtml(g.label)}</option>`).join('');

  const wrapper = document.createElement('div');
  wrapper.className = 'mf-config-editor';
  wrapper.innerHTML = `
    <div class="mf-config-toolbar">
      <button type="button" class="mf-btn mf-btn-ghost mf-btn-small" id="mf-change-pin-btn">Spremeni admin PIN</button>
    </div>

    <p class="mf-config-section-title">Upravljanje podatkov</p>
    <div class="mf-form-actions">
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-export-btn">Izvozi bazo</button>
      <button type="button" class="mf-btn mf-btn-ghost" id="mf-import-btn">Uvozi bazo</button>
      <button type="button" class="mf-btn mf-btn-danger" id="mf-reset-btn">Ponastavi bazo</button>
      <input type="file" id="mf-import-input" accept="application/json" style="display:none" />
    </div>
    <p class="mf-field-hint">Izvoz vključuje vse vnose, slike in konfiguracijo obrazca. Ponastavitev izbriše vnose in podatke seje na tem računalniku — konfiguracija in PIN ostaneta.</p>

    <hr class="mf-divider" />

    <p class="mf-config-section-title">Skupine polj</p>
    <ul class="mf-config-list">${groupRows || '<li class="mf-empty">Ni skupin — polja bodo prikazana brez razvrstitve.</li>'}</ul>
    <form id="mf-add-group-form" class="mf-add-field-form">
      <div class="mf-field">
        <label for="cg-label">Nova skupina</label>
        <input type="text" id="cg-label" required autocomplete="off" placeholder="npr. Fizične lastnosti" />
      </div>
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-ghost">Dodaj skupino</button>
      </div>
    </form>

    <hr class="mf-divider" />

    <p class="mf-config-section-title">Polja obrazca</p>
    ${fieldSections}
    ${ungroupedSection}

    <hr class="mf-divider" />

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
      <div class="mf-field">
        <label for="cf-type">Tip polja</label>
        <select id="cf-type">${fieldTypeOptions()}</select>
      </div>
      <div class="mf-field" id="cf-options-wrap" style="display:none">
        <label for="cf-options">Možnosti (ločene z vejico)</label>
        <input type="text" id="cf-options" autocomplete="off" placeholder="npr. Dobro, Slabo" />
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

  const typeSelect = wrapper.querySelector('#cf-type');
  const optionsWrap = wrapper.querySelector('#cf-options-wrap');
  typeSelect.addEventListener('change', () => {
    optionsWrap.style.display = typeSelect.value === 'select' ? '' : 'none';
  });

  const formTitle = wrapper.querySelector('#cf-form-title');
  const editIdInput = wrapper.querySelector('#cf-edit-id');
  const submitBtn = wrapper.querySelector('#cf-submit-btn');
  const cancelEditBtn = wrapper.querySelector('#cf-cancel-edit');
  const labelInput = wrapper.querySelector('#cf-label');
  const groupSelect = wrapper.querySelector('#cf-group');
  const requiredInput = wrapper.querySelector('#cf-required');
  const optionsInput = wrapper.querySelector('#cf-options');

  function enterEditMode(field) {
    editIdInput.value = field.id;
    labelInput.value = field.label;
    groupSelect.value = field.group || '';
    typeSelect.value = field.type;
    optionsWrap.style.display = field.type === 'select' ? '' : 'none';
    optionsInput.value = (field.options || []).join(', ');
    requiredInput.checked = Boolean(field.required);
    formTitle.textContent = `Urejaš polje: ${field.label}`;
    submitBtn.textContent = 'Shrani spremembe';
    cancelEditBtn.style.display = '';
    wrapper.querySelector('#mf-add-field-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function exitEditMode() {
    editIdInput.value = '';
    wrapper.querySelector('#mf-add-field-form').reset();
    optionsWrap.style.display = 'none';
    formTitle.textContent = 'Novo polje';
    submitBtn.textContent = 'Dodaj polje';
    cancelEditBtn.style.display = 'none';
  }

  cancelEditBtn.addEventListener('click', exitEditMode);

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

  wrapper.querySelectorAll('.mf-edit-field').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = config.fields.find((f) => f.id === btn.dataset.id);
      if (field) enterEditMode(field);
    });
  });

  wrapper.querySelectorAll('.mf-remove-field').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const confirmed = await UI.confirm('Odstraniti to polje iz obrazca?', 'Odstrani polje');
      if (!confirmed) return;
      await ConfigService.removeField(btn.dataset.id);
      await refreshConfigEditor(wrapper);
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
      await refreshConfigEditor(wrapper);
    });
  });

  wrapper.querySelector('#mf-add-group-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = wrapper.querySelector('#cg-label').value.trim();
    if (!label) return;
    try {
      await ConfigService.addGroup({ label });
      await refreshConfigEditor(wrapper);
    } catch (err) {
      console.error('[App] addGroup failed', err);
    }
  });

  wrapper.querySelector('#mf-add-field-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const label = labelInput.value.trim();
    const group = groupSelect.value || null;
    const type = typeSelect.value;
    const required = requiredInput.checked;
    const optionsRaw = optionsInput.value.trim();
    const options = optionsRaw
      ? optionsRaw.split(',').map((o) => o.trim()).filter(Boolean)
      : [];

    if (!label) return;

    const editingId = editIdInput.value;

    try {
      if (editingId) {
        await ConfigService.updateField(editingId, { label, type, required, options, group });
      } else {
        await ConfigService.addField({
          id: Utils.slugify(label) + '_' + Date.now().toString(36).slice(-4),
          label,
          type,
          required,
          options,
          group,
        });
      }
      await refreshConfigEditor(wrapper);
    } catch (err) {
      // ConfigService already emits ui:notify on failure
      console.error('[App] field save failed', err);
    }
  });

  return wrapper;
}

async function refreshConfigEditor(oldWrapper) {
  const fresh = await renderConfigEditorBody();
  oldWrapper.replaceWith(fresh);
}

async function openConfigEditorModal() {
  const body = await renderConfigEditorBody();
  UI.openModal({ title: 'Uredi obrazec', content: body });
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
        <input type="text" id="ss-training-title" autocomplete="off" value="${escapeHtml(session?.trainingTitle || '')}" placeholder="npr. Osnove katalogizacije" />
      </div>
      <div class="mf-field">
        <label for="ss-user-name">Ime vnašalca</label>
        <input type="text" id="ss-user-name" autocomplete="off" value="${escapeHtml(session?.userName || '')}" placeholder="npr. Janez Novak" />
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
    ConfigService.getConfig(),
    SessionService.getSession(),
  ]);

  if (entries.length === 0) {
    UI.toast({ type: 'info', message: 'Zbirka je prazna — ni česa natisniti.' });
    return;
  }

  // Keep the printed catalogue to a reasonable width: inventory number,
  // title/naziv, and up to two more short text fields.
  const previewFields = config.fields
    .filter((f) => f.type !== 'image' && f.id !== 'inventory_number' && f.id !== 'title')
    .slice(0, 3);

  const headerCells = ['Inv. št.', 'Naziv', ...previewFields.map((f) => f.label), 'Datum vnosa']
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join('');

  const rows = entries
    .sort((a, b) => a.created - b.created)
    .map((entry) => {
      const inv = entry.values.inventory_number || '—';
      const title = entry.values.title || '—';
      const cells = previewFields.map((f) => `<td>${escapeHtml(entry.values[f.id]) || '—'}</td>`).join('');
      return `<tr><td>${escapeHtml(inv)}</td><td>${escapeHtml(title)}</td>${cells}<td>${Utils.formatDate(entry.created)}</td></tr>`;
    })
    .join('');

  const html = `
    <div class="mf-print-catalog">
      <div class="mf-print-header">
        <span class="mf-print-eyebrow">LOCUS · Muzejska dokumentacijska platforma</span>
        <h2>${escapeHtml(session?.trainingTitle || 'Katalog predmetov')}</h2>
        <span class="mf-print-inventory">${entries.length} predmetov ${session?.userName ? '· ' + escapeHtml(session.userName) : ''}</span>
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
    if (result.success) {
      UI.closeModal();
      try {
        await SessionService.setUserNameIfEmpty(result.entry.createdBy);
      } catch (err) {
        console.error('[App] Failed to lock in session userName', err);
      }
    }
  });

  EventBus.on('entry:editRequested', ({ entry, config }) => {
    openEditEntryModal(entry, config);
  });
}

async function bootstrap() {
  UI.init();

  try {
    await ConfigService.getConfig(); // seeds default config on first run; emits ui:fatal itself on failure
  } catch (err) {
    console.error('[App] Failed to initialize config — app will run in a degraded state', err);
  }

  const listContainer = document.getElementById('mf-entries-list');
  Viewer.init(listContainer);

  wireHeaderButtons();
  wireGlobalFormSubmission();
}

document.addEventListener('DOMContentLoaded', bootstrap);
