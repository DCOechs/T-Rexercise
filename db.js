// Einmalige Übernahme der früheren englischen Datensätze (Version 1).
const datenMigration = (() => {
  const uebungsIds = {
  "bodyweight-squat": "kniebeuge",
  "dumbbell-row": "kurzhantel-rudern",
  "cat-cow": "katze-kuh",
  "seated-knee-extension": "kniestrecken-im-sitzen",
  "glute-bridge": "beckenheben"
};
  const begriffe = {
  "dumbbells": "Kurzhanteln",
  "chair": "Stuhl",
  "yogaMat": "Yogamatte",
  "strength": "Kraft",
  "mobility": "Beweglichkeit",
  "legs": "Beine",
  "back": "Rücken",
  "glutes": "Gesäß"
};
  const id = (wert) => uebungsIds[wert] ?? wert;

  function umbenennen(objekt = {}, schluessel) {
    return Object.fromEntries(Object.entries(objekt).map(([name, wert]) => [schluessel[name] ?? name, wert]));
  }
  function messwerte(werte = {}) {
    return umbenennen(werte, { reps: "wiederholungen", weightKg: "gewichtKg", seconds: "sekunden" });
  }
  function optionen(werte = {}) {
    const neu = umbenennen(werte, { equipment: "geraete", focuses: "schwerpunkte", count: "anzahl" });
    neu.geraete = (neu.geraete ?? []).map((wert) => begriffe[wert] ?? wert);
    neu.schwerpunkte = (neu.schwerpunkte ?? []).map((wert) => begriffe[wert] ?? wert);
    delete neu.positions;
    delete neu.space;
    return neu;
  }
  function einstellungen(werte = {}) {
    return Object.fromEntries(Object.entries(werte).map(([kennung, auswahl]) => {
      const neu = umbenennen(auswahl, { multiplier: "multiplikator", forced: "forciert", defaults: "standardwerte" });
      if (neu.standardwerte) neu.standardwerte = messwerte(neu.standardwerte);
      return [id(kennung), neu];
    }));
  }
  function training(alt) {
    const neu = umbenennen(alt, { startedAt: "gestartetAm", exerciseIds: "uebungsIds", options: "optionen" });
    neu.uebungsIds = (neu.uebungsIds ?? []).map(id);
    if (neu.optionen) neu.optionen = optionen(neu.optionen);
    return neu;
  }
  function ergebnis(alt) {
    const neu = umbenennen(alt, {
      sessionId: "trainingsId", exerciseId: "uebungsId",
      completedAt: "abgeschlossenAm", metrics: "messwerte",
    });
    neu.uebungsId = id(neu.uebungsId);
    if (neu.messwerte) neu.messwerte = messwerte(neu.messwerte);
    return neu;
  }
  function einstellung(alt) {
    const schluessel = { exercisePreferences: "uebungsEinstellungen", trainingOptions: "trainingsOptionen" }[alt.key] ?? alt.key;
    const wert = schluessel === "uebungsEinstellungen" ? einstellungen(alt.value)
      : schluessel === "trainingsOptionen" ? optionen(alt.value) : alt.value;
    return { schluessel, wert };
  }
  return { training, ergebnis, einstellung };
})();

// Version 2 kopiert vorhandene Daten; Version-1-Speicher bleiben unverändert erhalten.
const trainingDb = (() => {
  let database;

  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("t-rexercise", 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        db.createObjectStore("trainings", { keyPath: "id" });
        const ergebnisse = db.createObjectStore("ergebnisse", { keyPath: "id" });
        ergebnisse.createIndex("uebungsId", "uebungsId");
        ergebnisse.createIndex("trainingsId", "trainingsId");
        db.createObjectStore("einstellungen", { keyPath: "schluessel" });
        if (event.oldVersion === 1) {
          const tx = request.transaction;
          const uebernahmen = [
            ["sessions", "trainings", datenMigration.training],
            ["results", "ergebnisse", datenMigration.ergebnis],
            ["settings", "einstellungen", datenMigration.einstellung],
          ];
          uebernahmen.forEach(([alterName, neuerName, umwandeln]) => {
            const lesen = tx.objectStore(alterName).openCursor();
            lesen.onsuccess = () => {
              const cursor = lesen.result;
              if (cursor) {
                try {
                  tx.objectStore(neuerName).put(umwandeln(cursor.value));
                  cursor.continue();
                } catch (error) {
                  console.error("Datenübernahme fehlgeschlagen:", error);
                  tx.abort();
                }
              }
              // Alte Speicherbereiche bleiben als unveränderte Sicherung erhalten.
            };
          });
        }
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Schließe andere T/Rex/ercise-Tabs und lade die Seite neu."));
      request.onsuccess = () => {
        database = request.result;
        database.onversionchange = () => database.close();
        resolve();
      };
    });
  }

  // Schreibvorgänge gelten erst nach Abschluss der Transaktion als gespeichert.
  function transact(stores, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(stores, mode);
      let request;
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error || new Error("Datenbanktransaktion abgebrochen."));
      transaction.onerror = () => {};
      try {
        request = operation(transaction);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  }

  return {
    open,
    async loadUserData() {
      const [verlauf, einstellungen] = await Promise.all([
        transact(["ergebnisse"], "readonly", (tx) => tx.objectStore("ergebnisse").getAll()),
        transact(["einstellungen"], "readonly", (tx) => tx.objectStore("einstellungen").getAll()),
      ]);
      const werte = Object.fromEntries(einstellungen.map(({ schluessel, wert }) => [schluessel, wert]));
      return {
        verlauf,
        uebungsEinstellungen: werte.uebungsEinstellungen || {},
        trainingsOptionen: werte.trainingsOptionen || null,
      };
    },
    beginSession(record, optionen) {
      return transact(["trainings", "einstellungen"], "readwrite", (tx) => {
        tx.objectStore("trainings").add(record);
        return tx.objectStore("einstellungen").put({ schluessel: "trainingsOptionen", wert: optionen });
      });
    },
    saveResult(result) {
      return transact(["ergebnisse"], "readwrite", (tx) => tx.objectStore("ergebnisse").put(result));
    },
    saveExercisePreferences(preferences) {
      return transact(["einstellungen"], "readwrite", (tx) =>
        tx.objectStore("einstellungen").put({ schluessel: "uebungsEinstellungen", wert: preferences }));
    },
  };
})();
