# Predaja — vzpostavitev gostovanja aplikacije Lokus

Ta dokument je namenjen naročniku (skrbniku), ki prevzema gostovanje in
upravljanje predane različice aplikacije. Sledite korakom po vrsti. Za
izvedbo ni potrebno predznanje programiranja.

Predana različica aplikacije je **1.0.0 z dne 30. 8. 2026** in vsebuje
modul **»Inventarna knjiga«**.

Po zaključku boste imeli aplikacijo, ki teče pod vašim lastnim GitHub in
Vercel računom, brez tehnične odvisnosti od računov razvijalca.

---

## 1. Ustvarite GitHub račun

GitHub je mesto, kjer bo shranjena izvorna koda predane različice
aplikacije.

1. Pojdite na [github.com/signup](https://github.com/signup).
2. Vnesite e-poštni naslov, geslo in uporabniško ime.
3. Potrdite e-poštni naslov (GitHub pošlje kodo za potrditev).
4. Pri vprašanju o naročniškem načrtu izberite brezplačni (**Free**) — za
   trenutno različico aplikacije zadostuje.

## 2. Ustvarite repozitorij in naložite predano kodo

Izvorna koda je naročniku predana v ZIP-paketu, ki je priložen tej
predaji. Paket vsebuje različico **1.0.0**.

1. V svojem GitHub računu ustvarite nov, prazen repozitorij, npr. z imenom
   `lokus`.
2. Razpakirajte ZIP-paket na svojem računalniku.
3. Vsebino razpakiranega paketa naložite v nov GitHub repozitorij.
4. Preverite, da so v repozitoriju prisotne vse datoteke predane različice,
   vključno z `README.md`, `CHANGELOG.md`, `PREDAJA.md`,
   `DEVELOPMENT.md` in `navodila_lokus.md`.

Razvijalec lahko po potrebi pomaga pri prvem prenosu kode, vendar za
nadaljnje upravljanje repozitorija pomoč ni potrebna.

**Opomba:** GitHub repozitorij, ki ga naročnik ustvari po tem postopku,
vsebuje predano različico aplikacije. Razvojna zgodovina in razvojni
repozitorij razvijalca nista del tega postopka predaje.

## 3. Ustvarite Vercel račun

Vercel je storitev, ki iz kode v GitHub repozitoriju samodejno vzpostavi
delujočo spletno stran.

1. Pojdite na [vercel.com/signup](https://vercel.com/signup).
2. Izberite **"Continue with GitHub"** in se prijavite z računom iz
   koraka 1 — s tem sta računa samodejno povezana, ločenega gesla za
   Vercel ni treba nastavljati.
3. Pri vprašanju o načrtu izberite brezplačni (**Hobby**) — za trenutno
   različico aplikacije zadostuje.

## 4. Ustvarite nov (produkcijski) Vercel projekt

To je aplikacija, ki jo bodo dejansko uporabljali sodelavci — ločena od
razvijalčevega testnega/razvojnega okolja.

1. V nadzorni plošči Vercel kliknite **"Add New" → "Project"**.
2. Med seznamom repozitorijev izberite svoj repozitorij iz koraka 2
   (če ga ne vidite, kliknite "Adjust GitHub App Permissions" in
   dovolite dostop do njega).
3. Framework Preset: pustite na **"Other"**.
4. Build Command in Output Directory pustite privzeto/prazno — gre za
   povsem statično stran, gradnja ni potrebna.
5. Kliknite **"Deploy"**. Po približno minuti bo stran živa, na naslovu
   v obliki `https://<ime-repozitorija>-<nekaj-znakov>.vercel.app`.
6. To je vaš produkcijski naslov — vpišite ga v `README.md`, pod
   "Aplikacija teče na:".

Od tu naprej vsak `git push` (ali nalaganje datoteke prek GitHub
spletnega vmesnika, glejte `README.md`) v ta repozitorij samodejno objavi
novo različico strani — brez dodatnih korakov na Vercelu.

## 5. (Neobvezno) Povežite lastno domeno

Če želite, da je aplikacija dosegljiva na vaši lastni domeni (npr.
`dokumentacija.vasa-ustanova.si`) namesto na `.vercel.app` naslovu:

1. V nastavitvah projekta na Vercelu odprite zavihek **"Domains"**.
2. Vpišite želeno domeno/poddomeno in sledite navodilom (Vercel prikaže,
   kateri DNS zapis je treba dodati pri vašem ponudniku domene).
3. To lahko naredite kadarkoli po predaji — ni nujno takoj.

## 6. Nastavite admin PIN in prvi vnos

Ob prvem odprtju aplikacije in kliku na "Uredi obrazec" boste pozvani k
nastavitvi admin PIN-a (glejte `navodila_lokus.md` za podrobnosti in
opozorilo, da PIN ni prava varnostna zaščita — priporočamo, da si ga
zapišete).

---

Za vsakodnevno uporabo aplikacije (vnos predmetov, nastavitve seje, admin
urejevalnik, izvoz/uvoz baze) glejte `navodila_lokus.md`.