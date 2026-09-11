<p align="center">
  <img src="assets/branding/websafe-icon.png" width="128" alt="WebSafe Schutzschild">
</p>

<h1 align="center">WebSafe</h1>

<p align="center">
  Lokaler Schutz für Brave und Chromium vor unerwarteten Adult-Inhalten,<br>
  aggressiven Pop-ups, Scareware und riskanten Downloads.
</p>

<p align="center">
  <a href="https://github.com/rudolfstepan/websafe/actions/workflows/ci.yml"><img src="https://github.com/rudolfstepan/websafe/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-168a64" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/Manifest-V3-168a64" alt="Manifest V3">
</p>

WebSafe wurde besonders für werbelastige Download-Seiten entwickelt. Die
Erweiterung kombiniert Browserregeln, frühe Seiteneingriffe, lokale
Inhaltserkennung und Braves Download-Bewertung. Es werden keine besuchten URLs
oder Seiteninhalte an den Entwickler oder einen externen Analysedienst gesendet.

## Funktionen

- blockiert bekannte Adult-Domains und eindeutige URL-Muster vor dem Laden
- stoppt automatische Pop-ups und fremde, skriptgesteuerte Fenster
- entfernt verdächtige Adult-Einbettungen und nachgeladene Werbe-Overlays
- erkennt typische gefälschte Viren- und Supportwarnungen
- erzwingt SafeSearch bei Google, Bing, DuckDuckGo, Brave Search und Yahoo
- blockiert ausführbare Dateien, Skripte, Verknüpfungen und Makro-Dokumente
- erkennt irreführende Doppel-Endungen wie `Rechnung.pdf.exe`
- stoppt öffentliche Downloads über unverschlüsseltes HTTP
- reagiert auf nachträgliche Gefahrenbewertungen durch Brave
- bietet lokale Einstellungen, Domain-Ausnahmen und Blockzähler

Gewöhnliche PDFs, Bilder, Medien und normale Archive werden nicht allein wegen
ihrer Dateiendung blockiert.

## Installation für Anwender

Vorgebaute Pakete werden nach einem Release unter **Releases** bereitgestellt.
Bis dahin kann WebSafe direkt aus dem Quellcode gebaut werden.

1. Repository herunterladen oder klonen.
2. Im Projektordner `npm run build` ausführen.
3. In Brave `brave://extensions` öffnen.
4. Den **Entwicklermodus** aktivieren.
5. **Entpackte Erweiterung laden** wählen und den erzeugten Ordner `dist/`
   auswählen.
6. WebSafe an die Symbolleiste anheften.

Für private Fenster muss unter **Details** zusätzlich „Im Inkognitomodus
zulassen“ aktiviert werden.

## Entwicklung

Voraussetzung ist Node.js 20 oder neuer. Es sind keine externen npm-Pakete
erforderlich.

```powershell
git clone https://github.com/rudolfstepan/websafe.git
cd websafe
npm run check
```

Wichtige Befehle:

```powershell
npm test       # Unit- und Manifesttests
npm run build  # erzeugt die ladbare Extension unter dist/
npm run check  # Tests und Build
```

## Projektstruktur

```text
websafe/
├── .github/                  Workflows und Community-Vorlagen
├── assets/branding/          hochauflösendes Markenmaterial
├── docs/                     Architektur und Bedrohungsmodell
├── scripts/                  dependency-freier Build
├── src/                      ausgelieferter Extension-Quellcode
│   ├── assets/icons/
│   ├── background/
│   ├── content/
│   ├── pages/
│   ├── rules/
│   ├── shared/
│   └── manifest.json
├── tests/
│   ├── manual/               harmlose interaktive Testseite
│   ├── unit/
│   ├── validate-extension.js
│   └── validate-website.js
└── website/                  statische Projektwebsite
```

Weitere technische Details stehen in der
[Architekturbeschreibung](docs/architecture.md) und im
[Bedrohungsmodell](docs/threat-model.md).

## Harmlose interaktive Testseite

```powershell
python -m http.server 8765 --directory .
```

Danach in Brave öffnen:

```text
http://localhost:8765/tests/manual/test-page.html
```

Die Seite simuliert Pop-ups, Adult- und Scareware-Overlays sowie einen nur dem
Namen nach riskanten Download. Sie enthält weder pornografische Bilder noch
Malware. Den Server anschließend mit `Strg+C` beenden.

## Sicherheit und Grenzen

WebSafe ergänzt den Browser, ersetzt aber keinen Virenscanner. Braves Safe
Browsing unter `brave://settings/security`, Betriebssystem und Virenscanner
sollten aktuell und aktiviert bleiben. Eine Browser-Erweiterung kann keine
vollständige Pixelanalyse und keine Untersuchung entpackter Archive oder des
gesamten Dateiinhalts durchführen.

Sicherheitslücken bitte gemäß [SECURITY.md](SECURITY.md) privat melden. Details
zur lokalen Datenverarbeitung stehen in [PRIVACY.md](PRIVACY.md).

## Mitwirken

Beiträge sind willkommen. Bitte zuerst [CONTRIBUTING.md](CONTRIBUTING.md) und
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) lesen. Reale Malware und explizite
Medien dürfen nicht als Testmaterial in dieses Repository aufgenommen werden.

## Lizenz

WebSafe steht unter der [MIT-Lizenz](LICENSE).

## Projektwebsite

Die statische, responsive Landingpage liegt unter `website/` und benötigt weder
Buildschritt noch externe Bibliotheken. Für eine lokale Vorschau:

```powershell
python -m http.server 8080 --directory website
```

Danach `http://localhost:8080` öffnen.
