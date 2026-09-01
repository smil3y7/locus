# Lokus

Muzejska dokumentacijska platforma za vnos in upravljanje muzejskih
predmetov — deluje v celoti v brskalniku (offline-first), brez lastnega
strežnika/baze v ozadju.

- **Aplikacija teče na:** _[sem vpišite produkcijski Vercel naslov, ko bo
  ustvarjen — glej `PREDAJA.md`]_
- **Navodila za vsakodnevno uporabo** (nastavitve seje, vnos/urejanje
  predmetov, admin urejevalnik obrazca, izvoz/uvoz baze): glejte
  `navodila_lokus.md`.
- **Prva postavitev / prevzem gostovanja** (GitHub, Vercel, domena):
  glejte `PREDAJA.md`.
- **Tehnična dokumentacija** (za razvijalca, ki bo nadaljeval delo na
  kodi): glejte `DEVELOPMENT.md`.

## Moduli

Aplikacija je zasnovana tako, da lahko poleg glavnega obrazca gosti tudi
dodatne, med seboj povezane module — vsak s svojo shemo in svojo lokalno
zbirko podatkov, dostopne prek preklopnika modulov pod glavo strani.

- **Inventarna knjiga** — glavni, v produkciji objavljeni modul. Shema:
  `config.json` (glejte spodaj, "Kako deluje objava sprememb obrazca").
- **Dokumentacija o enoti** — drugi modul, **trenutno še v razvoju in ni
  del objavljene produkcijske različice**. Zapisi se lahko povežejo z
  enim ali več predmeti v Inventarni knjigi. Shema:
  `config-dokumentacija.json`. Ko bo dokončan in odobren, bo dodan v
  `navodila_lokus.md` samostojen razdelek z navodili za uporabo.

## Kako deluje objava sprememb obrazca

Vsi obiskovalci strani vidijo **isto** shemo obrazca — bere se iz
`config.json` v korenu repozitorija (ne iz baze posameznega brskalnika).
Ločimo:

- **Objavljena (live) shema** — `config.json`, del gostovane strani, enaka
  za vse. To uporablja obrazec za vnos predmetov.
- **Osnutek (draft)** — lokalna delovna kopija znotraj PIN-zaščitenega
  urejevalnika ("Uredi obrazec"). Urejanje osnutka **ne vpliva** na to, kar
  vidijo drugi uporabniki, dokler ga admin ne objavi.

Ko admin obrazec sestavi/popravi in je z osnutkom zadovoljen:

1. V urejevalniku ("Uredi obrazec") klikne "Izvozi shemo obrazca" — prenese
   se datoteka `config.json`.
2. To datoteko naloži v GitHub repozitorij in z njo nadomesti obstoječi
   `config.json`.
3. Vercel spremembo samodejno objavi novo verzijo — vsi obiskovalci ob 
   naslednjem nalaganju strani dobijo novo shemo. Za ta korak niso potrebni
   `git` ukazi.

**Pomembno za vsakdanjo rabo:** IndexedDB (kamor se shranjujejo vneseni
predmeti) in admin PIN sta vezana na brskalnik/napravo vsakega uporabnika
posebej — gostovanje ne ustvari ene skupne baze med uporabniki. Če želite 
podatke prenesti na drugo napravo, uporabite funkciji "Izvozi bazo" in
"Uvozi bazo" (glej `navodila_lokus.md`). Aplikacija ne podpira samodejne 
sinhronizacije ali sočasnega dela z eno skupno bazo.
