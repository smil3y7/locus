// /js/ui.js
// All UI interactions live here: toast(), alert(), confirm(), openModal(), closeModal().
// No native browser alert/confirm. No business logic — rendering + interaction only.

import EventBus from './eventBus.js';

let toastRoot = null;
let modalRoot = null;
let initialized = false;

function ensureRoots() {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'mf-toast-root';
    toastRoot.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastRoot);
  }
  if (!modalRoot) {
    modalRoot = document.createElement('div');
    modalRoot.className = 'mf-modal-root';
    modalRoot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(modalRoot);
  }
}

function toast({ type = 'info', message = '', duration = 3800 } = {}) {
  ensureRoots();
  const el = document.createElement('div');
  el.className = `mf-toast mf-toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  toastRoot.appendChild(el);

  requestAnimationFrame(() => el.classList.add('mf-toast-in'));

  const remove = () => {
    el.classList.remove('mf-toast-in');
    el.classList.add('mf-toast-out');
    setTimeout(() => el.remove(), 220);
  };

  const timer = setTimeout(remove, duration);
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

let closeCleanupTimer = null;

function closeModal() {
  if (!modalRoot) return;
  if (closeCleanupTimer) {
    clearTimeout(closeCleanupTimer);
    closeCleanupTimer = null;
  }
  modalRoot.classList.remove('mf-modal-open');
  modalRoot.setAttribute('aria-hidden', 'true');
  closeCleanupTimer = setTimeout(() => {
    if (modalRoot) modalRoot.innerHTML = '';
    closeCleanupTimer = null;
  }, 180);
  document.removeEventListener('keydown', handleEscape);
}

function handleEscape(event) {
  if (event.key === 'Escape') closeModal();
}

function openModal({ title = '', content = '', closeOnBackdrop = true } = {}) {
  ensureRoots();
  // A modal opened right after another one closed must not let that prior
  // close's delayed cleanup (see closeModal) wipe out THIS modal's content
  // a moment later — cancel it, since we're about to rebuild modalRoot anyway.
  if (closeCleanupTimer) {
    clearTimeout(closeCleanupTimer);
    closeCleanupTimer = null;
  }
  modalRoot.innerHTML = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'mf-modal-backdrop';

  const card = document.createElement('div');
  card.className = 'mf-modal-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'mf-modal-header';
  header.innerHTML = `<h2 class="mf-modal-title">${title}</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'mf-modal-close';
  closeBtn.setAttribute('aria-label', 'Zapri');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'mf-modal-body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof Node) {
    body.appendChild(content);
  }

  card.appendChild(header);
  card.appendChild(body);
  backdrop.appendChild(card);

  if (closeOnBackdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) closeModal();
    });
  }

  modalRoot.appendChild(backdrop);
  modalRoot.classList.add('mf-modal-open');
  modalRoot.setAttribute('aria-hidden', 'false');
  document.addEventListener('keydown', handleEscape);

  return body; // caller can populate/query body further
}

function alertDialog(message, title = 'Obvestilo') {
  return new Promise((resolve) => {
    const body = openModal({
      title,
      content: `
        <p class="mf-dialog-message">${message}</p>
        <div class="mf-form-actions">
          <button type="button" class="mf-btn mf-btn-primary" id="mf-alert-ok">V redu</button>
        </div>
      `,
      closeOnBackdrop: false,
    });
    body.querySelector('#mf-alert-ok').addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
  });
}

function confirmDialog(message, title = 'Potrdi dejanje') {
  return new Promise((resolve) => {
    const body = openModal({
      title,
      content: `
        <p class="mf-dialog-message">${message}</p>
        <div class="mf-form-actions">
          <button type="button" class="mf-btn mf-btn-danger" id="mf-confirm-yes">Potrdi</button>
          <button type="button" class="mf-btn mf-btn-ghost" id="mf-confirm-no">Prekliči</button>
        </div>
      `,
      closeOnBackdrop: false,
    });
    body.querySelector('#mf-confirm-yes').addEventListener('click', () => {
      closeModal();
      resolve(true);
    });
    body.querySelector('#mf-confirm-no').addEventListener('click', () => {
      closeModal();
      resolve(false);
    });
  });
}

function banner(message) {
  // Persistent, non-dismissing-on-its-own bar for failures the user must
  // not miss (e.g. storage unavailable) — unlike toast(), it doesn't
  // auto-hide, since the underlying problem doesn't go away on its own.
  let bar = document.querySelector('.mf-fatal-banner');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'mf-fatal-banner';
    bar.setAttribute('role', 'alert');
    document.body.prepend(bar);
  }
  bar.innerHTML = `<span>${message}</span><button type="button" class="mf-fatal-dismiss" aria-label="Zapri opozorilo">&times;</button>`;
  bar.querySelector('.mf-fatal-dismiss').addEventListener('click', () => bar.remove());
}

function promptPin(title = 'Vnesi PIN') {
  return new Promise((resolve) => {
    const body = openModal({
      title,
      content: `
        <form id="mf-pin-form" novalidate>
          <div class="mf-field">
            <label for="mf-pin-input">PIN</label>
            <input type="password" id="mf-pin-input" inputmode="numeric" autocomplete="off" />
          </div>
          <div class="mf-form-actions">
            <button type="submit" class="mf-btn mf-btn-primary">Potrdi</button>
            <button type="button" class="mf-btn mf-btn-ghost" id="mf-pin-cancel">Prekliči</button>
          </div>
        </form>
      `,
      closeOnBackdrop: false,
    });

    const form = body.querySelector('#mf-pin-form');
    const input = body.querySelector('#mf-pin-input');
    input.focus();

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(input.value);
    });
    body.querySelector('#mf-pin-cancel').addEventListener('click', () => finish(null));
  });
}

function printHtml(html) {
  let printArea = document.getElementById('mf-print-area');
  if (!printArea) {
    printArea = document.createElement('div');
    printArea.id = 'mf-print-area';
    document.body.appendChild(printArea);
  }
  printArea.innerHTML = html;
  window.print();
}

function tabify(container, { onChange } = {}) {
  const tabList = container.querySelector('.mf-tab-list');
  const panels = container.querySelectorAll('.mf-tab-panel');
  if (!tabList || panels.length === 0) return null;

  function activate(tabId) {
    tabList.querySelectorAll('.mf-tab-btn').forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('mf-tab-btn-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== tabId;
    });
    if (onChange) onChange(tabId);
  }

  tabList.querySelectorAll('.mf-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.dataset.tab));
  });

  const firstBtn = tabList.querySelector('.mf-tab-btn');
  if (firstBtn) activate(firstBtn.dataset.tab);

  return { activate };
}

function init() {
  if (initialized) return;
  initialized = true;
  ensureRoots();

  EventBus.on('ui:notify', (payload) => toast(payload || {}));
  EventBus.on('ui:openModal', (payload) => openModal(payload || {}));
  EventBus.on('ui:closeModal', () => closeModal());
  EventBus.on('ui:fatal', (payload) => banner((payload && payload.message) || 'Prišlo je do napake.'));
}

const UI = {
  init,
  toast,
  alert: alertDialog,
  confirm: confirmDialog,
  promptPin,
  openModal,
  closeModal,
  banner,
  printHtml,
  tabify,
};

export default UI;
