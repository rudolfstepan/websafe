# Threat Model

## Ziele

WebSafe reduziert unerwartete Konfrontation mit expliziten Inhalten und typische
Risiken werbelastiger Download-Seiten: Pop-ups, Weiterleitungen, Scareware,
Drive-by-Downloads und riskante Dateitypen.

## Abgedeckte Angriffe

- bekannte oder eindeutig benannte Adult-Ziele
- automatische und fremde `window.open`-Aufrufe
- nachgeladene Adult- und Scareware-Overlays
- ausführbare, skriptfähige, makrofähige oder getarnte Downloads
- nachträgliche Gefahrenbewertungen durch Brave
- unverschlüsselte öffentliche Downloads

## Grenzen

- keine Pixelklassifikation vollständig neutral benannter Bilder
- keine Untersuchung des Dateiinhalts oder entpackter Archive
- keine Garantie gegen unbekannte Zero-Day-Malware
- keine systemweite Filterung außerhalb des Browserprofils
- Ausnahmen und pausierter Schutz können die Filterung bewusst umgehen

Für echte Datei-Scans wäre ein separat installierter Native-Messaging-Dienst mit
einem lokalen Virenscanner erforderlich. Dieser gehört bewusst nicht zum
aktuellen, rein browserbasierten Umfang.
