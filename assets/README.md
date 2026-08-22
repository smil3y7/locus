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
