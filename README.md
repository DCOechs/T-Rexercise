# T/Rex/ercise

Eine Trainings-App mit HTML, CSS und JavaScript – ohne Bibliotheken oder Build-Schritt.

## Vorschau und Veröffentlichung

Das Projekt über einen lokalen HTTP-Server öffnen. Direktes Öffnen von index.html
über file:// funktioniert wegen des nachgeladenen JSON-Katalogs nicht.
Für GitHub Pages main aus dem Projektverzeichnis veröffentlichen.
Die relativen Dateipfade unterstützen den Projektpfad /T-Rexercise/.
Manifest, App-Icons und Service Worker ermöglichen Installation und Offlinebetrieb.
Die Anleitung inklusive Installation, Prüfung und Updates steht in
[VEROEFFENTLICHUNG.md](./VEROEFFENTLICHUNG.md).
Bei App- oder Katalogänderungen VERSION in sw.js erhöhen.
Eine Aktualisierung wird während eines Trainings oder Speichervorgangs nicht angeboten.

## Übungskatalog

data/exercises.json enthält deutsche Schlüssel, Übungs-IDs und Werte:

- id: eindeutige, dauerhafte Kennung, z. B. kniebeuge.
- name: angezeigter Übungsname.
- schwerpunkte: Ziele (Kraft, Cardio, Mobiliät, Geschick) und Körperbereiche
  (Arme, Rücken, Bauch, Beine), jeweils in dieser Reihenfolge.
  Schultern gehören zu Arme, Nacken zu Rücken und Waden zu Beine.
  Die Auswahl wird in beiden Dialogen als Ziele und Körperbereiche gruppiert.
  Alte gespeicherte Begriffe werden beim Lesen übernommen und beim nächsten
  Trainingsstart unter den neuen Begriffen gespeichert.
- anforderungen.geraete: benötigte Geräte, z. B. Kurzhanteln, Stuhl oder Yogamatte.
- auswahlgewicht: Basisgewicht für die Zufallsauswahl.
- erfassungsfelder: wiederholungen und/oder gewichtKg; leer bedeutet nur Zeit.
- bild: relativer Pfad zum SVG-Piktogramm; null oder fehlend, solange noch kein Bild existiert.

Der Katalog enthält aktuell 45 Übungen im Stehen oder auf der Yogamatte,
darunter Wadenheben, Ausfallschritte, Wandsitzen, Liegestütze, Gleichgewichtsübungen,
Stütz-, Bauch- und Rückenübungen sowie Beweglichkeitsübungen.
Die jüngste Erweiterung ergänzt zehn Übungen im Stehen und zehn auf der Matte.
Wandsitzen setzt eine Wand voraus. Neue Übungen haben zunächst bild: null;
die Oberfläche blendet ihre Bilder aus, ohne eine Bilddatei anzufordern.

Geräte und Schwerpunkte werden direkt angezeigt. Eine zusätzliche Übersetzungstabelle
ist nicht mehr nötig. Schreibweisen einheitlich halten, damit Filter und Auswahl passen.
Technische Dateinamen und Browser-APIs sind unabhängig von der Datenbezeichnung.

## Trainingsauswahl

Standard: 12 verschiedene Übungen, je 30 Sekunden, 10 Sekunden Pause dazwischen.
Vor der ersten Übung gibt es 5 Sekunden Vorbereitung; nach der letzten keine Pause.
Während Vorbereitung, Übung und Pause sind die Navigationsreiter ausgeblendet.
Die Screen Wake Lock API hält den Bildschirm nach Möglichkeit wach (HTTPS oder
localhost, unterstützter Browser, keine Ablehnung durch das System).
Ist das nicht möglich oder wird die Sperre aufgehoben, erscheint ein Hinweis.
Nach Abschluss oder Abbruch wird die Sperre freigegeben und die Navigation sichtbar.
Beim Verlassen der sichtbaren Seite (App-/Tabwechsel, Sperren oder Seitennavigation)
endet das Training. Es wird beim Zurückkehren nicht weitergeführt.
Abgeschlossene Übungen bleiben gespeichert; das angebrochene Intervall zählt nicht.

Alle Geräteanforderungen müssen erfüllt sein. Forcierte Übungen werden zuerst
gleichverteilt ohne Wiederholung ausgewählt. Sind es mehr als Plätze, wird eine
zufällige Teilmenge genommen. Übrige Plätze werden gewichtet gefüllt:

auswahlgewicht × multiplikator × Schwerpunktfaktor × Häufigkeitsfaktor

Bei mindestens einem passenden Schwerpunkt beträgt der Faktor 2, sonst 1.

Der Häufigkeitsausgleich vergleicht ausschließlich aktuell verfügbare Übungen
derselben Präferenzgruppe (¼, ½, 1, 2 oder 4). Er zählt abgeschlossene Übungen,
keine Ziehungen oder abgebrochenen Intervalle. Das seltenste Quartil bekommt
Faktor 1,5, das häufigste 0,66; dazwischen gilt 1.
Gleichstände erhalten den mittleren Rang ihrer gemeinsamen Platzierungen.
Der relative Rang ist (erster Index + Ende exklusiv) / (2 × Gruppengröße).
Nur Werte unter 0,25 oder über 0,75 werden verändert. Auf den Grenzen bleibt
der Faktor 1; bei kleinen Gruppen oder Gleichständen können Quartile leer sein.
Sind alle gleich häufig, sind alle Faktoren neutral. Die Faktoren werden einmal
vor der Auswahl bestimmt und während der Ziehungen nicht neu berechnet.
Forcierte und ausgeschaltete Übungen nehmen nicht am Quartilsvergleich teil.

Eine Änderung der Auswahlpräferenz startet für diese Übung eine neue Zählphase.
Reines Speichern oder Ändern der Standardwerte setzt den Zähler nicht zurück.
Die Gesamthistorie bleibt erhalten; nur der Vergleichszähler beginnt neu.
Ein laufendes Training merkt sich seine Zählphasen beim Start, damit spätere
Präferenzänderungen alte Trainings nicht der neuen Gruppe zurechnen.
Ältere Ergebnisse ohne Zählphase gehören zur ursprünglichen Phase.
Ausgeschaltete Übungen bleiben ausgeschlossen. Forciert übersteuert ein Basisgewicht
von 0, aber keine fehlenden Geräte. Nach der Auswahl wird die Reihenfolge gemischt.
Bei zu wenigen passenden Übungen wird die Sitzung entsprechend kürzer.

## Statistik und Einstellungen

Übungen sind nach der Zahl der Abschlüsse sortiert. Antippen öffnet den Editor mit
Aus, Vierteln, Halbieren, Normal, Verdoppeln, Vervierfachen und Forciert.
Der Statistikfilter verlangt alle angeklickten Geräte und Schwerpunkte gleichzeitig.
Ohne Auswahl zeigt er alle Übungen, einschließlich ausgeschalteter Übungen.
Er verändert die Trainingseinstellungen nicht.

Passende Übungen bieten optionale Standardwerte für Wiederholungen und Gewicht.
Diese werden beim Trainingsstart übernommen und lassen sich für die aktuelle Sitzung
ändern. Leer bedeutet nicht erfasst. Wiederholungen sind nichtnegative ganze Zahlen;
Gewicht in kg darf Nachkommastellen enthalten. Kniestrecken benötigt nur einen Stuhl.
Katze-Kuh erfasst nur Sekunden.

Abgeschlossene Übungen speichern messwerte.sekunden sowie gültige optionale
wiederholungen und gewichtKg. Vorbereitungszeit, Pausen und abgebrochene Intervalle
werden nicht als Übung gespeichert. Die Statistik zeigt die letzten Messwerte.
Diese Eingaben werden vom Nutzer angegeben; sie werden nicht automatisch gemessen.

## Lokale Speicherung

IndexedDB-Datenbank t-rexercise, Version 2:

- trainings: id, gestartetAm, uebungsIds, optionen.
- ergebnisse: id, trainingsId, uebungsId, abgeschlossenAm, messwerte.
- einstellungen: schluessel und wert; Einträge uebungsEinstellungen und trainingsOptionen.

Pro Übung werden multiplikator, forciert und standardwerte gespeichert.
Vorhandene englische Daten aus Version 1 werden beim Öffnen innerhalb einer
Transaktion in das deutsche Schema übernommen. Alte Übungs-IDs, Geräte, Schwerpunkte,
Messwerte und Standardwerte werden zugeordnet; historische Werte bleiben erhalten.
Die alten Speicherbereiche sessions, results und settings bleiben unverändert als
Sicherung bestehen. Die App liest und schreibt anschließend nur die deutschen Bereiche.
Neueinstellungen und Verlauf werden erst nach erfolgreicher Transaktion als
gespeichert behandelt. Laufende Trainings werden beim Neuladen nicht fortgesetzt.

Die Daten gelten für Browserprofil und Adresse (Protokoll, Host, Port).
Lokal möglichst denselben Port verwenden. GitHub Pages hat eine eigene Datenbank.
Löschen der Website-Daten entfernt die Historie. Export und Import fehlen noch.

## Ton und Dateien

audio.js nutzt Browser-Sprachausgabe für Übungsnamen und erzeugt Pieptöne für
Start, Ende und die letzten drei Sekunden. Keine gesprochenen Countdown-Zahlen.
Ton ist standardmäßig aktiv. Stimmen hängen von Gerät und Browser ab.
Beim App-/Tabwechsel oder Sperren des Bildschirms endet das Training und die
Tonausgabe wird gestoppt. Verpasste Ansagen werden nicht nachträglich abgespielt.

- app.js: Oberfläche, Filter, Auswahl und Trainingsablauf.
- exercises.js: Laden und Validieren des Katalogs.
- db.js: Datenbank und Übernahme älterer Daten.
- assets/icons/exercises/: SVG-Piktogramme.
- assets/logo-v1.png: Logo im Header.
