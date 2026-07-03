// /js/exportImport.js
// Exports the current entries + config + session as a downloadable .json
// archive, and imports such archives back in for cross-machine review.
// Talks to DB directly, emits via EventBus.

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Branje slike ni uspelo.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Neveljaven zapis slike v izvozni datoteki.');
  const [, mime, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function buildFileName(session) {
  const date = Utils.isoDate();
  const title = session && session.trainingTitle ? Utils.slugify(session.trainingTitle) : 'izobrazevanje';
  const user = session && session.userName ? Utils.slugify(session.userName) : 'neznan-uporabnik';
  return `${date}_${title}_${user}.json`;
}

function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportArchive() {
  try {
    const [config, entries, session] = await Promise.all([DB.getConfig(), DB.getAllEntries(), DB.getSession()]);

    const entriesWithPhotoData = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        photo: entry.photo ? await blobToDataUrl(entry.photo) : null,
      }))
    );

    const payload = {
      exportedAt: Date.now(),
      appVersion: 1,
      session: session || null,
      config,
      entries: entriesWithPhotoData,
    };

    const filename = buildFileName(session);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(filename, blob);

    EventBus.emit('ui:notify', { type: 'success', message: `Izvoz pripravljen: ${filename}` });
    return { success: true, filename, count: entries.length };
  } catch (err) {
    console.error('[ExportImport] Export failed', err);
    EventBus.emit('ui:notify', { type: 'error', message: 'Izvoz ni uspel.' });
    return { success: false };
  }
}

async function importArchive(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    if (!payload || !Array.isArray(payload.entries)) {
      throw new Error('Datoteka ni v pričakovani obliki (manjka seznam predmetov).');
    }

    let imported = 0;
    for (const entry of payload.entries) {
      const photoBlob = entry.photo ? dataUrlToBlob(entry.photo) : null;
      await DB.saveEntry({ ...entry, photo: photoBlob });
      imported++;
    }

    EventBus.emit('entry:created'); // reuse existing event so Viewer refreshes its list
    EventBus.emit('ui:notify', {
      type: 'success',
      message: `Uvoženih ${imported} predmetov iz "${file.name}".`,
    });
    return { success: true, imported };
  } catch (err) {
    console.error('[ExportImport] Import failed', err);
    EventBus.emit('ui:notify', {
      type: 'error',
      message: `Uvoz ni uspel: ${err && err.message ? err.message : 'neznana napaka.'}`,
    });
    return { success: false };
  }
}

const ExportImport = { exportArchive, importArchive };

export default ExportImport;
