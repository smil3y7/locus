# Lokus — tehnična dokumentacija

Ta dokument je namenjen razvijalcu, ki bo nadaljeval delo na predani kodi aplikacije Lokus.

Dokument opisuje tehnično zasnovo aplikacije. Predana osnova naročniku je bila različica **1.0.0** (30. 8. 2026); ta dokument se sproti posodablja z nadaljnjim razvojem (npr. dodajanjem novih modulov).

Za splošen pregled aplikacije, navodila za uporabo in navodila za vzpostavitev produkcijskega okolja glejte `README.md`, `PREDAJA.md` in `navodila_lokus.md`.

## Tehnologija

- Vanilla JavaScript (ES moduli), brez frameworkov, brez build koraka.
- Podatki se hranijo lokalno v brskalniku (IndexedDB) — vsaka naprava/brskalnik ima svojo ločeno zbirko, ločeno po modulih.
- Arhitektura: EventBus-driven — moduli med sabo ne komunicirajo neposredno, temveč prek dogodkov (`js/eventBus.js`). Aplikacija lahko gosti več neodvisnih podatkovnih modulov (glejte "Moduli" v `README.md`); `configService.js`, `storage.js` in `viewer.js` so tovarne — ena neodvisna instanca na modul, register je v `js/app.js` (`MODULES`).
- Povsem statična stran — brez lastnega strežnika/API-ja/build koraka; gostovljiva na Vercelu ali dobesedno kjerkoli, kar zna servirati statične datoteke.

## Struktura

```text
index.html
styles.css
config.json                 – objavljena shema obrazca modula "Inventarna knjiga"
config-dokumentacija.json   – shema modula "Dokumentacija o enoti" (v razvoju, glejte README.md)
templates/
  spectrum-core.json – kurirano jedro po standardu SPECTRUM (~25 polj), naloži se v osnutek prek admin urejevalnika
  spectrum-podrobno.json – polna shema po uporabnikovi specifikaciji (10 kartic, ~65 polj)
assets/
  logo.png            – logotip za glavo strani
  favicon.svg/.ico, favicon-192.png, apple-touch-icon.png – ikona zavihka brskalnika
js/
  eventBus.js       – globalni pub/sub
  utils.js          – čiste pomožne funkcije; APP_VERSION, APP_ENV/IS_DEV_ENV (samodejno zaznano iz domene) so tu
  db.js             – edini modul, ki dostopa do IndexedDB; ena shramba na vsak podatkovni modul + skupna shramba za sejo/PIN
  adminAuth.js      – PIN zaščita za urejevalnik obrazca (deterrent, ne prava avtentikacija; skupna za vse module)
  sessionService.js – ime vnašalca in naslov izobraževanja za trenutno sejo (skupna za vse module)
  exportImport.js   – izvoz/uvoz baze kot .json (vsi moduli, vključno s slikami)
  configService.js  – createConfigService(moduleId, {configUrl, defaultConfig}) — tovarna, ena instanca na modul
  validator.js      – validacija vnosa glede na shemo
  formBuilder.js    – dinamično renderiranje obrazca (dodajanje in urejanje); tipi polj vključno s "reference" (povezava na drug modul)
  storage.js        – createStorage(moduleId, configService) — tovarna; poslovna logika: validiraj → shrani → sproži dogodek (z moduleId)
  ui.js             – toast/modal/potrditve/PIN vnos/tiskanje
  viewer.js         – createViewer(moduleId, configService, storage, moduleDef) — tovarna; prikaz seznama in podrobnosti zapisov
  app.js            – bootstrap, register modulov (MODULES), preklopnik med moduli, veže module skupaj
```

## Dodajanje novega modula

1. Ustvari `config-<ime>.json` (lahko kopiraš `config-dokumentacija.json` kot izhodišče).
2. V `js/configService.js` dodaj privzeto shemo (`DEFAULT_CONFIG_<IME>`) in vpis v register `CONFIG_SERVICES` na dnu datoteke.
3. V `js/app.js`, v register `MODULES`, dodaj nov vnos: oznake (label, addButtonLabel, addModalTitle, editModalTitle), identifikacijsko polje, naslovna polja, prazno stanje, ter (neobvezno) predloge.
4. V `js/db.js` dodaj nov vnos v `MODULE_STORES`/`MODULE_LIVE_CONFIG_KEYS`/`MODULE_DRAFT_CONFIG_KEYS` in migracijski blok `if (oldVersion < N)`, ki ustvari novo shrambo (dvigni `DB_VERSION`).

Vse ostalo (obrazec, pregled, tiskanje, admin urejevalnik, izvoz/uvoz) deluje samodejno, brez dodatnih posegov v kodo.

## Lokalni zagon

Module skripte (`type="module"`) zaradi CORS pravil zahtevajo HTTP
strežnik — `file://` ne deluje.

```bash
npx serve .
# ali
python3 -m http.server 8000
```

Nato odpri `http://localhost:PORT`.

## Deploy na Vercel

Ker gre za povsem statično stran (brez build koraka), je nastavitev minimalna:

1. Repo potisni na GitHub.
2. Na [vercel.com](https://vercel.com) → **Add New → Project** → izberi ta repo.
3. Framework Preset: **Other** (ali "No Framework").
4. Build Command: pusti prazno.
5. Output Directory: `.`, torej koren repozitorija.
6. Deploy.

Za prvo postavitev produkcijskega okolja naročnika (GitHub + Vercel račun) glejte `PREDAJA.md`.

## Verzioniranje

Trenutna verzija je zapisana na enem mestu v kodi: `APP_VERSION` v
`js/utils.js`. Prikazana je v nogi strani aplikacije in v vsaki izvoženi
arhivski datoteki (polje `lokusVersion`).

Ob vsaki pomembnejši spremembi:

1. Posodobi `APP_VERSION` v `js/utils.js`.
2. Dodaj nov razdelek v `CHANGELOG.md` (najnovejši na vrhu).

Predana osnova naročniku je bila **1.0.0**. Nadaljnje različice naj
uporabljajo zaporedno številčenje (semver) in naj bodo ustrezno opisane v
`CHANGELOG.md` — glejte tam opombo o statusu vsake različice (objavljeno
naročniku / v razvoju).

## Git — vzpostavitev repozitorija iz predanega ZIP-paketa

Če je repozitorij ustvarjen na novo in je izvorna koda pridobljena iz
predanega ZIP-paketa, lahko razvijalec vzpostavi Git repozitorij na
naslednji način:

```bash
cd lokus
git init
git add .
git commit -m "Lokus v1.0.0"
git branch -M main
git remote add origin https://github.com/<uporabnisko-ime>/<ime-repozitorija>.git
git push -u origin main
```

Po vzpostavitvi repozitorija lahko nadaljnji razvoj poteka običajno prek
Gita.

Predana različica 1.0.0 predstavlja izhodišče za nadaljnji razvoj.

### Delovni tok: main ↔ razvoj

Dejansko stanje (od v1.3.0 dalje) se razlikuje od prvotnega načrta zgoraj:
namesto ene razvojne veje, ki se z `main` združi šele ob zaključku modula,
teče **stalno vzporedno** dvoje ločenih Vercel projektov iz dveh stalnih
vej:

- `main` → produkcija, `https://lokus-spdm.vercel.app/` — kar dejansko
  uporablja naročnik.
- `razvoj` → razvojno okolje, `https://lokus-razvoj.vercel.app/` — tekoč
  razvoj (trenutno modul "Dokumentacija o enoti").

Katero okolje aplikacija misli, da je (produkcija/razvoj — vpliva na
pasico na vrhu strani, `[Dev]` v naslovu zavihka in na to, kateri moduli so
vidni), se **ugotovi samodejno iz domene** (`DEV_HOSTNAMES` v
`js/utils.js`) — koda je zato na obeh vejah dobesedno identična in med
njima ni ročnih stikal, ki bi jih bilo treba usklajevati.

**Vidnost modulov v produkciji** se upravlja samo prek
`PRODUCTION_APPROVED_MODULES` v `js/app.js` (glejte komentar tam) — to je
edino mesto v celotni kodni bazi, ki ga urediš, ko naročnik odobri nov
modul. V razvojnem okolju so ne glede na ta seznam vedno vidni vsi
registrirani moduli.

**Prenos sprememb med vejama:**

- Popravki, narejeni na `razvoj` (npr. bug v modulu Inventarna knjiga, ki
  je nastal med razvojem modula Dokumentacija), gredo v produkcijo prek:
  ```bash
  git checkout main
  git cherry-pick <commit-sha>   # samo izbrani commit(i)
  # ali, če želiš prenesti vse spremembe naenkrat:
  git merge razvoj
  git push
  ```
- Ker sta okoljska logika in `PRODUCTION_APPROVED_MODULES` zdaj enaka na
  obeh vejah, tovrstni `merge`/`cherry-pick` **ne povzroča konfliktov na
  teh dveh mestih** — konflikt lahko nastane le, če je isti del kode (npr.
  isto polje sheme) med tem hkrati spremenjen na obeh vejah, kar je
  normalen Git konflikt in se rešuje kot običajno.
- Ko naročnik odobri modul "Dokumentacija o enoti" za produkcijo:
  1. na `razvoj` (ali kjerkoli, saj je koda enaka) uredi
     `PRODUCTION_APPROVED_MODULES` v `js/app.js`, da vključuje
     `'dokumentacija'`;
  2. prenesi to spremembo v `main` (merge/cherry-pick) in objavi;
  3. dokumentiraj v `CHANGELOG.md`.
- Pred vsakim tovrstnim usklajevanjem preveri tudi, ali je naročnik med
  tem sam spremenil `config.json` ali `assets/logo.png` prek admin
  urejevalnika oz. neposredno v repozitoriju na `main` — te spremembe
  imajo vedno prednost (glejte opombo v `README.md`, razdelek "Moduli").