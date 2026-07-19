# Changelog

Vse pomembnejše spremembe aplikacije so zabeležene tukaj. Format sledi
[Keep a Changelog](https://keepachangelog.com/), verzije pa
[semantičnemu verzioniranju](https://semver.org/) (MAJOR.MINOR.PATCH).

Trenutna verzija je zapisana na enem mestu v kodi: `APP_VERSION` v
`js/utils.js`. Prikazana je v nogi strani aplikacije in v vsaki izvoženi
arhivski datoteki (polje `locusVersion`). Ob vsaki pomembnejši spremembi:
1. Popravi `APP_VERSION` v `js/utils.js`.
2. Dodaj nov razdelek spodaj (najnovejši na vrhu).

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
