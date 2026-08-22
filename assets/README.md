# Logotip — kam ga dati

Ta mapa je pripravljena za logotip SPDM. Preprosto sem prekopiraj svoj PNG,
z natančno tem imenom:

```
assets/logo.png
```

## Zahteve

- Format: PNG, po možnosti s prosojnim ozadjem
- Poljubno razmerje stranic — slika se v glavi strani samodejno prilagodi
  (višina do 50 px, širina se sorazmerno prilagodi, največ 210 px)
- Ime datoteke mora biti točno `logo.png` (male črke, brez presledkov)

## Kaj se zgodi, če datoteke še ni

`index.html` poskusi naložiti `assets/logo.png`. Če je ni (ali je ime narobe
zapisano), se samodejno prikaže nadomestna oznaka (preprost SVG "L" motiv) —
glava strani se torej nikoli ne pokvari, tudi preden dodaš pravi logotip.

## Če boš kdaj logotip zamenjal

Samo prepiši datoteko z istim imenom — v kodi ni treba spreminjati ničesar.

---

## Favicon (ikona v zavihku brskalnika)

V tej mapi so tudi datoteke favicona: `favicon.svg` (glavna, uporablja jo
večina sodobnih brskalnikov), `favicon.ico` in `favicon-192.png`
(nadomestni različici za starejše brskalnike) ter `apple-touch-icon.png`
(za iOS, če nekdo stran doda na domači zaslon telefona).

Trenutno prikazujejo preprost motiv muzejske stavbe v primarni barvi
(usklajen z nadomestno oznako v glavi strani). Če jih boš kdaj želel/a
zamenjati s svojo različico:

1. Pripravi kvadratno sliko (idealno vsaj 512×512 px).
2. Po možnosti pripravi tudi `.svg` različico za ostrino na vseh zaslonih.
3. Zamenjaj datoteke v tej mapi z istimi imeni — `index.html` jih že
   pravilno povezuje, dodatnih sprememb v kodi ni treba.
