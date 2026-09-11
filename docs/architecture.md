# Architektur

WebSafe ist eine dependency-freie Manifest-V3-Erweiterung für Brave und andere
Chromium-Browser.

## Komponenten

```text
src/
├── manifest.json
├── assets/icons/            Browser-Icons
├── background/              Navigation, Downloads und Extension-Zustand
├── content/                 MAIN-World-Pop-up-Wächter und DOM-Inhaltsprüfung
├── pages/                   Popup, Optionen und lokale Warnseiten
├── rules/                   deklarative Netzwerkregeln
└── shared/                  gemeinsam genutzte, testbare Filterlogik
```

Der Build kopiert ausschließlich `src/` nach `dist/`. Tests, Dokumentation und
Entwicklungsdateien gelangen dadurch nicht in das ausgelieferte Extension-Paket.

## Schutzfluss

1. Declarative Net Request stoppt bekannte Domains und eindeutige URL-Muster.
2. Der MAIN-World-Wächter blockiert fremde Skriptfenster und Download-Klicks vor
   der Seitenausführung.
3. Das isolierte Content Script untersucht DOM-Signale und entfernt Overlays.
4. Der Service Worker erzwingt SafeSearch und überwacht Download-Metadaten.
5. Einstellungen und Ausnahmen liegen ausschließlich in `chrome.storage.local`.

Die Filterlogik in `src/shared/filter.js` besitzt keine Browserabhängigkeit und
kann deshalb direkt mit Node.js getestet werden.
