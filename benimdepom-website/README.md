# Benim Depom – Website

Trilinguale (DE/EN/TR) B2B-Landingpage für Benim Depom (Betreiber: Mobiliya 1959).

## Dateien

- `index.html` – Die komplette Website. Single-File-Architektur: kein Build-Prozess, kein Framework, keine externen Abhängigkeiten außer Google Fonts. Alle Bilder sind aktuell als Base64-Data-URIs direkt in die Datei eingebettet, damit sie ohne weitere Dateien funktioniert.
- `assets/` – Die Originalbilder unkomprimiert als separate Dateien (Logo, "So funktioniert es"-Infografik in 3 Sprachen, Free-Banner in 3 Sprachen). Diese sind bereits base64-kodiert in `index.html` enthalten – die Dateien hier sind nur zur Referenz bzw. falls ihr die Bilder stattdessen als externe Dateien einbinden wollt (siehe "Empfehlung für Produktion" unten).

## Deployment

`index.html` kann direkt auf jeden Webserver / jedes Hosting (z. B. Netlify, Vercel, klassisches Shared Hosting, Nginx/Apache) hochgeladen werden. Keine Server-Logik nötig, reines Static Hosting reicht.

## Struktur / Aufbau

- **`<head>`**: Meta-Tags (Title/Description/Keywords werden zusätzlich per JS bei Sprachwechsel aktualisiert), Google Fonts, komplettes `<style>`.
- **`<body>`**: Header mit Sprachumschalter (DE/EN/TR), mobiles Menü, Startseite (`#view-home`) mit ca. 25 Sektionen, Login-Ansicht, Impressum-Ansicht, Footer, WhatsApp-Float-Button.
- **`<script>`**: 
  - `I18N` – zentrales Übersetzungsobjekt (`I18N.de`, `I18N.en`, `I18N.tr`) mit sämtlichen Texten.
  - `applyLang(lang)` / `setLang(lang)` – rendert die gewählte Sprache, aktualisiert Meta-Tags, speichert die Wahl in `localStorage` (Key: `bd_lang`).
  - Diverse `renderX()`-Funktionen für dynamisch generierte Listen (Nav, Karten, Timeline, FAQ, Formulare, Footer usw.).
  - Hash-basiertes Routing für Home/Login/Impressum (`showView(hash)`).
  - `FREE_BANNER_IMG` / `MOBILE_UPLOAD_IMG` – Objekte mit den sprachspezifischen Bild-Data-URIs für den Free-Banner und die "So funktioniert es"-Grafik; werden bei Sprachwechsel automatisch getauscht.

## Sprache ändern / Texte bearbeiten

Alle Texte befinden sich im `I18N`-Objekt im `<script>`-Bereich, gruppiert nach Sprache (`de`, `en`, `tr`) und Sektion (z. B. `hero`, `faq`, `footer`). Ein Text ändern = den entsprechenden String im `I18N`-Objekt anpassen, keine weiteren Schritte nötig.

Standardsprache beim ersten Besuch: Türkisch (`let startLang = 'tr'`, zu finden im Init-Bereich am Ende des Scripts). Danach merkt sich die Seite die Wahl des Nutzers per `localStorage`.

## Kontakt-/Rechtsdaten (aktuell im Footer/Impressum hinterlegt)

- Betreiber: Mobiliya 1959
- Adresse: Alanyurt Yenimahalle Yavuz Selim Sultan Caddesi No:12, Türkiye, Bursa, İnegöl
- E-Mail: info@mobilya1959.com
- WhatsApp: +90 546 450 55 30

## Empfehlung für Produktion

Aktuell sind alle Bilder als Base64 in `index.html` eingebettet (einfacher Single-File-Deploy, aber größere HTML-Datei ohne Browser-Caching der Bilder). Für bessere Ladezeiten in Produktion empfiehlt es sich, die Dateien aus `assets/` stattdessen als normale `<img src="...">`-Referenzen einzubinden (bzw. per CDN auszuliefern) und die Base64-Strings aus der HTML zu entfernen.

## Bekannte offene Punkte

- Einige der vom Kunden bereitgestellten Marketing-Banner (Kostenvergleich, Lagerbestand-Banner) sind noch nicht final positioniert, da sie teilweise sichtbare Nicht-Möbel-Objekte (z. B. Laptop-Tastatur) zeigen oder noch nicht in allen drei Sprachen vorliegen.
