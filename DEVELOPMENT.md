# Lokus — tehnična dokumentacija

Ta dokument je namenjen razvijalcu, ki bo nadaljeval delo na predani kodi aplikacije Lokus.

Dokument opisuje tehnično zasnovo in način razvoja predane različice **1.0.0**, z dne 30. 8. 2026.

Za splošen pregled aplikacije, navodila za uporabo in navodila za vzpostavitev produkcijskega okolja glejte `README.md`, `PREDAJA.md` in `navodila_lokus.md`.

## Tehnologija

- Vanilla JavaScript (ES moduli), brez frameworkov, brez build koraka.
- Podatki se hranijo lokalno v brskalniku (IndexedDB) — vsaka naprava/brskalnik ima svojo ločeno zbirko.
- Arhitektura: EventBus-driven — moduli med sabo ne komunicirajo neposredno, temveč prek dogodkov (`js/eventBus.js`).
- Povsem statična stran — brez lastnega strežnika/API-ja/build koraka; gostovljiva na Vercelu ali dobesedno kjerkoli, kar zna servirati statične datoteke.

## Struktura

```text
index.html
styles.css
config.json          – objavljena shema obrazca (enaka za vse obiskovalce)
templates/
  spectrum-core.json – kurirano jedro po standardu SPECTRUM (~25 polj), naloži se v osnutek prek admin urejevalnika
  spectrum-podrobno.json – polna shema po uporabnikovi specifikaciji (10 kartic, ~65 polj)
assets/
  logo.png            – logotip za glavo strani
  favicon.svg/.ico, favicon-192.png, apple-touch-icon.png – ikona zavihka brskalnika
js/
  eventBus.js       – globalni pub/sub
  utils.js          – čiste pomožne funkcije; APP_VERSION je tu
  db.js             – edini modul, ki dostopa do IndexedDB
  adminAuth.js      – PIN zaščita za urejevalnik obrazca (deterrent, ne prava avtentikacija)
  sessionService.js – ime vnašalca in naslov izobraževanja za trenutno sejo
  exportImport.js   – izvoz/uvoz baze kot .json (vključno s slikami)
  configService.js  – shema obrazca (polja, skupine); ločuje objavljeno (live) shemo od lokalnega osnutka
  validator.js      – validacija vnosa glede na shemo
  formBuilder.js    – dinamično renderiranje obrazca (dodajanje in urejanje)
  storage.js        – poslovna logika: validiraj → shrani → sproži dogodek
  ui.js             – toast/modal/potrditve/PIN vnos/tiskanje
  viewer.js         – prikaz seznama in podrobnosti predmetov
  app.js            – bootstrap, veže module skupaj
```

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

Predana različica je **1.0.0**. Nadaljnje različice naj uporabljajo
zaporedno številčenje različic in naj bodo ustrezno opisane v
`CHANGELOG.md`.

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