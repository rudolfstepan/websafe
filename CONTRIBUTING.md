# Contributing to WebSafe

Danke für dein Interesse an WebSafe. Beiträge zu Erkennungsqualität,
Fehlalarmvermeidung, Barrierefreiheit, Tests und Dokumentation sind willkommen.

## Entwicklung

Voraussetzung ist Node.js 20 oder neuer. Das Projekt verwendet derzeit keine
externen Laufzeit- oder Build-Abhängigkeiten.

```powershell
npm test
npm run build
```

Die entpackte Erweiterung wird aus `dist/` geladen. Nach einer Änderung zuerst
neu bauen und anschließend unter `brave://extensions` auf **Neu laden** klicken.

## Pull Requests

1. Erstelle einen eigenen Branch.
2. Beschreibe Problem, Lösung und mögliche Fehlalarme.
3. Ergänze Tests für neue Filterlogik.
4. Führe `npm run check` aus.
5. Vermeide externe Bibliotheken, Remote-Code und unnötige Berechtigungen.

Filteränderungen müssen nachvollziehbar, eng begrenzt und datenschutzfreundlich
sein. Reale pornografische oder schädliche Testdateien gehören nicht in dieses
Repository. Verwende ausschließlich harmlose Simulationen.

Sicherheitslücken bitte nicht in einem öffentlichen Issue veröffentlichen.
Beachte stattdessen [SECURITY.md](SECURITY.md).
