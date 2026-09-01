// /js/exportImport.js
// Exports the current entries + config + session as a downloadable .json
// archive, and imports such archives back in for cross-machine review.
// Talks to DB directly, emits via EventBus.
//
// Blob/File values (images, documents) can live anywhere inside an entry's
// `values` — directly on a field, or nested inside a "group" field's
// repeated items — so serialization walks the whole values tree rather than
// assuming one fixed location.

import DB from './db.js';
import EventBus from './eventBus.js';
import Utils from './utils.js';
import ConfigService from './configService.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Branje datoteke ni uspelo.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Neveljaven zapis datoteke v izvozni datoteki.');
  const [, mime, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function serializeValue(val) {
  if (val instanceof Blob) {
    return { __blob: true, dataUrl: await blobToDataUrl(val), name: val.name || '', type: val.type || '' };
  }
  if (Array.isArray(val)) {
    return Promise.all(val.map((v) => serializeValue(v)));
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = await serializeValue(v);
    }
    return out;
  }
  return val;
}

function deserializeValue(val) {
  if (val && typeof val === 'object' && val.__blob) {
    const blob = dataUrlToBlob(val.dataUrl);
    return val.name ? new File([blob], val.name, { type: val.type || blob.type }) : blob;
  }
  if (Array.isArray(val)) {
    return val.map((v) => deserializeValue(v));
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deserializeValue(v);
    }
    return out;
  }
  return val;
}

async function serializeEntry(entry) {
  const values = {};
  for (const [key, val] of Object.entries(entry.values || {})) {
    values[key] = await serializeValue(val);
  }
  return { ...entry, values };
}

function deserializeEntry(entry) {
  const values = {};
  for (const [key, val] of Object.entries(entry.values || {})) {
    values[key] = deserializeValue(val);
  }
  return { ...entry, values };
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
    const session = await DB.getSession();

    const moduleIds = DB.MODULE_IDS; // e.g. ['inventarna', 'dokumentacija']
    const modules = {};
    let totalCount = 0;

    for (const moduleId of moduleIds) {
      const configService = ConfigService.getConfigService(moduleId);
      const [config, entries] = await Promise.all([configService.getLiveConfig(), DB.getAllEntries(moduleId)]);
      const serializedEntries = await Promise.all(entries.map((entry) => serializeEntry(entry)));
      modules[moduleId] = { config, entries: serializedEntries };
      totalCount += entries.length;
    }

    const payload = {
      exportedAt: Date.now(),
      appVersion: 3, // archive FORMAT version (bump only if the export/import shape changes)
      lokusVersion: Utils.APP_VERSION, // which Lokus app build produced this export
      session: session || null,
      modules,
      // Legacy top-level mirror of module 1 ("inventarna"), kept only so an
      // OLDER build of this app could still read a NEW export if it ever
      // needed to. Current imports read `modules` instead.
      config: modules.inventarna ? modules.inventarna.config : undefined,
      entries: modules.inventarna ? modules.inventarna.entries : [],
    };

    const filename = buildFileName(session);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(filename, blob);

    EventBus.emit('ui:notify', { type: 'success', message: `Izvoz pripravljen: ${filename} (${totalCount} zapisov, vsi moduli)` });
    return { success: true, filename, count: totalCount };
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

    // New-format archives (0.5.0+) carry a `modules` map, one entry per
    // registered module. Older archives only have flat top-level
    // `entries` — those are restored into module 1 ("inventarna") only,
    // exactly like before, so old backups still import correctly.
    const moduleEntries = payload && payload.modules
      ? Object.entries(payload.modules).map(([moduleId, m]) => [moduleId, Array.isArray(m.entries) ? m.entries : []])
      : payload && Array.isArray(payload.entries)
        ? [['inventarna', payload.entries]]
        : null;

    if (!moduleEntries) {
      throw new Error('Datoteka ni v pričakovani obliki (manjka seznam zapisov).');
    }

    let imported = 0;
    for (const [moduleId, entries] of moduleEntries) {
      for (const entry of entries) {
        const deserialized = deserializeEntry(entry);
        await DB.saveEntry(deserialized, moduleId);
        imported++;
      }
      EventBus.emit('entry:created', { moduleId }); // reuse existing event so that module's viewer refreshes
    }

    EventBus.emit('ui:notify', {
      type: 'success',
      message: `Uvoženih ${imported} zapisov iz "${file.name}".`,
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
