# LOCUS

Muzejska dokumentacijska platforma — offline-first spletna aplikacija za vnos
in upravljanje muzejskih predmetov.

## Funkcionalnosti

- Dinamičen obrazec za vnos predmetov, polja in skupine polj upravlja admin
- Dodajanje, urejanje in brisanje vnosov
- Skupine polj (npr. "Osnovni podatki", "Fizične lastnosti") — uporabnik jih sam ustvarja
- Seja: ime vnašalca se vnese enkrat in ostane prednapolnjeno za vse predmete v seji
- PIN zaščita za urejanje obrazca (deterrent za nenamerne klike, ni prava avtentikacija)
- Izvoz/uvoz celotne baze kot `.json` (vključno s slikami) — za arhiviranje in pregled na drugem računalniku
- Ponastavitev baze (izbriše vnose in sejo, ohrani konfiguracijo in PIN) — priprava na naslednjo skupino
- Tiskanje/PDF: posamezna "muzejska kartica" predmeta ali celoten katalog

- Vanilla JS (ES moduli), brez frameworkov, brez build koraka
- Podatki se hranijo lokalno v brskalniku (IndexedDB) — vsaka naprava/brskalnik ima svojo ločeno zbirko
- Arhitektura: EventBus-driven, moduli med sabo ne komunicirajo neposredno

## Struktura

```
index.html
styles.css
assets/
  logo-on-light.png  – (dodaj sam/a) logotip za svetlo glavo strani
  logo-on-dark.png   – (dodaj sam/a) rezerva za temna ozadja
js/
  eventBus.js       – globalni pub/sub
  utils.js          – čiste pomožne funkcije
  db.js             – edini modul, ki dostopa do IndexedDB
  adminAuth.js       – PIN zaščita za urejevalnik obrazca (deterrent, ne prava avtentikacija)
  sessionService.js – ime vnašalca in naslov izobraževanja za trenutno sejo
  exportImport.js   – izvoz/uvoz baze kot .json (vključno s slikami)
  configService.js  – shema obrazca (polja, skupine)
  validator.js      – validacija vnosa
  formBuilder.js    – dinamično renderiranje obrazca (dodajanje in urejanje)
  storage.js        – poslovna logika: validiraj → shrani → sproži dogodek
  ui.js             – toast/modal/potrditve/PIN vnos/tiskanje
  viewer.js         – prikaz seznama in podrobnosti predmetov
  app.js            – bootstrap, veže module skupaj
```

## Lokalni zagon

Module skripte (`type="module"`) zaradi CORS pravil zahtevajo HTTP strežnik — `file://` ne deluje.

```bash
npx serve .
# ali
python3 -m http.server 8000
```

Nato odpri `http://localhost:PORT`.

## Deploy na Vercel

Ker gre za povsem statično stran (brez build koraka), je nastavitev minimalna:

1. Repo potisni na GitHub (glej spodaj).
2. Na [vercel.com](https://vercel.com) → **Add New → Project** → izberi ta repo.
3. Framework Preset: **Other** (ali "No Framework").
4. Build Command: pusti prazno.
5. Output Directory: `.` (koren repozitorija).
6. Deploy.

**Pomembno:** IndexedDB (in admin PIN) je vezan na brskalnik/napravo vsakega obiskovalca posebej — hosting ne ustvari skupne baze med uporabniki. Za deljeno zbirko med več osebami bi bil potreben pravi backend.

## Git ukazi za prvi push

```bash
cd locus
git init
git add .
git commit -m "LOCUS MVP"
git branch -M main
git remote add origin https://github.com/<uporabnisko-ime>/<ime-repozitorija>.git
git push -u origin main
```
