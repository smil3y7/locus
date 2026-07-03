// /js/formBuilder.js
// Renders a dynamic form from ConfigService's config and collects raw input.
// Does NOT validate. Does NOT save. Emits 'form:submitted' with raw data.

import EventBus from './eventBus.js';

let currentContainer = null;
let currentForm = null;

function fieldInputHtml(field, value) {
  const req = field.required ? 'required' : '';
  const val = value !== undefined && value !== null ? String(value) : '';
  switch (field.type) {
    case 'text':
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} autocomplete="off" value="${escapeHtml(val)}" />`;
    case 'number':
      return `<input type="number" id="f_${field.id}" name="${field.id}" ${req} step="any" value="${escapeHtml(val)}" />`;
    case 'date':
      return `<input type="date" id="f_${field.id}" name="${field.id}" ${req} value="${escapeHtml(val)}" />`;
    case 'select': {
      const opts = (field.options || [])
        .map((opt) => `<option value="${escapeHtml(opt)}"${opt === value ? ' selected' : ''}>${escapeHtml(opt)}</option>`)
        .join('');
      return `<select id="f_${field.id}" name="${field.id}" ${req}>
        <option value="" disabled${value ? '' : ' selected'}>Izberi …</option>
        ${opts}
      </select>`;
    }
    case 'image':
      return `<input type="file" id="f_${field.id}" name="${field.id}" accept="image/*" />
        <div class="mf-image-preview" id="preview_${field.id}" aria-hidden="true"></div>`;
    default:
      return `<input type="text" id="f_${field.id}" name="${field.id}" ${req} value="${escapeHtml(val)}" />`;
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

function fieldHtml(field, existingValues, existingPhoto) {
  const value = existingValues ? existingValues[field.id] : undefined;
  const currentPhotoHint =
    field.type === 'image' && existingPhoto
      ? `<p class="mf-field-hint">Trenutna slika ostane, če ne izbereš nove.</p>
         <div class="mf-image-preview" aria-hidden="true"><img src="${existingPhoto}" alt="" /></div>`
      : '';
  return `
    <div class="mf-field" data-type="${field.type}" style="--field-accent:${field.color || '#B8934A'}">
      <label for="f_${field.id}">${escapeHtml(field.label)}${field.required ? ' <span class="mf-required">*</span>' : ''}</label>
      ${fieldInputHtml(field, value)}
      ${currentPhotoHint}
    </div>
  `;
}

function groupedFieldsHtml(config, existingValues, existingPhoto) {
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

  const render = (field) => fieldHtml(field, existingValues, existingPhoto);

  const groupSections = groups
    .filter((g) => fieldsByGroup.get(g.id).length > 0)
    .map(
      (g) => `
      <fieldset class="mf-group">
        <legend>${escapeHtml(g.label)}</legend>
        ${fieldsByGroup.get(g.id).map(render).join('')}
      </fieldset>
    `
    )
    .join('');

  const ungroupedSection = ungrouped.length
    ? `
      <fieldset class="mf-group mf-group-plain">
        ${groups.length ? '<legend>Splošno</legend>' : ''}
        ${ungrouped.map(render).join('')}
      </fieldset>
    `
    : '';

  return groupSections + ungroupedSection;
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

  container.innerHTML = `
    <form id="mf-entry-form" novalidate>
      ${groupedFieldsHtml(config, isEdit ? existingEntry.values : null, existingPhotoUrl)}
      <div class="mf-form-actions">
        <button type="submit" class="mf-btn mf-btn-primary">${isEdit ? 'Shrani spremembe' : 'Shrani predmet'}</button>
        <button type="button" class="mf-btn mf-btn-ghost" id="mf-form-cancel">Prekliči</button>
      </div>
    </form>
  `;

  currentForm = container.querySelector('#mf-entry-form');

  config.fields.forEach((field) => attachImagePreview(field, currentForm));

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
      } else {
        values[field.id] = formData.get(field.id);
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
