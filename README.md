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
- Tip polja "Mere" po CDWA standardu (vrsta mere + vrednost + enota, npr. Višina: 15 cm) — admin določi dovoljene vrste in enote, uporabnik pri vnosu doda poljubno število mer
- Namigi (placeholder) v vnosnih poljih obrazca
- Tiskanje/PDF: posamezna "muzejska kartica" predmeta ali celoten katalog
- Premikanje polj gor/dol znotraj skupine, barvna oznaka polja (za označevanje polj, ki spadajo skupaj, ne glede na skupino/zavihek)
- Uvoz sheme (JSON) v osnutek — lastna varnostna kopija ali predloga; vgrajena predloga "SPECTRUM jedro" (`templates/spectrum-core.json`, ~25 polj po standardu SPECTRUM) se naloži z enim klikom

- Vanilla JS (ES moduli), brez frameworkov, brez build koraka
- Podatki se hranijo lokalno v brskalniku (IndexedDB) — vsaka naprava/brskalnik ima svojo ločeno zbirko
- Arhitektura: EventBus-driven, moduli med sabo ne komunicirajo neposredno

## Struktura

```
index.html
styles.css
config.json          – objavljena shema obrazca (enaka za vse obiskovalce)
templates/
  spectrum-core.json – kurirano jedro po standardu SPECTRUM (~25 polj), naloži se v osnutek prek admin urejevalnika
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

## Shema obrazca: objavljena vs. osnutek

Ker je aplikacija servirana prek Vercel/GitHub, vsi obiskovalci strani dobijo
**isto** shemo obrazca — bere se iz `config.json` v korenu repozitorija
(ne iz IndexedDB posameznega brskalnika kot prej).

- **Objavljena (live) shema** — `config.json`, del deploya, enaka za vse. To
  uporablja obrazec za vnos predmetov. Če ob nalaganju strani ni povezave do
  strežnika, se uporabi zadnja lokalno predpomnjena kopija, nato pa vgrajena
  privzeta shema — obrazec torej nikoli ne odpove.
- **Osnutek (draft)** — lokalna delovna kopija znotraj PIN-zaščitenega
  urejevalnika ("Uredi obrazec"). Urejanje osnutka **ne vpliva** na to, kar
  vidijo drugi uporabniki.

### Kako kustos objavi nov obrazec

1. V urejevalniku ("Uredi obrazec") si obrazec sestavi kot doslej (dodaja
   polja, skupine).
2. Klikne "Izvozi shemo obrazca (config.json)" — prenese se datoteka.
3. To datoteko zamenja z obstoječo `config.json` v repozitoriju (npr. prek
   GitHub spletnega vmesnika z "Upload file", ali lokalno + `git push`).
4. Vercel samodejno objavi novo verzijo — vsi računalniki ob naslednjem
   nalaganju strani dobijo novo shemo.

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
