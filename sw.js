// Bei Änderungen an App-Dateien, Katalog oder Bildern VERSION erhöhen.
const VERSION = "6";
const BASIS = new URL(self.registration.scope);
const PRAEFIX = "trexercise-pwa:" + encodeURIComponent(BASIS.pathname) + ":";
const CACHE = PRAEFIX + VERSION;
const adresse = (pfad) => new URL(pfad, BASIS).href;
const STARTSEITE = adresse("./index.html");
const KATALOG = adresse("./data/exercises.json");
const DATEIEN = [
  "./", "./index.html", "./styles.css", "./app.js", "./audio.js",
  "./db.js", "./exercises.js", "./pwa.js", "./manifest.webmanifest",
  "./assets/logo-v1.png", "./assets/app-icon-192.png",
  "./assets/app-icon-512.png", "./assets/app-icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
];

async function laden(url) {
  const antwort = await fetch(new Request(url, { cache: "reload" }));
  if (!antwort.ok) throw new Error("Offline-Datei fehlt: " + url);
  return antwort;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const katalogAntwort = await laden(KATALOG);
    const uebungen = await katalogAntwort.clone().json();
    if (!Array.isArray(uebungen)) throw new Error("Ungültiger Übungskatalog.");
    const bilder = uebungen.filter((uebung) => uebung.bild).map((uebung) => {
      const url = new URL(uebung.bild, BASIS);
      if (url.origin !== BASIS.origin || !url.pathname.startsWith(BASIS.pathname)) {
        throw new Error("Übungsbild liegt außerhalb der App.");
      }
      return url.href;
    });
    const urls = [...new Set([...DATEIEN.map(adresse), ...bilder])];
    // Erst alles laden. Bei fehlenden Dateien bleibt die bisherige Version aktiv.
    const dateien = await Promise.all(urls.map(async (url) => [url, await laden(url)]));
    const cache = await caches.open(CACHE);
    await Promise.all([
      cache.put(KATALOG, katalogAntwort),
      ...dateien.map(([url, antwort]) => cache.put(url, antwort)),
    ]);
    // Updates warten, bis alle Tabs geschlossen sind oder der Nutzer zustimmt.
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const namen = await caches.keys();
    await Promise.all(namen.filter((name) => name.startsWith(PRAEFIX) && name !== CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.typ === "AKTIVIEREN") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", (event) => {
  const anfrage = event.request;
  const url = new URL(anfrage.url);
  if (anfrage.method !== "GET" || url.origin !== BASIS.origin ||
      !url.pathname.startsWith(BASIS.pathname)) return;
  const start = anfrage.mode === "navigate" &&
    (url.pathname === BASIS.pathname || url.pathname === new URL(STARTSEITE).pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const gespeichert = await cache.match(start ? STARTSEITE : anfrage);
    return gespeichert || fetch(anfrage);
  })());
});
