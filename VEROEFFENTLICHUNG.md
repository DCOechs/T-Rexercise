# PWA auf GitHub Pages veröffentlichen

## Veröffentlichung

1. Alle App-Dateien einschließlich assets/, data/, manifest.webmanifest, sw.js,
   pwa.js und .nojekyll in Git aufnehmen und nach main pushen.
   .idea/ und lokale Testdateien bleiben ausgeschlossen.
2. Im Repository https://github.com/DCOechs/T-Rexercise unter
   Settings → Pages als Source „Deploy from a branch“ wählen.
3. Branch main und Ordner / (root) wählen, speichern.
4. Die erfolgreiche Bereitstellung unter Actions abwarten.
5. https://dcoechs.github.io/T-Rexercise/ öffnen.
   Unter Settings → Pages prüfen, dass HTTPS erzwungen wird.

Die App benötigt keinen Build, keine Pakete und keinen eigenen Server.
.nojekyll sorgt für unveränderte Auslieferung der statischen Dateien.
Die Konfiguration in GitHub selbst wurde durch diese Dateien nicht verändert.

Falls main noch keinen Commit hat, kann die Branch-Auswahl erst nach dem ersten
Push eingerichtet werden. Das Repository muss für GitHub Free öffentlich sein.
Bei privaten Repositories hängt Pages vom GitHub-Tarif ab.

## Installation am Handy

- Android/Chrome: Website öffnen, Browsermenü → App installieren bzw.
  Zum Startbildschirm hinzufügen.
- iPhone/Safari: Website öffnen, Teilen → Zum Home-Bildschirm.
- Nach Installation einmal mit Internet öffnen und den Offline-Cache fertig
  laden lassen. Danach funktioniert die App einschließlich Katalog und Bildern
  offline. Sprachausgabe hängt von den auf dem Gerät vorhandenen Stimmen ab;
  von einem entfernten Sprachdienst bereitgestellte Stimmen können offline fehlen.

## Vor der Freigabe prüfen

- Startseite, Statistiken und beide Dialoge auf der veröffentlichten Adresse.
- Manifest: richtige Namen, relative Start-URL, scope und Icons.
- Service Worker: aktiviert und der Seite zugeordnet; keine Installationsfehler.
- Browser offline schalten, Seite neu laden, Training starten.
- Testtraining abschließen, Seite neu laden, gespeicherte Werte prüfen.
- Normale Browseransicht und installierte App testen; Wake Lock und Ton am Handy.
- Appwechsel beendet ein laufendes Training und gibt die Bildschirmsperre frei.

## Updates

Bei Änderungen an HTML, CSS, JavaScript, Übungskatalog oder Bildern die Konstante
VERSION in sw.js erhöhen (z. B. von "1" auf "2"), dann alles zusammen pushen.
Der neue Service Worker lädt einen vollständigen Satz Dateien vor.
Die aktive Version bleibt bestehen, wenn eine dieser Dateien fehlt.
Ein vorhandenes Update erscheint als „Aktualisieren“, sobald kein Training oder
Speichervorgang läuft. Erst nach Bestätigung wird die neue Version aktiviert und
die Seite neu geladen. Alternativ alle App-Tabs und die installierte App schließen
und erneut öffnen. Updates löschen keine IndexedDB-Daten.

Neue Bilder, die im Katalog unter bild stehen, werden automatisch offline gespeichert.
Dateien außerhalb dieses Katalogs bei Bedarf in DATEIEN in sw.js ergänzen.
Cache-Namen enthalten den App-Pfad. Die Bereinigung betrifft ausschließlich alte
Caches dieser App, nicht die Datenbank oder andere Projekte auf derselben Domain.

## Lokale Daten

Die produktive GitHub-Pages-Adresse hat eine eigene IndexedDB-Datenbank.
Deine auf localhost erfassten Trainings und Präferenzen werden nicht übertragen.
Datenexport und -import sind noch nicht implementiert.

## Offizielle Referenzen

- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- PWA-Installation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Service Worker: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
