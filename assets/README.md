# Logotip — kam ga dati

Ta mapa je pripravljena za tvoja dva PNG logotipa. Enostavno ju prekopiraj
sem, z natančno temi imeni:

```
assets/logo-on-light.png    ← trenutno v uporabi (glava strani je svetla)
assets/logo-on-dark.png     ← rezervirano za morebitno temno ozadje kasneje
```

## Zahteve

- Format: PNG s prosojnim ozadjem
- Priporočena velikost: 1774 × 887 px (razmerje 2:1) — natanko taka, kot jo
  že imaš pripravljeno
- Ime datoteke mora biti točno `logo-on-light.png` (male črke, brez presledkov)

## Kaj se zgodi, če datoteke še ni

`index.html` poskusi naložiti `assets/logo-on-light.png`. Če je ni (ali je
ime narobe zapisano), se samodejno prikaže nadomestna oznaka (preprost SVG
"L" motiv) — glava strani se torej nikoli ne pokvari, tudi preden dodaš
pravi logotip.

## Če boš kdaj logotip zamenjal

Samo prepiši datoteko z istim imenom — v kodi ni treba spreminjati ničesar.
