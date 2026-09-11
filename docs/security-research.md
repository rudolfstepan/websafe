# WebSafe: aktuelle Web-Bedrohungsmuster und Grenzen einer Chrome-Erweiterung

**Stand:** 11. September 2026  
**Untersuchungszeitraum:** Schwerpunkt 2023–2026; ältere Arbeiten nur, wenn sie ein weiterhin relevantes Angriffsmuster technisch begründen.  
**Zweck:** Entscheidungsgrundlage für Maintainer, Sicherheitsreview und Chrome-Web-Store-Einreichung.

## Kurzfassung

WebSafe kann die Wahrscheinlichkeit deutlich senken, beim Surfen auf werbelastigen Download-Seiten unerwartet mit pornografischen Inhalten, aggressiven Overlays, Fake-Warnungen und offensichtlich riskanten Downloads konfrontiert zu werden. Eine Chrome-Erweiterung kann dafür Netzwerkregeln, DOM-Analyse, Navigationsbeobachtung und die Downloads-API kombinieren. Sie kann jedoch weder ein vollständiges Antivirusprogramm ersetzen noch zuverlässig alle Browser-Exploits, verschleierten Bilder, Archive oder sozial manipulierten Benutzeraktionen verhindern.

Die am besten belegten aktuellen Muster sind:

1. **Malvertising und Traffic-Distribution-Systeme (TDS):** Anzeigen, kompromittierte Websites, Redirect-Ketten und Cloaking führen abhängig von Region, Betriebssystem oder Browser zu Fake-Download-Seiten und Malware. Mandiant, Microsoft und Proofpoint beschreiben dieses Muster anhand beobachteter Kampagnen und konkreter Payloads.[^1][^2][^3]
2. **Fake-Updates, ClickFix und Fake-CAPTCHAs:** Die Seite fordert den Benutzer auf, Befehle zu kopieren und in PowerShell, `mshta`, „Ausführen“ oder ein Terminal einzufügen. Das umgeht viele rein technische Downloadkontrollen, weil der Benutzer selbst die Ausführung anstößt. Mehrere unabhängige Forschungsgruppen dokumentieren dieselbe Technik und verschiedene Tätergruppen.[^4][^5][^6]
3. **HTML-Smuggling und verschachtelte Container:** JavaScript setzt eine Datei erst im Browser aus Daten zusammen; Archive, ISO-Dateien, LNKs und Doppelendungen verschleiern den tatsächlich ausführbaren Inhalt. Das Muster ist durch Microsoft, MITRE ATT&CK und reale CVEs belegt.[^7][^8][^9]
4. **Drive-by-Exploitation von Browser-Lücken:** Aktiv ausgenutzte Chromium-Schwachstellen zeigen, dass schon das Laden präparierter Webinhalte genügen kann. Eine Erweiterung läuft nicht unterhalb der Browser-Engine und kann solche Fehler nicht verlässlich abfangen oder reparieren.[^10][^11][^12]
5. **Kurzlebige, kontextabhängige Infrastruktur:** Angreifer verwenden legitime Cloud- und Webdienste, Linkverkürzer, wechselnde Domains und dynamisch erzeugte Archive. Eine statische Domainliste ist deshalb nur eine Schicht, keine ausreichende Lösung.[^13][^14]

Für das Produktversprechen „automatischer Schutz auf allen besuchten Webseiten“ ist `<all_urls>` sachlich begründbar. `activeTab` wäre keine gleichwertige, datensparsamere Alternative: Es gewährt Zugriff erst nach einer ausdrücklichen Benutzeraktion und käme daher für überraschend eingeblendete Inhalte zu spät.[^15] Die breite Hostberechtigung muss dennoch mit lokaler Verarbeitung, minimalen Zusatzberechtigungen, verständlicher Offenlegung und einem klar begrenzten Zweck abgesichert werden.

Die wichtigsten konkreten Änderungen für WebSafe sind:

- `tabs` voraussichtlich entfernen, weil die übrigen Berechtigungen und Hostrechte die derzeit benötigten Funktionen abdecken; anschließend alle UI- und Downloadflüsse testen.
- Nachrichten aus Content Scripts nicht als vertrauenswürdiges Urteil übernehmen. URL und Sperrgrund im Service Worker anhand von `sender.tab` und eigener Filterlogik neu bestimmen.
- Popup-, Overlay- und Downloadentscheidungen in **Blockieren**, **Warnen** und **Zulassen** staffeln. Pauschales Blockieren externer Fenster und aller ausführbaren oder makrofähigen Dateien erzeugt erhebliche False Positives.
- Mutationen an Attributen, offene Shadow Roots, Unicode-Normalisierung und mehrsprachige Varianten ergänzen. Bildbasierte Erkennung nur als lokale, optionale und fehlertolerante Zusatzschicht behandeln.
- Produkttexte auf „reduziert das Risiko“ begrenzen. Keine Aussage sollte vollständigen Malware-, Viren-, Zero-Day- oder Jugendschutz garantieren.

## 1. Methode und Evidenzbewertung

Die Recherche bevorzugt Primärquellen: Hersteller-Advisories und offizielle Release Notes, Einträge im CISA-Katalog bekanntermaßen ausgenutzter Schwachstellen, MITRE-ATT&CK-Techniken, begutachtete Konferenzarbeiten sowie technische Veröffentlichungen etablierter Threat-Intelligence-Gruppen. Sekundäre Zusammenfassungen, Affiliate-Inhalte und reine Produktwerbung wurden nicht als Nachweis für Häufigkeit oder Wirksamkeit verwendet.

Die Aussagen werden in drei Evidenzklassen getrennt:

| Klasse | Bedeutung | Beispiele |
|---|---|---|
| **A – stark belegt** | Offizielles Advisory/CVE mit bestätigter Ausnutzung, reproduzierbare technische Analyse oder begutachtete Forschung mit nachvollziehbarer Methodik | Chrome Release Notes, CISA KEV, USENIX-Paper |
| **B – operativ belegt** | Primärbericht einer etablierten Forschungsgruppe mit beobachteter Kampagne, Samples, Ablauf, IOCs oder Telemetrie; mögliche Herstellerinteressen bleiben zu berücksichtigen | Microsoft Threat Intelligence, Mandiant/GTIG, Proofpoint |
| **C – Behauptung oder Vorindiz** | Einzelner Blog ohne Methodik, Marketingaussage, nicht replizierte Messung oder Preprint | „blockiert 100 %“, ungeprüfte Prävalenzzahlen, kleine ML-Demodatensätze |

Ein Vendor-Blog ist nicht automatisch schwach. Ein Bericht mit benannter Kampagne, technischen Artefakten und nachvollziehbarer Angriffskette ist belastbare operative Evidenz, aber keine unabhängige Bevölkerungsstudie. Exakte Marktanteile oder globale Häufigkeiten aus der Telemetrie eines einzelnen Herstellers dürfen daher nur für dessen beobachtete Population interpretiert werden.

## 2. Belegte aktuelle Angriffsmuster

### 2.1 Malvertising, Redirect-Ketten und gefälschte Installer

MITRE beschreibt Drive-by Compromise als Kombination aus kompromittierten Websites, bösartigen Anzeigen, eingebetteten Frames, Push-Nachrichten und Exploit- oder Downloadauslieferung.[^16] Die aktuelle Angriffspraxis ist meist keine einzelne „böse URL“, sondern eine Kette:

```text
Anzeige / kompromittierte Seite
  → Redirector oder Linkverkürzer
  → Fingerprinting / Cloaking / TDS
  → Fake-Download- oder Fake-Update-Seite
  → Archiv, Installer, LNK oder Benutzerbefehl
  → Loader / Infostealer / RAT
```

Mandiant verfolgte rund 30 Cluster, die Werbeplattformen missbrauchten, darunter Kampagnen mit Such- oder Social-Media-Anzeigen, Cloaking und Payloads wie DARKGATE und DANABOT.[^1] Proofpoint dokumentiert bei SocGholish kompromittierte Websites, injiziertes JavaScript, Umgebungsfilterung und täuschend echte Vollbild-Updates.[^3] Microsoft beschrieb 2025 Malvertising, das über legitim wirkende Wix-Seiten gefälschte Installer und danach DLL-, PowerShell- und Node.js-Stufen auslieferte.[^2]

Im September 2026 dokumentierte Microsoft erneut gefälschte Software-Download-Seiten, rotierende Domains und dynamisch erzeugte ZIP-Dateien, die trotz gleichem Namen unterschiedliche Hashes hatten.[^17] Das ist wichtig für WebSafe: Eine feste Hash- oder Domainliste altert schnell; URL- und Dateinamenssignale müssen mit Browserurteilen, Herkunft, Benutzerinteraktion und gegebenenfalls Endpoint-Schutz kombiniert werden.

**Evidenzurteil:** Das Grundmuster ist stark und mehrfach belegt (A/B). Aussagen wie „jede Download-Seite mit Werbung ist infiziert“ oder „HTTPS bedeutet sicher“ sind dagegen unbelegt beziehungsweise falsch. HTTPS schützt nur den Transport; eine HTTPS-Seite kann absichtlich oder nach Kompromittierung Malware verteilen.

### 2.2 ClickFix, Fake-CAPTCHA und Fake-Browser-Updates

ClickFix verschiebt die kritische Aktion zum Benutzer. Eine Webseite zeigt beispielsweise ein angebliches CAPTCHA oder einen Browserfehler, kopiert einen Befehl in die Zwischenablage und fordert dazu auf, `Win+R`, Einfügen und Enter zu drücken. Der Befehl lädt oder startet dann weitere Stufen. Proofpoint beobachtete 2024 unter anderem AsyncRAT, DanaBot, DarkGate, Lumma und NetSupport; Microsoft berichtete 2025 von täglich Tausenden betroffenen Unternehmens- und Endgeräten.[^4][^5]

Mandiant ordnet kompromittierte legitime Websites seit Juni 2024 einer Kampagne zu, die Fake-CAPTCHAs für ClickFix verwendete.[^6] Google dokumentierte dieselbe Grundtechnik auch bei staatlich unterstützten Akteuren.[^18] Die wiederholte Beobachtung durch unterschiedliche Forschungsgruppen und mit unterschiedlichen Payloads spricht gegen eine bloße Blogerzählung.

Technisch problematisch für eine Browser-Erweiterung:

- Es muss nicht zwingend ein klassischer Download über `chrome.downloads` stattfinden.
- PowerShell, `mshta`, `rundll32` oder ein Terminal liegen außerhalb der Extension-Sandbox.
- Der Klick auf „Verify“ kann eine echte Benutzeraktivierung erzeugen; allein „war automatisiert“ ist dann kein ausreichendes Signal.
- Text, Bild und Zwischenablagebefehl können dynamisch, verschleiert oder erst nach Interaktion erscheinen.

WebSafe kann typische Anweisungen erkennen, verdächtige Overlays entfernen und vor dem Kopieren warnen. Es kann aber nicht zuverlässig verhindern, dass der Benutzer einen bereits kopierten Befehl außerhalb des Browsers ausführt. Ein pauschales Abfangen jeder Zwischenablageaktion würde legitime Copy-Buttons, Passwortmanager, Codebeispiele und Office-Webapps beeinträchtigen und eine zusätzliche Warnberechtigung auslösen.

**Evidenzurteil:** ClickFix/Fake-CAPTCHA ist operativ stark belegt (B, teilweise A über korrespondierende Malware- und Infrastrukturartefakte). Werbeaussagen, ein einzelner lokaler ML-Filter erkenne „alle neuen ClickFix-Seiten“, sind nicht belegt.

### 2.3 Scareware und Tech-Support-Betrug

Scareware imitiert System- oder Antivirusdialoge, erzwingt Vollbild, spielt Alarmtöne ab, blockiert scheinbar Eingaben und fordert zu Anruf, Fernwartung oder Download auf. Microsofts Digital Defense Report 2024 ordnete in der eigenen SmartScreen-Telemetrie mehr als 90 Prozent des als bösartig erkannten Edge-Verkehrs 2022–2024 Tech-Scams zu.[^19] Diese Zahl ist relevant, aber nicht ohne Weiteres auf Brave, alle Regionen oder das gesamte Web übertragbar.

Microsoft Edge setzt inzwischen zusätzlich zu Reputationslisten ein lokales Modell für Vollbild-Scareware ein und verlässt bei einem Treffer den Vollbildmodus, stoppt Audio und zeigt eine Warnung.[^20] Das belegt die technische Plausibilität einer lokalen Verhaltens- oder Bildklassifikation, nicht aber eine garantiert fehlerfreie Erkennung. Selbst Microsoft sieht Benutzerfeedback für False Positives vor.

WebSafe kann Textmuster, Telefonlinks, Vollbildzustand, aggressive Audioelemente und Overlaygeometrie als kombinierte Signale verwenden. Das bloße Auftreten von Wörtern wie „Virus“, „Support“ oder „kritisch“ genügt nicht: Sicherheitsportale, Hilfeseiten und echte Warnhinweise verwenden dieselben Begriffe.

**Evidenzurteil:** Scareware als Muster ist stark belegt (A/B). Die konkrete Microsoft-Prävalenzzahl ist eine nicht unabhängig replizierte Herstellertelemetrie und muss als solche beschriftet bleiben.

### 2.4 HTML-Smuggling, Blob-Downloads und Container

Beim HTML-Smuggling wird der Dateikörper durch JavaScript im Browser zusammengesetzt, häufig über `Blob`, `URL.createObjectURL()` und das `download`-Attribut. Dadurch kann die Netzwerkschicht nur eine scheinbar harmlose HTML-Seite sehen. Microsoft dokumentierte das Verfahren in Kampagnen mit Banking-Malware, RATs und Trickbot; MITRE führt es als T1027.006.[^7][^8]

Danach folgen oft Container oder Tarnung: ZIP/RAR/7z, ISO/IMG, LNK, JavaScript, HTA oder eine doppelte Endung wie `Dokument.pdf.js`. Google Threat Intelligence beschrieb 2025 genau eine `.pdf.js`-Tarnung.[^21] CVE-2024-38112 zeigte zudem, wie eine `.url`-Datei über einen Internet-Explorer-Pfad die eigentliche HTA-Dateiendung verschleiern konnte; die Lücke wurde nach beobachteter Ausnutzung im Juli 2024 gepatcht.[^9]

Eine Extension kann bekannte Endungen, MIME-Angaben, unverschlüsselten Transport und Browser-Gefahrenurteile prüfen. Sie erhält über die Downloads-API aber keinen allgemeinen, sicheren Zugriff auf den vollständigen Dateikörper, digitale Signaturen oder entpackte Archive. Außerdem wird `downloads.onCreated` ausgelöst, wenn der Download bereits begonnen hat; ein anschließendes `cancel()` minimiert, aber beseitigt das Zeitfenster nicht.[^22]

**Evidenzurteil:** HTML-Smuggling und Container-Tarnung sind stark belegt (A/B). Nicht belegt wäre die Behauptung, jede ZIP-, ISO-, Skript- oder Makrodatei sei Malware.

### 2.5 Browser-Zero-Days und echte Drive-by-Angriffe

Aktiv ausgenutzte Chromium-Lücken setzen eine harte Grenze für WebSafe. Kaspersky analysierte 2025 „Operation ForumTroll“: Das Anklicken eines personalisierten, kurzlebigen Links führte ohne weitere Benutzerhandlung zur Infektion; CVE-2025-2783 ermöglichte das Umgehen der Sandbox und wurde am 25. März 2025 behoben.[^10] CISA führt sowohl diese Lücke als auch CVE-2025-5419, eine über präpariertes HTML erreichbare Out-of-Bounds-Schwachstelle in V8, im Katalog nachweislich ausgenutzter Schwachstellen.[^39] Googles Chrome-Release-Notes bestätigten 2026 weitere in freier Wildbahn ausgenutzte Lücken, darunter CVE-2026-5281 in Dawn und CVE-2026-11645 in V8.[^11][^12]

Eine Content-Extension wird von derselben Browserplattform ausgeführt, deren Renderer, Grafik- oder JavaScript-Engine angegriffen wird. Sie ist kein vorgeschalteter Exploit-Broker. DOM-Textanalyse kann zudem erst nach Beginn der Navigation oder Ausführung greifen. Netzwerkregeln helfen nur, wenn die Zieladresse oder ein Request-Muster vorher bekannt ist.

**Folge:** Automatische Browserupdates, Safe Browsing beziehungsweise Brave-eigene Schutzmechanismen, Betriebssystempatches und Endpoint-Schutz bleiben zwingend. WebSafe darf hier nur als zusätzliche Expositionsreduktion beworben werden.

### 2.6 Missbrauch legitimer Cloud- und Webdienste

Eine begutachtete USENIX-Studie untersuchte 10.000 Malware-Samples und fand 893 Samples aus 97 Familien, die 29 legitime Webanwendungen für Teile der Angriffskette missbrauchten; gegenüber 2020 wurde in der untersuchten Population ein Anstieg von 226 Prozent gemessen.[^13] Die Zahlen sind datensatzbezogen, belegen aber das strukturelle Problem: GitHub, Cloudspeicher, Paste-Dienste, Formulare oder CDNs können nicht global blockiert werden, ohne massive Kollateralschäden zu verursachen.

Mandiant zeigte außerdem, wie Linkverkürzer, Analytics und CAPTCHAs zur Zielauswahl, Verschleierung und Messung bösartiger Kampagnen eingesetzt werden.[^14] Domain-Reputation allein ist daher weder vollständig noch ausreichend granular.

**Evidenzurteil:** Der Missbrauch legitimer Dienste ist durch Messung und Kampagnenanalysen gut belegt (A/B). Aussagen über eine konkrete Plattform müssen trotzdem aktuell und fallbezogen belegt werden.

## 3. Was nicht als gesichert behandelt werden sollte

Folgende Aussagen sollten weder im Sicherheitsdesign noch im Store-Text ohne zusätzliche Evidenz verwendet werden:

- **„KI erkennt unbekannte Pornografie oder Malware zuverlässig.“** NIST beschreibt Evasion, Poisoning und weitere adversariale Risiken und betont, dass es keine universelle Abwehr gibt.[^23]
- **„98 % Genauigkeit“ eines kleinen Browser-Extension-Prototyps bedeutet Produktionstauglichkeit.** Ein publizierter Phishing-Prototyp berichtet beispielsweise 98,5 Prozent auf einem ausgeglichenen Datensatz von nur 800 URLs.[^24] Das sagt wenig über Base Rates, neue Sprachen, echte Traffic-Verteilung, Angreiferanpassung und Kosten von False Positives aus.
- **„Ein perceptual hash löst die Bilderkennung.“** Begutachtete Forschung zeigt, dass solche Hashes gezielt manipuliert und sogar für False-Positive-Angriffe missbraucht werden können.[^25]
- **„Mehr Berechtigungen bedeuten automatisch mehr Schutz.“** Breite Rechte vergrößern Datenschutz- und Missbrauchsfolgen. Eine USENIX-Studie demonstrierte, wie Extensions mit Seitenzugriff Inhalte automatisiert extrahieren können.[^26] Das ist kein Vorwurf gegen WebSafe, aber eine Begründung für lokale Verarbeitung und minimale Rechte.
- **„Eine Blockliste ist ein Antivirus.“** Kurzlebige Domains, TDS, kompromittierte seriöse Websites und legitime Hostingdienste widerlegen diese Gleichsetzung.

Nicht begutachtete Preprints und einzelne technische Blogs können gute Testideen liefern. Sie sollten im Projekt als Hypothese oder adversarialer Testfall markiert werden, nicht als Beweis für Prävalenz oder garantierte Abwehrleistung.

## 4. Technische Möglichkeiten der Chrome-Extension-APIs

### 4.1 Übersicht

| Schutzmaßnahme | API/Mechanismus | Technisch möglich? | Wesentliche Grenze |
|---|---|---:|---|
| Bekannte Domains/Requestmuster vor dem Laden blockieren | `declarativeNetRequest` | **Ja** | Listenalterung, Limits, First-Party-Kompromittierung, lokal erzeugte Antworten |
| Seite und alle Frames ab `document_start` untersuchen | Content Scripts + Hostrechte | **Ja** | Keine privilegierten Browserseiten; Closed Shadow DOM, Canvas und rein visuelle Inhalte |
| Dynamisch eingefügte Overlays entfernen | `MutationObserver` im isolierten Content Script | **Ja** | Heuristik, Timing, Attribute/Styles, virtuelle DOMs, Race Conditions |
| `window.open` der Seite überschreiben | Content Script in `MAIN` world | **Teilweise** | Hostseite kann Code sehen/stören; andere Navigationswege bleiben |
| Hauptnavigation vor Netzwerkzugriff sicher stoppen | DNR-Regel | **Ja, bei bekanntem Muster** | `webNavigation` selbst ist nur beobachtend; unbekannte Ziele werden nicht prädiktiv erkannt |
| Download anhand Metadaten/Browserverdikt abbrechen | `chrome.downloads` | **Teilweise** | Ereignis nach Downloadbeginn; kein Archiv-, Signatur- oder Vollinhaltsscan |
| Lokal sichtbaren Tab als Bild klassifizieren | `captureVisibleTab` + gebündeltes Modell | **Teilweise** | Nur sichtbarer Bereich, maximal zwei Aufrufe/s, Leistung, Datenschutz, adversariale Beispiele[^27] |
| Unsichtbares DOM/Canvas für lokale Verarbeitung | `chrome.offscreen` | **Ja** | Zusätzliche Berechtigung; im Offscreen-Dokument nur `runtime` als Extension-API[^28] |
| Datei mit lokalem Antivirus untersuchen | Native Messaging + separates Hostprogramm | **Ja, als Zusatzprodukt** | Externe Installation, OS-spezifisch, zusätzliche Berechtigung; kein reines Store-Paket[^29] |
| Browser-Engine-Zero-Day verhindern | keine | **Nein** | Aufgabe von Browser-Sandbox, Updates und OS-/Endpoint-Schutz |
| Eingabe in PowerShell/Terminal verhindern | keine | **Nein** | Außerhalb des Browsers |

### 4.2 `declarativeNetRequest` (DNR)

DNR ist die stärkste WebSafe-Schicht für bekannte Ziele, weil Chrome die Regel vor beziehungsweise während der Requestverarbeitung anwendet. Sie eignet sich für bekannte Adult-Domains, besonders eindeutige URL-Muster und ausgewählte Malware-/Scam-Indikatoren. Die offizielle Dokumentation nennt jedoch feste Regel- und Regexgrenzen; außerdem greifen DNR-Regeln nicht auf Antworten, die ein Service Worker selbst in `onfetch` erzeugt oder aus `CacheStorage` liefert.[^30]

Konsequenzen:

- Regeln klein, erklärbar und quellenbasiert halten.
- Domainregeln höher gewichten als generische Wörter im gesamten URL-Pfad.
- Aktualisierungen als geprüfte Extension-Releases oder transparente Datenupdates gestalten; Manifest V3 verbietet nachgeladenen ausführbaren Code.[^31]
- Keine breit gefassten Regexregeln wie `sex`, `adult` oder `xxx` ohne Host-/Pfadkontext. Sie treffen etwa Gesundheitsangebote, Dokumentnamen, Börsenkürzel oder zufällige IDs.

### 4.3 Content Scripts und Ausführungswelten

WebSafe lädt einen Guard in der `MAIN` world und die DOM-Analyse in der isolierten Welt. Das ist grundsätzlich nachvollziehbar: Nur im Seitenkontext kann `window.open` direkt ersetzt werden. Chrome warnt aber ausdrücklich, dass die Hostseite Code in der `MAIN` world erreichen und beeinflussen kann.[^32]

Der aktuelle Guard setzt `window.__webSafePageGuard`, speichert `window.open` und empfängt Konfiguration über öffentlich beobachtbare DOM-Events. Eine bösartige Seite kann deshalb den Marker vorab setzen, `window.open` später erneut überschreiben, Events fälschen oder alternative Navigationswege verwenden. Das isolierte Content Script ist für vertrauenswürdige Entscheidungen geeigneter, kann native Page-JavaScript-Funktionen aber nicht vollständig kontrollieren.

Sinnvolle Härtung:

- MAIN-world-Code minimal und zustandsarm halten; alle privilegierten Entscheidungen im Service Worker oder isolierten Script treffen.
- Änderungen an `<a target="_blank">`, Formularen, `location`, synthetischen Klicks und neuen Frames separat beobachten, ohne zu behaupten, damit jede Navigation abzufangen.
- DOM-Events aus der MAIN world grundsätzlich als untrusted behandeln.
- Closed Shadow DOM, Canvas, WebGL und CSS-Hintergrundinhalte als explizite Restlücke dokumentieren.

### 4.4 `webNavigation` und `tabs`

`webNavigation.onBeforeNavigate` meldet eine beginnende Navigation, ist aber kein cancelbarer Request-Interceptor.[^33] Ein anschließendes `tabs.update()` auf die WebSafe-Sperrseite ist ein Redirect mit Race Condition: Seite und Scripts können bereits kurz aktiv gewesen sein. Für bekannte bösartige URLs sollte daher DNR die Primärkontrolle sein; `webNavigation` eignet sich für SafeSearch-Umschreibung, Protokollierung und eine zweite Reaktionsschicht.

Die Berechtigung `tabs` ist für das Erstellen oder Aktualisieren eines Tabs nicht generell nötig. Sie erlaubt vor allem Zugriff auf sensible Tab-Eigenschaften wie URL, Titel und Favicon. Da WebSafe bereits passende Hostberechtigungen besitzt, sollte ein Testbranch `tabs` entfernen und Popup, Optionsseite, `sender.tab`, `tabs.get/query/create/update` auf HTTP(S)-, internen und Extension-Seiten prüfen.[^34]

### 4.5 Downloads-API

Die API liefert Dateiname, URL, MIME-Typ und das vom Browser vergebene `danger`-Urteil. WebSafe kann Downloads abbrechen und eine Warnseite öffnen. Die API ersetzt aber keinen Dateiscanner:

- `onCreated` tritt beim Beginn eines Downloads auf.
- `onDeterminingFilename` darf die Dateinamensbestimmung verzögern oder einen Namen vorschlagen, ist keine Quarantäne- oder Scan-Schnittstelle.
- Archive können nicht allgemein entpackt, PE-Signaturen nicht verlässlich geprüft und Payloads nicht emuliert werden.
- Server können MIME-Typen und Dateinamen falsch angeben; Blob-URLs besitzen möglicherweise keinen aussagekräftigen Remote-Pfad.

Die derzeitige WebSafe-Regel blockiert alle gelisteten ausführbaren, Skript-, Image-, Paket- und Makrotypen sowie alle öffentlichen HTTP-Downloads. Das ist sicherheitsorientiert, trifft aber auch legitime Browserinstaller, Open-Source-Releases, Linux-ISOs, Android-Apps, Treiber und Geschäftsdokumente. Für ein allgemeines Publikum ist eine gestufte Warnung mit Herkunft, Endung, Browserverdikt und bewusster Bestätigung robuster als ein undifferenziertes Verbot. Ein bestätigtes Browserurteil wie `dangerous`, Doppelendung plus unklare Quelle oder ein automatischer Download ohne vertrauenswürdigen Klick darf weiterhin hart blockieren.

### 4.6 Hostberechtigungen, `activeTab` und optionale Hosts

Chrome weist darauf hin, dass `<all_urls>` die Prüfung verlängern kann. Breite Hostrechte ermöglichen das Lesen und Ändern aller passenden Webseiten und müssen für den einzigen Zweck der Extension erforderlich sein.[^35][^36]

Für WebSafe bestehen drei Modelle:

| Modell | Schutzwirkung | UX/Review | Bewertung |
|---|---|---|---|
| `<all_urls>` ab Installation | Automatischer Schutz auf besuchten HTTP(S)-Seiten | Deutliche Warnung und potenziell längere Review | **Passend zum aktuellen Kernversprechen**, wenn lokal/minimal umgesetzt |
| `activeTab` | Zugriff erst nach Klick auf die Extension oder vergleichbarer Nutzeraktion | Kleine Installationswarnung | **Nicht passend** für überraschende Pop-ups/Overlays |
| `optional_host_permissions` | Benutzer wählt Sites oder „alle Sites“ im Onboarding | Zusätzliche Reibung; Schutz bis zur Freigabe unvollständig | Gute Privacy-Option, wenn „Schutz nach Aktivierung“ akzeptiert wird |

Die Store-Warnung sollte daher nicht durch einen technisch irreführenden Wechsel auf `activeTab` „gelöst“ werden. Besser sind eine klare Single-Purpose-Erklärung, lokale Verarbeitung, keine Telemetrie, minimale normale Berechtigungen und gegebenenfalls ein bewusstes Onboarding für optionale Hostrechte.

### 4.7 Lokale Bildklassifikation

Ein gebündeltes JavaScript-/Wasm-Modell kann Bilder oder einen Screenshot lokal bewerten. Wegen Manifest V3 müssen Modell und Logik Bestandteil des Pakets sein; Remote-Code ist nicht zulässig.[^31] Praktisch entstehen folgende Risiken:

- hoher CPU-/RAM-Verbrauch und Verzögerung auf bildreichen Seiten;
- nur sichtbare oder CORS-zugängliche Pixel; Canvas kann tainted sein;
- False Positives bei Medizin, Stillen, Kunst, Aufklärung, Nachrichten und Hauterkennung;
- False Negatives durch Cropping, Overlays, Stilisierung, Text-zu-Bild, Animation, kleine Ausschnitte und adversariale Änderungen;
- erheblicher Review- und Wartungsaufwand für Modellherkunft, Lizenz, Bias und Evaluationskorpus.

NISTs Adversarial-ML-Taxonomie und Forschung zu angreifbaren perceptual hashes sprechen gegen harte Sperren allein auf Basis eines Bildmodells.[^23][^25] Empfehlenswert wäre höchstens eine optionale lokale Zusatzschicht, die zunächst weich ausblendet und eine gut sichtbare Freigabe anbietet.

## 5. Prüfung der aktuellen WebSafe-Implementierung

Grundlage sind [Manifest](../src/manifest.json), [Page Guard](../src/content/page-guard.js), [Content Scanner](../src/content/content.js), [Service Worker](../src/background/background.js) und [Filterlogik](../src/shared/filter.js).

### 5.1 Positiv

- Manifest V3, restriktive Extension-CSP und keine extern geladene Programmlogik.
- Isoliertes Content Script ab `document_start` in allen HTTP(S)-Frames.
- DNR für bekannte Ziele statt ausschließlich nachträglichem DOM-Redirect.
- Mehrsignallogik für Seitentext; nicht jeder einzelne Treffer sperrt sofort.
- Allowlist, lokale Einstellungen und keine erkennbare Übermittlung von Seiteninhalten.
- Downloadprüfung kombiniert Endung, Doppelendung, MIME, Transport und Browserurteil.
- Dokumentierte Grenzen zu Pixelklassifikation, Archiven, Zero-Days und Native Messaging.

### 5.2 Wesentliche False Positives und Umgehungen

| Aktuelle Regel | Typische False Positives | Typische Umgehung |
|---|---|---|
| Jeder externe `window.open` wird auch nach echtem Klick blockiert | OAuth-Login, Zahlungsanbieter, Druckansicht, Hilfe, Videokonferenz | `<a target=_blank>`, Formularziel, `location`, iframe, erneutes Überschreiben von `window.open` |
| Textscore über große Teile der Seite | Medizin, Sexualaufklärung, Jugendschutz, Missbrauchsprävention, Journalismus | Bilder ohne Text, Euphemismen, Unicode/Homoglyphen, andere Sprachen, Text in Canvas/Shadow DOM |
| Overlay ab 35 % Breite und 25 % Höhe; externe Frames reichen als Signal | Consent-Manager, Login-/Payment-Dialoge, Video- oder Supportwidgets | kleineres Banner, vorhandenes Element wird nur per Attribut/CSS sichtbar, closed shadow root, Portal/Canvas |
| MutationObserver nur `childList/subtree` | wenig direkte FPs | Attribut-, Klassen- und Stylewechsel an bestehendem Element werden nicht beobachtet |
| Statische Adult-Domain- und URL-Terme | legitime Pfade/Dokumente mit mehrdeutigen Begriffen | neue Domains, Redirectoren, kompromittierte seriöse Hosts, URL-Shortener, neutrale Slugs |
| Alle gelisteten aktiven Dateitypen blockiert | legitime Installer, Linux-Images, Makrodokumente, APKs | ZIP/RAR/7z mit Payload, Blob ohne brauchbaren Namen, passwortgeschütztes Archiv, Dateityp ohne gelistete Endung |
| Alle öffentlichen HTTP-Downloads blockiert | interne Mirrors, ältere legitime Projekte, Testumgebungen | HTTPS-Server liefert trotzdem Malware |
| `BLOCK_PAGE` übernimmt URL/Grund aus Content-Nachricht | manipulierte oder irreführende Sperrseite bei kompromittiertem Nachrichtenpfad | bösartige Seite greift MAIN-world-Guard an; Content-Script selbst bleibt isoliert, ist aber kein vertrauenswürdiger Policy-Entscheider |
| `webNavigation` + `tabs.update` | Navigation kann fälschlich umgebogen werden | Race: Code/Download startet vor Redirect; nicht-HTTP(S)- und service-worker-generierte Flüsse |

Die kontextabhängige Fehlerrate ist bei expliziten Texten besonders wichtig. Forschung zu „contextual moderation“ zeigt, dass reine Themenklassifikation legitime Inhalte übermäßig trifft; Kontext und kommunikative Absicht reduzieren solche Fehler.[^37] WebSafe sollte daher medizinische, wissenschaftliche, aufklärende und journalistische Kontexte als Testklasse behandeln, nicht vorschnell als pauschale Ausnahme.

### 5.3 Nachrichten- und Vertrauensgrenzen

Chrome empfiehlt ausdrücklich, Nachrichten aus Content Scripts als weniger vertrauenswürdig zu behandeln, Eingaben zu validieren und privilegierte Aktionen zu begrenzen.[^38] WebSafe begrenzt bereits Stringlängen und verwendet für die Tab-ID `sender.tab.id`; das ist gut. Verbesserungsbedarf:

1. Bei `BLOCK_PAGE` nicht `message.url` als Ziel übernehmen, sondern `sender.tab.url` beziehungsweise die beobachtete Navigation verwenden.
2. Einen strukturierten Signaltyp senden, zum Beispiel `explicit-url`, `text-score` oder `scareware-combination`, und den endgültigen Sperrgrund im Service Worker erzeugen.
3. URL- und Allowlist-Prüfung im Service Worker wiederholen.
4. Für Downloadversuche keine vom Seitenkontext formulierte Begründung anzeigen; Kategorie und Text aus eigener Logik ableiten.
5. Nachrichtenrate pro Tab begrenzen, damit eine Seite keine Tab-/Speicherflut auslöst.

## 6. Priorisierte Gegenmaßnahmen

### P0 – vor der nächsten Store-Version

1. **Berechtigungen minimieren und begründen.** `tabs` testweise entfernen; `<all_urls>` wegen des automatischen Kernschutzes beibehalten oder bewusst in optionale Hostrechte umgestalten. In Store-Erklärung und Datenschutztext festhalten, dass Analyse lokal erfolgt und keine Browserhistorie übertragen wird.
2. **Vertrauensgrenze härten.** Content-Nachrichten nur als Hinweis behandeln; URL, Allowlist, Kategorie und Sperrgrund im Service Worker erneut bestimmen.
3. **Popup-Policy korrigieren.** Nicht jedes externe Fenster nach echtem Benutzerklick hart blockieren. Automatisierte Fenster weiterhin blockieren; bei benutzerinitiierten externen Zielen nur eindeutige Adult-/Threat-Signale oder eine Warnstufe verwenden.
4. **Downloadentscheidungen staffeln.** Harte Sperre für Browserverdikt, Doppelendung und automatischen aktiven Download; Warnung mit bewusster Fortsetzung für legitime, aber aktive Dateitypen. Archive als erhöhtes Risiko markieren, nicht als geprüft darstellen.
5. **Claims präzisieren.** „Reduziert unerwartete explizite Inhalte und typische Downloadrisiken“ statt „verhindert Pornografie, Malware und Viren“. Browser- und Betriebssystemschutz ausdrücklich weiterempfehlen.
6. **Fail-safe UI.** Jede Sperre zeigt Kategorie, ausgelöstes Signal, Originalhost und eine begrenzte, verständliche Freigabemöglichkeit. Keine Angsttexte verwenden, die selbst wie Scareware wirken.

### P1 – robuste Heuristik

1. MutationObserver um relevante `attributes` (`class`, `style`, `src`, `href`, `open`, `hidden`, `aria-*`) ergänzen und Scans drosseln.
2. Unicode normalisieren (`NFKC`), Zero-Width-Zeichen behandeln und Deutsch/Englisch zunächst mit kuratierten Tests erweitern. Mehr Sprache erhöht auch die FP-Fläche.
3. Offene Shadow Roots rekursiv untersuchen; closed roots als bekannte Lücke dokumentieren.
4. Overlay-Risiko aus mehreren Merkmalen berechnen: Vollbild, hoher `z-index`, Fokusfalle, wiederholte Dialoge, Alarmton, Systemmarken-Imitation, Telefonnummer, Download-/Clipboard-Anweisung und externe Navigation. Kein einzelnes Merkmal außer einer hochsicheren Blocklistenübereinstimmung sollte genügen.
5. ClickFix-Warnung auf kombinierte Signale stützen: CAPTCHA/Fehlertext **plus** Tastensequenz oder Terminal-/PowerShell-Anweisung **plus** Copy-Aktion. Eine normale CAPTCHA-Seite darf nicht blockiert werden.
6. Blocklisten mit Herkunft, Datum und automatisierten Regressionstests pflegen. Entfernen veralteter oder überbreiter Regeln ist genauso wichtig wie Hinzufügen.

### P2 – optionale Zusatzschichten

1. Lokale Bildklassifikation als Opt-in und nur für Ausblendung/Warnung evaluieren; Modell, Lizenz, Version und Fehlermetriken offenlegen.
2. Optionales Native-Messaging-Begleitprogramm für echten lokalen Datei-/Archivscan entwerfen. Es ist ein separates, signiertes Installationsprodukt und darf nicht als Bestandteil der reinen Extension dargestellt werden.
3. Freiwillige, datensparsame Meldung verdächtiger Seiten nur mit ausdrücklicher Einwilligung. Standard bleibt vollständig lokal.

## 7. Empfohlener Test- und Messplan

Eine Sicherheitsheuristik ist nur mit getrennten Positiv- und Negativkorpora bewertbar.

### 7.1 Funktionale Angriffstests

- automatische und benutzerinitiierte `window.open`-Varianten;
- `<a target=_blank>`, Formulare, iframe-Navigation, Meta-Refresh und `location`;
- Overlay wird neu eingefügt versus vorhandenes Element erhält neue Klasse/Styles;
- same-origin/cross-origin iframe, `blob:`, `data:`, Service Worker und CacheStorage;
- ClickFix-Texte in Deutsch/Englisch, Unicode-Obfuskation, Bildtext und Copy-Button;
- HTML-Smuggling mit Blob, neutralem Dateinamen, Doppelendung und Archiv;
- Browserverdikt wird erst nach `onCreated` gesetzt;
- Passwortarchiv, legitimes signiertes Setup, Linux-ISO, APK, Makrodokument;
- Allowlist, pausierter Schutz, private Fenster und mehrere Frames.

### 7.2 False-Positive-Korpus

- Sexualmedizin, Schwangerschaft, Stillen, Kunstgeschichte und Aufklärung;
- Nachrichten über Missbrauch, Pornografiegesetzgebung oder Malwarekampagnen;
- echte Microsoft-/Apple-/Antivirus-Supportartikel;
- OAuth, Bezahldialoge, Consent-Manager, Helpdesk, Videokonferenz und Druckansicht;
- GitHub Releases, Linux-Distributionen, Herstellerinstaller und Unternehmensmakros;
- legitime CAPTCHA-, Copy-Code- und Terminal-Dokumentationsseiten.

### 7.3 Metriken und Freigabekriterien

- Precision und Recall getrennt nach Adult-Seite, Adult-Overlay, Scareware, ClickFix und Download;
- False-Positive-Rate auf dem Negativkorpus, nicht nur „Accuracy“ auf einem balancierten Set;
- Zeit bis zum Entfernen eines Overlays und ob Inhalt vorher sichtbar war;
- übertragene Bytes bis zum Downloadabbruch;
- p50/p95 CPU-Zeit pro Mutation und Speicherverbrauch auf langen, dynamischen Seiten;
- Erfolgsquote von Umgehungstests und Regression pro Chrome-/Brave-Version;
- Berechtigungsdiff und Store-Paketprüfung bei jedem Release.

Ein realistisches Ziel ist nicht „100 Prozent“. Die Freigabe sollte vielmehr definierte Höchstwerte für False Positives, Performance und sichtbare Expositionszeit verlangen und bekannte Restlücken dokumentieren.

## 8. Schlussfolgerung

WebSafe adressiert ein reales, gut belegtes Problemfeld. Seine stärksten erreichbaren Funktionen sind das frühe Blockieren bekannter Ziele mit DNR, das lokale Entfernen eindeutig riskanter DOM-Elemente, kontextreiche Warnungen und das Stoppen klar verdächtiger Downloads. Die größte Gefahr für die Produktqualität ist nicht nur ein verpasster Angriff, sondern ein zu grobes Sicherheitsversprechen: pauschale Sperren erzeugen Umgehungsdruck, beschädigen legitime Flüsse und vermitteln fälschlich Antivirus- oder Zero-Day-Schutz.

Die empfohlene Architektur ist deshalb mehrschichtig und ehrlich begrenzt: bekannte Indikatoren hart blockieren, mehrdeutige Verhaltenssignale kombinieren, risikoreiche aber legitime Aktionen warnend bestätigen lassen, Browser-/Endpoint-Schutz nicht ersetzen und jede privilegierte Entscheidung außerhalb des manipulierbaren Seitenkontexts validieren.

## Quellen

[^1]: Google Cloud/Mandiant, [Opening a Can of Whoop Ads: Detecting and Disrupting a Malvertising Campaign Distributing Backdoors](https://cloud.google.com/blog/topics/threat-intelligence/detecting-disrupting-malvertising-backdoors), 14. Dezember 2023.
[^2]: Microsoft Threat Intelligence, [Threat actors misuse Node.js to deliver malware and other malicious payloads](https://www.microsoft.com/en-us/security/blog/2025/04/15/threat-actors-misuse-node-js-to-deliver-malware-and-other-malicious-payloads/), 15. April 2025.
[^3]: Proofpoint Threat Research, [TA569: SocGholish & Beyond](https://www.proofpoint.com/us/blog/threat-insight/ta569-socgholish-and-beyond).
[^4]: Proofpoint Threat Research, [Security Brief: ClickFix Social Engineering Technique Floods Threat Landscape](https://www.proofpoint.com/us/blog/threat-insight/security-brief-clickfix-social-engineering-technique-floods-threat-landscape), 18. November 2024.
[^5]: Microsoft Threat Intelligence, [Think before you Click(Fix): Analyzing the ClickFix social engineering technique](https://www.microsoft.com/en-us/security/blog/2025/08/21/think-before-you-clickfix-analyzing-the-clickfix-social-engineering-technique/), 21. August 2025.
[^6]: Google Threat Intelligence Group/Mandiant, [A Cereal Offender: Analyzing CORNFLAKE.V3 Backdoor](https://cloud.google.com/blog/topics/threat-intelligence/analyzing-cornflake-v3-backdoor), 20. August 2025.
[^7]: Microsoft Security, [HTML smuggling surges: Highly evasive loader technique increasingly used in banking malware, targeted attacks](https://www.microsoft.com/en-us/security/blog/2021/11/11/html-smuggling-surges-highly-evasive-loader-technique-increasingly-used-in-banking-malware-targeted-attacks/), 11. November 2021.
[^8]: MITRE ATT&CK, [T1027.006 – HTML Smuggling](https://attack.mitre.org/techniques/T1027/006/), zuletzt geändert 12. Mai 2026.
[^9]: Check Point Research, [CVE-2024-38112: Internet Explorer zero-day spoofing attack](https://blog.checkpoint.com/research/cpr-warns-threat-actors-are-leveraging-internet-explorer-in-new-zero-day-spoofing-attack-cve-2024-38112/), Juli 2024.
[^10]: Kaspersky GReAT, [Operation ForumTroll](https://securelist.com/operation-forumtroll/115989/), März 2025.
[^11]: Google Chrome Releases, [Stable Channel Update for Desktop – CVE-2026-5281](https://chromereleases.googleblog.com/2026/03/stable-channel-update-for-desktop_31.html), 31. März 2026.
[^12]: Google Chrome Releases, [Stable Channel Update for Desktop – CVE-2026-11645](https://chromereleases.googleblog.com/2026/06/stable-channel-update-for-desktop_0153744567.html), 8. Juni 2026.
[^13]: Yao et al., [Hiding in Plain Sight: An Empirical Study of Web Application Abuse in Malware](https://www.usenix.org/conference/usenixsecurity23/presentation/yao-mingxuan), 32nd USENIX Security Symposium, 2023.
[^14]: Google Cloud/Mandiant, [A Measure of Motive: How Attackers Weaponize Digital Analytics Tools](https://cloud.google.com/blog/topics/threat-intelligence/how-attackers-weaponize-digital-analytics-tools), 29. August 2024.
[^15]: Chrome for Developers, [The `activeTab` permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab).
[^16]: MITRE ATT&CK, [T1189 – Drive-by Compromise](https://attack.mitre.org/techniques/T1189/), zuletzt geändert 24. Oktober 2025.
[^17]: Microsoft Threat Intelligence, [Counterfeit installers to system compromise: Tracking a deceptive software download campaign](https://www.microsoft.com/en-us/security/blog/2026/09/01/counterfeit-installers-system-compromise-tracking-deceptive-software-download-campaign/), 1. September 2026.
[^18]: Google Threat Intelligence Group, [To Be (A Robot) or Not to Be: COLDRIVER Using ClickFix to Deliver New Malware](https://cloud.google.com/blog/topics/threat-intelligence/new-malware-russia-coldriver).
[^19]: Microsoft, [Microsoft Digital Defense Report 2024](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Microsoft%20Digital%20Defense%20Report%202024%20%281%29.pdf), Abschnitt zu Tech-Scams.
[^20]: Microsoft Support, [Prevent online scams with the scareware blocker in Microsoft Edge](https://support.microsoft.com/en-US/edge/prevent-online-scams-with-the-scareware-blocker-in-microsoft-edge).
[^21]: Google Threat Intelligence Group, [Threats to the Defense Industrial Base](https://cloud.google.com/blog/topics/threat-intelligence/threats-to-defense-industrial-base), 2026.
[^22]: Chrome for Developers, [`chrome.downloads` API](https://developer.chrome.com/docs/extensions/reference/api/downloads).
[^23]: NIST, [Adversarial Machine Learning: A Taxonomy and Terminology of Attacks and Mitigations, NIST AI 100-2e2025](https://www.nist.gov/publications/adversarial-machine-learning-taxonomy-and-terminology-attacks-and-mitigations-0), März 2025.
[^24]: Aljofey et al., [PhishCatcher: Client-Side Defense Against Web Spoofing Attacks Using Machine Learning](https://ieeexplore.ieee.org/document/10155142/), IEEE Access, 2023.
[^25]: Prokos et al., [Squint Hard Enough: Attacking Perceptual Hashing with Adversarial Machine Learning](https://www.usenix.org/conference/usenixsecurity23/presentation/prokos), 32nd USENIX Security Symposium, 2023.
[^26]: Xie et al., [Arcanum: Detecting and Evaluating the Privacy Risks of Browser Extensions on Web Pages and Web Content](https://www.usenix.org/conference/usenixsecurity24/presentation/xie-qinge), 33rd USENIX Security Symposium, 2024.
[^27]: Chrome for Developers, [`chrome.tabs` API – captureVisibleTab](https://developer.chrome.com/docs/extensions/reference/api/tabs).
[^28]: Chrome for Developers, [`chrome.offscreen` API](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
[^29]: Chrome for Developers, [Native messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).
[^30]: Chrome for Developers, [`chrome.declarativeNetRequest` API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest).
[^31]: Chrome for Developers, [Improve extension security – Manifest V3 and remotely hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security).
[^32]: Chrome for Developers, [Manifest – Content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts), Abschnitt „world“.
[^33]: Chrome for Developers, [`chrome.webNavigation` API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation).
[^34]: Chrome for Developers, [`chrome.tabs` API](https://developer.chrome.com/docs/extensions/reference/api/tabs), Abschnitt zu Berechtigungen.
[^35]: Chrome for Developers, [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).
[^36]: Chrome for Developers, [Chrome Web Store review process](https://developer.chrome.com/docs/webstore/review-process).
[^37]: Paudel et al., [Enabling Contextual Soft Moderation on Social Media through Contrastive Text Representation Learning](https://www.usenix.org/system/files/usenixsecurity24-paudel-enabling.pdf), 33rd USENIX Security Symposium, 2024.
[^38]: Chrome for Developers, [Message passing – security considerations](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).
[^39]: Cybersecurity and Infrastructure Security Agency, [Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog), Einträge CVE-2025-2783 und CVE-2025-5419.
