// Installation übernimmt der Browser; Updates nie mitten im Training anwenden.
(() => {
  if (!("serviceWorker" in navigator)) return;
  const hinweis = document.getElementById("pwa-update");
  const schalter = document.getElementById("pwa-update-button");
  const status = document.getElementById("pwa-status");
  let registrierung;
  let neuLaden = false;
  let uebernahmeAngefordert = false;
  let pruefung;

  function beschaeftigt() {
    return (typeof trainingAktiv === "function" && trainingAktiv()) ||
      (typeof starting !== "undefined" && starting) ||
      (typeof savingPreference !== "undefined" && savingPreference) ||
      (typeof unsavedResults !== "undefined" && unsavedResults > 0);
  }

  function pruefeUpdate() {
    if (neuLaden && !beschaeftigt()) {
      window.location.reload();
      return;
    }
    hinweis.hidden = !registrierung?.waiting || beschaeftigt() || uebernahmeAngefordert;
    if (!registrierung?.waiting && !neuLaden) {
      clearInterval(pruefung);
      pruefung = undefined;
    }
  }

  function merkeUpdate() {
    pruefeUpdate();
    if (registrierung?.waiting && !pruefung) {
      pruefung = setInterval(pruefeUpdate, 1000);
    }
  }

  schalter.addEventListener("click", () => {
    if (beschaeftigt() || !registrierung?.waiting) return;
    uebernahmeAngefordert = true;
    schalter.disabled = true;
    hinweis.hidden = true;
    registrierung.waiting.postMessage({ typ: "AKTIVIEREN" });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!uebernahmeAngefordert) return;
    neuLaden = true;
    if (!pruefung) pruefung = setInterval(pruefeUpdate, 1000);
    pruefeUpdate();
  });

  async function registrieren() {
    try {
      registrierung = await navigator.serviceWorker.register("./sw.js", {
        scope: "./", updateViaCache: "none",
      });
      merkeUpdate();
      registrierung.addEventListener("updatefound", () => {
        const worker = registrierung.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") merkeUpdate();
        });
      });
    } catch (error) {
      status.hidden = false;
      status.textContent = "Offline-Speicherung konnte nicht eingerichtet werden. Bitte lade die Seite bei bestehender Verbindung neu.";
      console.error(error);
    }
  }

  if (document.readyState === "complete") void registrieren();
  else window.addEventListener("load", registrieren, { once: true });
})();
