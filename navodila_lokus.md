# Lokus — navodila za administratorja

Aplikacija za evidentiranje muzejske dokumentacije. Deluje v celoti v
brskalniku (brez strežnika), podatki, ki jih uporabnik vnese v aplikacijo
(vneseni predmeti, slike, dokumenti) se hranijo **lokalno, v tem brskalniku, 
na tej napravi** (IndexedDB) in se ne pošiljajo na strežnik. 

To pomeni tudi: če nekdo v drugem brskalniku ali na drugem računalniku
odpre isti spletni naslov, **ne bo videl istih vnosov** — vsak brskalnik
ima svojo lastno bazo. Za prenos podatkov med napravami uporabite izvoz/
uvoz baze (glejte spodaj).

---

## 1. Glava strani — trije gumbi

V glavi aplikacije so trije gumbi:

| Gumb | Kaj naredi |
|---|---|
| **Nastavitve seje** | Nastavi naslov izobraževanja/seje in ime osebe, ki vnaša predmete. |
| **Uredi obrazec** | Odpre admin urejevalnik obrazca (zaščiten s PIN-om). Tu se ureja *struktura* obrazca — katera polja obstajajo, kako so razvrščena, katere vrednosti ponuja posamezen spustni seznam ipd. |
| **+ Dodaj predmet** | Odpre obrazec za vnos novega predmeta v zbirko. |

---

## 2. Nastavitve seje

Namenjeno predvsem izobraževanjem/delavnicam, kjer več ljudi zaporedoma
uporablja isto napravo.

- **Naslov izobraževanja** — pojavi se v naslovu natisnjenega kataloga.
- **Ime vnašalca** — vsak novo vnesen predmet dobi to ime kot "Vnesel".
  Uporabi se tudi pri poimenovanju izvožene datoteke baze.

Nastavitev ni obvezna — če jo izpustite, aplikacija normalno deluje, le
brez teh podatkov v izpisu/izvozu.

---

## 3. Vnos in urejanje predmetov

### Dodajanje predmeta
**+ Dodaj predmet** odpre obrazec, razdeljen na zavihke — vsak zavihek
ustreza eni "skupini" polj (npr. Identifikacija, Poimenovanje in
klasifikacija, Materialnost predmeta ...). Obvezna polja so označena z
rdečo zvezdico `*`. Ob vrhu vsakega zavihka je pika, ki opozori, če v tem
zavihku manjka obvezen podatek.

Nekatera polja imajo poleg imena majhno krožno ikono **"i"** — klik/hover
nanjo (ali na samo ime polja) prikaže kratko pojasnilo, npr. o pravilnem
zapisu (male/velike črke, pravopis ipd.).

### Pregled predmeta
Klik na kartico predmeta v seznamu odpre podrobnosti. Na vrhu so trije
gumbi:
- **Uredi** — odpre isti obrazec kot pri vnosu, s že izpolnjenimi podatki.
- **Natisni** — natisne kartico tega posameznega predmeta.
- **Izbriši** — trajno izbriše predmet (z varnostnim vprašanjem).

Ta pogled se zapre **samo** z gumbom "×" v zgornjem kotu ali s tipko
`Esc` — klik zunaj okna ga ne zapre (namerno, da se slučajno ne izgubi
pregled).

### Tiskanje celotnega kataloga
Gumb **"Natisni katalog"** (nad seznamom predmetov, poleg naslova
"Inventarna knjiga") natisne pregledno tabelo vseh predmetov v zbirki
(inventarna številka, naziv, nekaj ključnih polj, datum vnosa).

---

## 4. Admin urejevalnik obrazca ("Uredi obrazec")

Prvi klik na ta gumb od vas zahteva, da nastavite **admin PIN**
(najmanj 4 znaki) — tega nato vnašate ob vsakem naslednjem odpiranju
urejevalnika.

> ⚠️ **Pomembno:** ta PIN je namenjen preprečevanju *nenamernega* posega
> v obrazec (npr. da ga slučajno ne odpre udeleženec izobraževanja) — ni
> prava varnostna zaščita in ni namenjen varovanju občutljivih podatkov.
> PIN je shranjen samo lokalno v tem brskalniku; če ga pozabite, ga ni
> mogoče "obnoviti" — edina pot je ponastavitev baze (glejte spodaj), kar
> izbriše tudi vse vnesene predmete. **Priporočamo, da si PIN zapišete.**

Urejevalnik ima tri notranje zavihke: **Skupine**, **Polja**,
**Nastavitve in podatki**.

### 4.1 Osnutek vs. objavljena shema — najpomembnejši koncept

Vse, kar urejate v tem oknu, se shranjuje v **osnutek** (draft) — nekakšen
delovni zvezek. Uporabniki, ki v tem trenutku vnašajo predmete, tega ne
vidijo. Šele ko osnutek **izvozite** (zavihek "Nastavitve in podatki" →
"Izvozi shemo obrazca") in dobljeno datoteko `config.json` naložite na
strežnik (zamenjate datoteko v repozitoriju, `git push`, Vercel jo
samodejno objavi), spremembe postanejo "žive" za vse uporabnike.

To pomeni: spremembe lahko mirno preizkušate, dokler niste zadovoljni, in
jih šele nato objavite.

### 4.2 Zavihek "Skupine"

Skupine so **kartice/zavihki**, v katere je razdeljen obrazec za vnos
predmeta (npr. "Identifikacija", "Materialnost predmeta" ...). Znotraj
posamezne skupine lahko dodatno ustvarite **razdelke** (podnaslove, ki
ločijo polja znotraj iste kartice, npr. "Poimenovanje" in "Klasifikacija"
znotraj kartice "Poimenovanje in klasifikacija").

- Puščici ↑ ↓ premikata vrstni red skupin oz. razdelkov.
- "×" odstrani skupino/razdelek — **polja se ob tem ne izbrišejo**,
  temveč se prestavijo med "Brez skupine" oz. neuvrščena.
- Spodaj v obrazcu lahko dodate novo skupino (ime kartice), znotraj vsake
  skupine pa nov razdelek.

### 4.3 Zavihek "Polja"

Tu je seznam vseh polj obrazca, razvrščenih po skupinah (z lastnimi
notranjimi zavihki), in spodaj obrazec za dodajanje/urejanje polja.

**Seznam polj:** puščici ↑ ↓ premikata polje znotraj skupine, svinčnik ✎
odpre polje za urejanje, "×" ga odstrani.

> ⚠️ Odstranitev polja izbriše tudi njegovo definicijo iz sheme. Že
> vneseni podatki v obstoječih predmetih za to polje ostanejo v bazi, a
> jih po odstranitvi polja iz sheme ni več mogoče videti/urejati prek
> obrazca. Priporočamo previdnost — če niste prepričani, polje raje
> premaknite iz vidne skupine, kot da ga izbrišete.

**Nastavitve pri dodajanju/urejanju polja:**

| Nastavitev | Opis |
|---|---|
| Ime polja | Prikazani naziv (napis) polja. |
| Skupina / Razdelek | V katero kartico in razdelek polje spada. |
| Tip polja | Besedilo, število, datum, spustni seznam, slika, dokument, mere (tip/vrednost/enota), skupina (pod-polja) ... |
| Možnosti | Za spustne sezname — vrednosti, ločene z vejico. |
| Namig (placeholder) | Sivo besedilo v praznem polju, ki nakaže format vnosa. |
| Pojasnilo (tooltip) | Besedilo, ki se prikaže ob hoveru/fokusu na ime polja ali na ikono "i" — za dodatna navodila glede zapisa. |
| Vedno točen dan | Pri datumskih poljih: onemogoči izbiro manj natančnega datuma (samo leto ipd.). |
| Barva oznake | Barvna oznaka roba polja — poljem, ki spadajo skupaj (ne glede na skupino), lahko dodelite isto barvo za hitro prepoznavo. |
| Poudari z barvo ozadja | Polje dobi rahlo obarvano ozadje namesto le obrobe. |
| Samodejno rastoče besedilno polje | Za besedilna polja: polje se med tipkanjem širi navzdol, namesto da besedilo obreže v eno vrstico. |
| Obvezno polje | Obrazca ni mogoče shraniti, dokler polje ni izpolnjeno. |

Pri tipu **"skupina"** (za sestavljena/ponavljajoča polja, npr.
"Avtorstvo" ali "Viri – slike") dodatno določite pod-polja in ali je
skupina **ponavljajoča** (uporabnik lahko doda več primerkov, npr. več
avtorjev) ali ne (en sam, stalen niz pod-polj, npr. "Čas izdelave").

Pri tipu **"mere"** določite dovoljene vrste mer (npr. Višina, Teža) in
za vsako dovoljene enote (npr. cm, mm, m).

### 4.4 Zavihek "Nastavitve in podatki"

**Shema obrazca:**
- **Izvozi shemo obrazca (config.json)** — prenese trenutni osnutek kot
  datoteko, ki jo objavite (glejte 4.1).
- **Ponastavi osnutek na objavljeno shemo** — zavrže neshranjene
  spremembe v osnutku in ga povrne na trenutno objavljeno stanje.
- **Uvozi shemo (JSON)** — naloži shemo iz datoteke v osnutek (npr. če
  ste jo urejali/pripravili drugje).
- **Naloži predlogo: SPECTRUM jedro** — nadomesti osnutek z manjšo,
  osnovno SPECTRUM shemo (26 polj).
- **Naloži predlogo: SPECTRUM podrobno (10 kartic)** — nadomesti osnutek
  s polno, razširjeno SPECTRUM shemo (privzeta shema te aplikacije,
  ~66 polj).

> Vse štiri zgornje akcije **prepišejo trenutni osnutek** — aplikacija
> pred tem vedno vpraša za potrditev, saj se neshranjene spremembe
> izgubijo.

- **Spremeni admin PIN** — nastavi nov PIN za dostop do tega urejevalnika.

**Upravljanje podatkov** (nanaša se na vnesene predmete, ne na shemo):
- **Izvozi bazo** — prenese vse vnesene predmete, slike/dokumente in
  trenutno objavljeno shemo kot eno `.json` datoteko. To je **varnostna
  kopija** — priporočamo redno izvažanje, saj so podatki sicer samo v
  tem brskalniku.
- **Uvozi bazo** — naloži tako izvoženo datoteko nazaj (npr. na drugi
  napravi, ali kot obnovitev po ponastavitvi).
- **Ponastavi bazo** — trajno izbriše vse vnesene predmete in podatke
  seje **na tej napravi**. Objavljena shema obrazca in PIN ostaneta
  nespremenjena. Uporabno npr. med dvema zaporednima skupinama na
  izobraževanju — pred tem obvezno izvozite bazo, če želite podatke
  ohraniti.

---

## 5. Logotip

Logotip v glavi strani se nastavi tako, da datoteko poimenujete natanko
`logo.png` in jo naložite v mapo `assets/` v repozitoriju aplikacije
(glejte tudi `assets/README.md`). Razmerje stranic ni pomembno — slika
se samodejno prilagodi (do 50 px višine, do 210 px širine). Dokler
datoteke ni, se prikaže nadomestna oznaka, tako da glava strani nikoli
ni videti "polomljena".

---

## 6. Priporočila za redno uporabo

- **Redno izvažajte bazo** (Nastavitve in podatki → Izvozi bazo) —
  podatki obstajajo samo lokalno, v tem brskalniku. Če nekdo počisti
  podatke brskalnika, zamenja napravo ali brskalnik, ali če pride do
  napake, so brez izvožene varnostne kopije podatki nepovratno izgubljeni.
- **PIN si zapišite** na varno mesto — ni ga mogoče obnoviti.
- **Spremembe sheme najprej preizkusite v osnutku**, preden jih objavite
  — dokler ne izvozite in objavite `config.json`, uporabniki sprememb ne
  vidijo, zato lahko mirno eksperimentirate.
- Ker vsak brskalnik/naprava hrani svojo lastno bazo predmetov, za delo
  na **več napravah hkrati** uporabite izvoz/uvoz baze za prenos
  podatkov med njimi (aplikacija ju ne sinhronizira samodejno).
