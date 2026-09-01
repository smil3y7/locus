# Changelog

Vse pomembnejše spremembe aplikacije so zabeležene tukaj. Format sledi
[Keep a Changelog](https://keepachangelog.com/), verzije pa
[semantičnemu verzioniranju](https://semver.org/) (MAJOR.MINOR.PATCH).

Trenutna verzija je zapisana na enem mestu v kodi: `APP_VERSION` v
`js/utils.js`. Prikazana je v nogi strani aplikacije in v vsaki izvoženi
arhivski datoteki (polje `lokusVersion`). Ob vsaki pomembnejši spremembi:
1. Popravi `APP_VERSION` v `js/utils.js`.
2. Dodaj nov razdelek spodaj (najnovejši na vrhu).

## [1.1.0] — modul "Dokumentacija o enoti" (v razvoju, faza 1+2 zaključeni)

**Status: še ni objavljeno naročniku.** Ta različica je nastajala vzporedno
z izdelavo v1.0.0 in je izhajala iz 0.4.5 po ločeni razvojni poti — ob
uskladitvi je bila prenešena na produkcijsko osnovo (dokumentacija in
`assets/logo.png` iz v1.0.0), koda modula pa je ostala nespremenjena.

Doda drug, neodvisen modul poleg "Inventarne knjige": **"Dokumentacija o
enoti"**, dostopen prek preklopnika modulov pod glavo strani. Vsa
sprememba je dodajalna — obstoječi podatki, shema in nastavitve
Inventarne knjige ostanejo popolnoma nedotaknjeni (preverjeno s testi).

Manjka še: pogojno prikazovanje kartice "Tekstovni vir" (faza 3, po
dogovoru z naročnikom sledi po odobritvi vsebine).

### Dodano
- Nov modul "Dokumentacija o enoti" — svoja ločena shramba v IndexedDB,
  svoja shema (`config-dokumentacija.json`, 11 kartic, 78 polj po
  specifikaciji naročnika) in svoj admin urejevalnik — vse po istem
  mehanizmu kot Inventarna knjiga, brez podvajanja kode.
- Vseh 11 kartic: Identifikacija; Poimenovanje in vrsta; Vsebina in
  povezava z enoto dediščine; Izdelava in nastanek; Izvor in povezane
  dokumentacijske enote; Tehnični podatki o dokumentaciji; Pravice in
  dostop; Lastništvo in pridobitev; Repozitorij in hramba; Tekstovni vir;
  Administrativni podatki. Sklopa "Avtorstvo" in "Ključne besede" sta
  strukturno usklajena z Inventarno knjigo.
- **Nov tip polja "Povezava" (reference)** — omogoča, da se en zapis poveže
  z enim ali več zapisi v drugem (ali istem) modulu. Iskanje deluje po
  identifikacijski številki ALI kateri koli "drugi številčni oznaki", ne
  glede na njen tip. V pogledu podrobnosti je povezava klikljiva — odpre
  povezan zapis, po potrebi s preklopom na njegov modul. Uporabljeno
  dvakrat: "Dokumentirana enota dediščine" (Dokumentacija → Inventarna
  knjiga) in "Dokumentacija pridobitve" (Dokumentacija → Dokumentacija,
  samo-referenca).
- Admin urejevalnik polj ima nov razdelek nastavitev za polja tipa
  "Povezava" (ciljni modul, ena/več povezav).
- Izvoz/uvoz baze zdaj zajema vse module hkrati; uvoz starejših,
  enomodulnih izvozov ostaja podprt (obnovi se v Inventarno knjigo).

### Opombe v vednost
- "Datum zadnje spremembe" ni dodan kot polje v obrazcu — to že samodejno
  spremlja aplikacija sama (prikazano v pogledu podrobnosti kot "Nazadnje
  uredil ..."), ročno polje bi podvajalo obstoječo funkcionalnost.
- Vsi sklopi kartice "Tehnični podatki o dokumentaciji" (fotografija/sken,
  zvok, video, tekstovna dokumentacija) so trenutno **vedno vidni** —
  pogojno prikazovanje po vrsti dokumentacije je predmet faze 3.
- Opažena manjša neusklajenost imen: kartica "Tekstovni vir" naj bi se v
  fazi 3 pogojno prikazala, "kadar je vrsta dokumentacije tekstovni vir",
  medtem ko seznam vrednosti polja "Vrsta dokumentacijske enote" vsebuje
  možnost "besedilni dokument" (ne dobesedno "tekstovni vir"). V fazi 3 bo
  treba potrditi, katera vrednost naj sproži prikaz te kartice.

### Tehnično
- `configService.js`, `storage.js`, `viewer.js` so pretvorjeni v tovarne
  (ena neodvisna instanca na modul).
- `db.js`: baza dvignjena na verzijo 2, nova shramba dodana izključno
  dodajalno (`onupgradeneeded`, brez poseganja v obstoječe podatke).
- Register modulov v `js/app.js` (`MODULES`) — dodajanje novega modula v
  prihodnje zahteva le vpis v ta register, ne pisanja nove UI/poslovne
  logike.
- Mimogrede odpravljena ista latentna napaka kot v v0.4.6 (tooltip/
  autoExpand pri urejanju obstoječega polja) — enak popravek, prišel je
  kot del prenove `configService.js`.

## [1.0.0] — predana verzija

Prva stabilna izdaja, predana naročniku kot dokončan pogodbeni izdelek. 
Različica vsebuje modul "Inventarna knjiga". Vsebinsko je enaka verziji 0.4.6 
(glejte spodaj) — sprememba je izključno mejnik predaje, brez novih 
funkcionalnosti.

### Dodano (dokumentacija za predajo)
- `PREDAJA.md` — podrobna navodila za prevzem gostovanja (GitHub in Vercel
  računa, prevzem repozitorija, nov produkcijski Vercel projekt, neobvezna
  lastna domena).
- `DEVELOPMENT.md` — tehnična dokumentacija za razvijalca (struktura kode,
  lokalni zagon, deploy), izločena iz README-ja.
- `README.md` prenovljen — kratek, za naročnika/skrbnika, s povezavami na
  ostale dokumente.
- `navodila_lokus.md` — navodila za vsakodnevno uporabo aplikacije,
  vključena v predajo.

## [0.4.6] — stabilna izdaja za predajo

Ta verzija je pripravljena kot **izhodišče za predajo dejanskemu
uporabniku** — izhaja neposredno iz 0.4.5. Vsebuje en sam, izoliran popravek.

### Popravljeno
- Latentna napaka v admin urejevalniku: pojasnilo (tooltip) in nastavitev
  "samodejno rastoče besedilno polje" sta se pri urejanju **obstoječega**
  polja prek admin vmesnika izgubila (bila sta izpuščena s sicer
  eksplicitnega seznama lastnosti, ki jih urejevalnik ob shranjevanju
  ohrani). Obstoječa polja v `config.json`, ki so že imela ti nastavitvi
  (opisna polja z avtomatsko rastočo textarea, tooltipi), s tem niso bila
  prizadeta — napaka bi se sprožila šele, če bi admin tako polje pozneje
  odprl za urejanje in ga znova shranil.

## [0.4.5] — dosledno zapiranje vseh pojavnih oken

### Spremenjeno
- Vsa preostala pojavna okna ("Uredi obrazec" — admin urejevalnik sheme,
  in "Nastavitve seje") se zdaj obnašajo enako kot predmetna kartica in
  obrazca za vnos/urejanje predmeta — klik zunaj okna ga ne zapre več,
  samo gumb "×" ali tipka Esc. Posebej pomembno pri "Uredi obrazec", kjer
  bi nehoten klik lahko pomenil izgubo obsežnejših sprememb sheme
  obrazca.

## [0.4.4] — obrazec za vnos/urejanje predmeta se ne zapre več s klikom zunaj

### Spremenjeno
- Obrazec "Dodaj predmet" in "Uredi predmet" se zdaj obnašata enako kot
  predmetna kartica (pogled s podrobnostmi) — klik zunaj njiju ju ne
  zapre več, samo gumb "×" ali tipka Esc. Prej je bilo to omejeno samo na
  pogled s podrobnostmi, obrazca za vnos/urejanje pa sta se še vedno
  zaprla s klikom zunaj, kar je lahko povzročilo izgubo vnesenih
  podatkov. ("Uredi obrazec" v admin urejevalniku in "Nastavitve seje"
  ostajata nespremenjena.)

## [0.4.3] — manjša popravka

### Spremenjeno
- Materialnost predmeta → Tehnike → Tehnika: dodana nova vrednost "tisk".
- Stanje in varovanje → Opis stanja: polje je zdaj samodejno rastoča
  textarea (enako kot preostala opisna polja) — uporablja isti,
  generični mehanizem kot ostala, zato prelivanja iz verzije 0.4.1 ni.

## [0.4.2] — favicon

### Dodano
- Favicon (ikona zavihka brskalnika): `assets/favicon.svg` (glavna, SVG —
  ostro na vseh velikostih/gostotah zaslona) z `favicon.ico` in
  `favicon-192.png` kot nadomestnima različicama za starejše brskalnike,
  ter `apple-touch-icon.png` za iOS. Motiv (muzejska stavba, primarna
  barva) je usklajen z nadomestno oznako v glavi strani.

### Odstranjeno
- Neuporabljeni ostanki stare, dvodatotečne postavitve logotipa
  (`assets/logo-on-light.png`, `assets/logo-on-dark.png`) — koda že od
  verzije 0.3.0 uporablja samo `assets/logo.png`.

## [0.4.1] — popravek: dolgo besedilo je uhajalo iz kartice/tiska

### Popravljeno
- Vrstice v pogledu podrobnosti predmeta (in enako v tiskanem izpisu, ki
  uporablja isto strukturo) niso prelamljale daljšega besedila, zato je
  vrednost pri poljih z veliko besedila (npr. Fizični opis celote, Opis
  materiala/tehnike/vrednotenja) segala izven roba kartice, namesto da bi
  se prelomila v več vrstic. To je bila splošna napaka pri izrisu vseh
  vrednosti (ne le pri poljih s samodejno rastočo textarea), zato zdaj
  velja popravljeno za vsa polja.
- Dodatno utrjeno samodejno raščanje textarea v obrazcu za vnos/urejanje:
  poleg preklopa med zavihki se velikost polja zdaj preračuna tudi ob
  vsakem fokusu nanj (varovalka za robne primere).

## [0.4.0] — predmetna kartica, tooltipi, popravki šifrantov in Času uporabe/izdelave

### Spremenjeno
- Predmetna kartica (pogled s podrobnostmi) se ne zapre več s klikom zunaj nje — zapre se samo z gumbom "×" ali s tipko Esc. (Ostali obrazci/pojavna okna v aplikaciji to obnašanje ohranijo nespremenjeno.)
- Polje "Fizični opis celote" je zdaj samodejno rastoča textarea (enako kot Opis materiala/tehnike/vrednotenja) — besedilo med tipkanjem ne izgine več iz vidnega dela polja.
- Popravljena splošna napaka: v vseh spustnih seznamih po celi aplikaciji (ne le v enem polju) je bilo prazno "Izberi …" po izbiri prave vrednosti pomotoma onemogočeno, zato je ni bilo več mogoče izbrati nazaj. Zdaj je vsak spustni seznam mogoče znova počistiti na prazno vrednost.
- Polje "Številka" pri Času uporabe IN Času izdelave (isti napaki podvržena oba sklopa) je spremenjeno iz števila v besedilo, da lahko shrani zapis stoletja s piko (npr. "19.", "20.") brez izgube pike.
- Položaj/Številka/Enota se pri Času uporabe in Času izdelave zdaj prikažejo v eni vodoravni vrstici.
- "Vrsta imena": vrednost "književno" preimenovana v "knjižno".
- V šifrante dodane nove vrednosti (obstoječe ohranjene): Zbirka, Tip klasifikacije, Tip ključne besede, Vrsta avtorstva, Material.
- Predlogo `templates/spectrum-podrobno.json` znova uskladil z živo shemo `config.json`.

### Dodano
- Nov sklop polj "Naslov v tujem jeziku" + "Jezik naslova" (angleški/nemški/italijanski/francoski/španski), takoj za obstoječim poljem Jezik naslova.
- Tooltipi (pojasnjevalna besedila) na 17 poljih — prikažejo se ob premiku miške/fokusu na ime polja ali na majhno ikono "i" poleg njega.
- Admin urejevalnik polj ima nov vnos "Pojasnilo (tooltip)" — tooltip za poljubno polje je zdaj mogoče urejati brez poseganja v kodo, enako kot že obstoječi "Namig (placeholder)".
- V urejevalniku obrazcev (zavihek Polja) so dodatne nastavitve polja preurejene v pregleden seznam s stikali (namesto razmetanih kljukic) — vsak opis je zdaj nedvoumno povezan s svojim stikalom.

## [0.3.0] — preimenovanje v Lokus, nova barvna shema, popravki obrazca

### Spremenjeno
- Aplikacija preimenovana iz LOCUS v **Lokus** (naslov strani, glava, tisk,
  noga strani, ime lokalne baze `LokusDB`, polje `lokusVersion` v izvozu).
  Ker je aplikacija še v testni fazi, preimenovanje ni ohranjalo združljivosti
  za nazaj — obstoječi testni vnosi po posodobitvi niso več vidni (nova prazna
  baza).
- Nova barvna shema: primarna #45998B, svetla primarna
  #A9D5CD, temna nevtralna #2F3B39, svetla nevtralna #F4F8F7, akcentna
  #B68B52. Rdeča barva za nevarna dejanja (brisanje, napake) je ohranjena
  ločeno od barvne sheme. Obstoječe barvne oznake polj (za vizualno
  združevanje sorodnih polj) so preslikane na dva odtenka primarne in dva
  odtenka akcentne barve; admin jih lahko še vedno poljubno spremeni.
- Logotip: glava strani zdaj uporablja samo eno datoteko, `assets/logo.png`
  (prej dve, za svetlo/temno ozadje) — glej `assets/README.md`.
- Naslov razdelka s predmeti "Zbirka" (+ podnapis) nadomeščen z enotnim
  naslovom "Inventarna knjiga".
- Polje "Status enote" preimenovano v "Status predmeta".
- Šifrirana gesla (spustni seznami) so zdaj zapisana z malimi tiskanimi
  črkami pri: status predmeta, vrsta imena, jezik naslova, tip klasifikacije
  (razen kratic Iconclass/AAT), tip ključne besede, vrsta avtorstva, vloga
  avtorstva, položaj (čas izdelave/uporabe), material, vrste mer, stanje,
  trenutna lokacija, način pridobitve, vloga (administrativni podatki).
- Polje "Datum najdbe" spremenjeno iz besedilnega v datumsko polje (izbira iz
  koledarčka).
- Gumbi "Uredi" / "Natisni" / "Izbriši" v podrobnostih predmeta premaknjeni
  nad fotografijo, pomanjšani in opremljeni z ikono; kartica podrobnosti je
  širša.

### Dodano
- Skupina "Viri – slike" ima nova pod-polja: Avtor, Opis slike, Datum.
- Nova nastavitev polja "Samodejno rastoče besedilno polje" — admin jo lahko
  vklopi na poljubnem besedilnem polju (privzeto vklopljena pri Opis
  materiala, Opis tehnike, Opis vrednotenja); polje se med vnosom širi
  navzdol namesto da besedilo obreže.

## [0.2.1] — poudarjanje polj z barvo ozadja

### Dodano
- Poljem lahko admin poleg barvne obrobe (za označevanje sorodnih polj) dodeli
  tudi rahlo obarvano **ozadje** ("Poudari z barvo ozadja") — za polja, ki
  naj resnično vizualno izstopajo, ne le tanka obroba. Velja v obrazcu za
  vnos in v podrobnostih predmeta.

## [0.2.0] — razdelki, sestavljena polja, povezave, podrobna SPECTRUM shema

### Dodano
- Razdelki ("razdelki") — drugi nivo organizacije znotraj kartice/zavihka, za
  vizualno združevanje sorodnih polj (podnaslovi znotraj zavihka)
- Neponavljajoča "Skupina" (`repeatable: false`) — sestavljena vrednost brez
  seznama primerkov (npr. "Čas izdelave", "Avers/Revers", "Lokacija hrambe",
  "Nabavna vrednost") — isti mehanizem pod-polj kot ponavljajoča skupina, a
  vedno natanko en primerek
- Tip polja "Povezava" (URL) — validacija oblike, klikljiv prikaz v pregledu
- Datumsko polje z možnostjo zaklepa na "vedno točen dan" (brez izbirnika
  natančnosti) — za administrativne datume, ki morajo biti vedno natančni
- Premikanje skupin (kartic) gor/dol; upravljanje razdelkov znotraj skupine
  (dodaj/odstrani/premakni); premikanje pod-polj znotraj urejevalnika skupin
  in vrst mer
- Sledenje "Zadnji spremenil" (samodejno iz seje ob vsaki urejeni spremembi,
  po zgledu obstoječega "Vnesel"); prikaz "Nazadnje uredil" v podrobnostih in
  na tiskani kartici
- Admin urejevalnik reorganiziran v tri zavihke: Skupine, Polja, Nastavitve
  in podatki — širši modal za boljšo preglednost
- Predloga "SPECTRUM podrobno" (`templates/spectrum-podrobno.json`) — polna
  shema po specifikaciji uporabnika, 10 kartic, ~65 polj, z razdelki,
  sestavljenimi polji in povezavami

### Popravljeno
- `UI.tabify()` je pri gnezdenih zavihkih (npr. zavihki znotraj zavihkov v
  admin urejevalniku) napačno zajel plošče iz notranjega sistema zavihkov —
  popravljeno z omejitvijo na neposredne otroke

## [0.1.0] — testna različica pred prvo objavo

Prva zaokrožena, celovito testirana različica. Aplikacija še ni bila
uporabljena na pravem izobraževanju — to velja upoštevati pri branju spodnjega
seznama, saj je marsikaj nastalo in bilo popravljeno znotraj iste testne faze.

### Dodano
- Osnovna arhitektura: EventBus, IndexedDB (`db.js`), dinamičen obrazec za
  vnos predmetov, admin urejevalnik polj
- Skupine polj in zavihki (obrazec za vnos, podrobnosti predmeta, admin
  urejevalnik) — za preglednost pri večjem številu polj
- PIN zaščita za admin urejevalnik (deterrent pred nenamernimi kliki, ni prava
  avtentikacija)
- Upravljanje seje: ime vnašalca in naslov izobraževanja, prednapolnjeno za
  celotno sejo
- Izvoz/uvoz celotne baze kot `.json` (vključno s slikami/dokumenti), za
  arhiviranje in pregled na drugem računalniku
- Ponastavitev baze (izbriše vnose in sejo, ohrani shemo obrazca in PIN)
- Urejanje že vnesenih predmetov (ne samo dodajanje/brisanje)
- Tiskanje/PDF: posamezna kartica predmeta ali celoten katalog
- Ločitev **objavljene sheme obrazca** (`config.json`, enaka za vse
  obiskovalce, del GitHub/Vercel deploya) od **osnutka** (lokalna delovna
  kopija v admin urejevalniku) — kustos oblikuje shemo lokalno, jo izvozi in
  objavi z zamenjavo datoteke v repozitoriju
- Tip polja "Mere" po standardu CDWA (vrsta + vrednost + enota, poljubno
  število mer na predmet)
- Tip polja "Skupina" — ponavljajoč se sklop admin-definiranih pod-polj
  (npr. "Fotografije": slika + avtor + datacija + lastništvo; "Napisi":
  napis + lokacija); podpira poljubno število primerkov, vključno z več
  slikami/dokumenti na predmet
- Tip polja "Dokument" (PDF ipd., ločen file picker od slike)
- Natančnost datuma, izbirana ob vsakem vnosu: Dan / Mesec / Leto / Opisno
  (za približno datacijo, npr. "prva polovica 19. stoletja")
- Namigi (placeholder) v vnosnih poljih
- Premikanje polj gor/dol znotraj skupine; barvna oznaka polja (za
  označevanje polj, ki spadajo skupaj, ne glede na skupino/zavihek)
- Predloga "SPECTRUM jedro" (~26 polj po standardu SPECTRUM), na voljo za
  uvoz v osnutek z enim klikom
- Vizualna identiteta LOCUS: ime, barvna shema, placeholder za logotip
- Verzioniranje aplikacije in ta changelog

### Popravljeno
- Slika se ni prikazala pri tiskanju/PDF — tiskanje se je sprožilo, preden se
  je slika dejansko naložila
- Admin urejevalnik se je po vsaki spremembi premaknil na prvi zavihek in
  vrh strani namesto da ostane na mestu
- Kritična napaka: polje "Skupina" je slike/dokumente shranjevalo prek
  `JSON.stringify()`, kar uniči vsebino datoteke (slika/dokument se je
  izgubila ob shranjevanju) — popravljeno z branjem datotek neposredno iz
  žive strukture, mimo JSON pretvorbe
- Prikaz "čipa" pri dodajanju slike/dokumenta v skupini je kazal samo
  besedilo (ime datoteke), ne dejanske sličice — zdaj se prikaže prava
  sličica oz. prenosljiva povezava do dokumenta
- Postavitev datumskega polja je pri ožjih stolpcih (znotraj skupine)
  presegala širino obrazca
- Race condition pri hitrem zaporednem odpiranju modalnih oken (npr. pri
  nastavljanju PIN-a) je povzročil navidezno "zamrznitev" vmesnika

### Spremenjeno
- Slike/dokumenti se zdaj shranjujejo pod svojim poljem (`values`), ne več
  na enem posebnem, skupnem mestu na predmetu — omogoča več slikovnih/
  dokumentnih polj na obrazcu
- Odstranjeno podvajanje kode med moduli (skupna `escapeHtml`,
  `groupFieldsIntoSections`, `DEFAULT_FIELD_COLOR`, `renderTabsHtml` v
  `utils.js`/`ui.js`)

### Znane omejitve
- PIN je deterrent pred nenamernimi kliki, ni prava avtentikacija (frontend
  brez strežnika)
- IndexedDB je vezan na posamezen brskalnik/napravo — izvoz/uvoz je edini
  način za deljenje podatkov med računalniki
- Entries, vneseni pred to verzijo (star način shranjevanja slik), niso
  združljivi s tem izvozom/uvozom
