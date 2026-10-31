const sessionDefaults = Object.freeze({
  exerciseCount: 12,
  exerciseSeconds: 30,
  restSeconds: 10,
  prepareSeconds: 5,
});

let exercises = [];
let userData = { uebungsEinstellungen: {}, verlauf: [], trainingsOptionen: null };
let unsavedResults = 0;

const byId = (id) => document.getElementById(id);
const navigationButtons = document.querySelectorAll("[data-view]");
navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (trainingAktiv()) beendeTraining();
    ["training", "stats"].forEach((view) => {
      byId(view).hidden = view !== button.dataset.view;
    });
    navigationButtons.forEach((item) => {
      if (item === button) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  });
});

function populateOptionTiles(container, group, values, selected) {
  const grid = document.createElement("div");
  grid.className = "option-grid";
  values.forEach((value) => {
    const label = document.createElement("label");
    label.className = "option-tile";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = group;
    input.value = value;
    input.checked = selected.includes(value);
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    grid.append(label);
  });
  container.append(grid);
}

function populateSchwerpunkte(container, selected) {
  schwerpunktGruppen.forEach(({ name, werte }) => {
    const gruppe = document.createElement("fieldset");
    gruppe.className = "schwerpunkt-gruppe";
    const titel = document.createElement("legend");
    titel.textContent = name;
    gruppe.append(titel);
    populateOptionTiles(gruppe, "schwerpunkte", werte, selected);
    container.append(gruppe);
  });
}

function populateOptions() {
  const geraete = [...new Set(exercises.flatMap((e) => e.anforderungen.geraete))];
  statsFilter = { geraete: [], schwerpunkte: [] };
  populateOptionTiles(byId("geraete"), "geraete", geraete, userData.trainingsOptionen?.geraete ?? []);
  populateOptionTiles(byId("stats-geraete"), "geraete", geraete, []);
  populateSchwerpunkte(byId("schwerpunkte"), userData.trainingsOptionen?.schwerpunkte ?? []);
  populateSchwerpunkte(byId("stats-schwerpunkte"), []);
  const savedCount = userData.trainingsOptionen?.anzahl ?? sessionDefaults.exerciseCount;
  const selectedCount = Number.isInteger(savedCount) && savedCount >= 1 && savedCount <= 100
    ? savedCount : sessionDefaults.exerciseCount;
  for (let anzahl = 1; anzahl <= 100; anzahl++) {
    const label = document.createElement("label");
    label.className = "anzahl-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "anzahl";
    input.value = anzahl;
    input.checked = anzahl === selectedCount;
    const number = document.createElement("span");
    number.textContent = anzahl;
    label.append(input, number);
    byId("anzahl-picker").append(label);
  }
}

function centerSelectedCount() {
  const picker = byId("anzahl-picker");
  if (!picker.clientWidth) return;
  const selected = picker.querySelector("input:checked").parentElement;
  picker.scrollTo({
    left: selected.offsetLeft - picker.clientWidth / 2 + selected.offsetWidth / 2,
    behavior: "instant",
  });
}

// Native Auswahl per Tastatur; beim Wischen wird die mittlere Zahl gewählt.
let countScrollTimeout;
byId("anzahl-picker").addEventListener("change", centerSelectedCount);
byId("anzahl-picker").addEventListener("scroll", () => {
  clearTimeout(countScrollTimeout);
  countScrollTimeout = setTimeout(() => {
    if (!byId("setup").open) return;
    const picker = byId("anzahl-picker");
    if (!picker.clientWidth) return;
    const center = picker.getBoundingClientRect().left + picker.clientWidth / 2;
    const closest = [...picker.children].reduce((best, option) => {
      const distance = (element) => {
        const rect = element.getBoundingClientRect();
        return Math.abs(rect.left + rect.width / 2 - center);
      };
      return distance(option) < distance(best) ? option : best;
    });
    const input = closest.querySelector("input");
    if (!input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, 120);
});

function getOptions() {
  const data = new FormData(byId("setup-form"));
  return {
    geraete: data.getAll("geraete"),
    schwerpunkte: data.getAll("schwerpunkte"),
    anzahl: Number(data.get("anzahl")),
  };
}

const trackingDefinitions = {
  wiederholungen: { label: "Wiederholungen", step: "1", inputMode: "numeric" },
  gewichtKg: { label: "Gewicht (kg)", step: "any", inputMode: "decimal" },
};

function trackingDefaults(exercise) {
  const saved = userData.uebungsEinstellungen[exercise.id]?.standardwerte ?? {};
  return Object.fromEntries(exercise.erfassungsfelder.filter((field) => {
    const value = saved[field];
    return Number.isFinite(value) && value >= 0 && (field !== "wiederholungen" || Number.isInteger(value));
  }).map((field) => [field, saved[field]]));
}

function readTrackingInputs(container) {
  const messwerte = {};
  container.querySelectorAll("input").forEach((input) => {
    if (input.value !== "" && input.validity.valid && Number.isFinite(input.valueAsNumber)) {
      messwerte[input.dataset.metric] = input.valueAsNumber;
    }
  });
  return messwerte;
}

function renderTrackingInputs(container, exercise, values, prefix, onInput) {
  container.replaceChildren();
  exercise.erfassungsfelder.forEach((field) => {
    const definition = trackingDefinitions[field];
    const label = document.createElement("label");
    label.htmlFor = prefix + "-" + field;
    label.textContent = definition.label;
    const input = document.createElement("input");
    input.id = label.htmlFor;
    input.type = "number";
    input.min = "0";
    input.step = definition.step;
    input.inputMode = definition.inputMode;
    input.placeholder = "Optional";
    input.dataset.metric = field;
    input.value = values[field] ?? "";
    if (onInput) input.addEventListener("input", () => onInput(readTrackingInputs(container)));
    label.append(input);
    container.append(label);
  });
}

function renderSessionTracking() {
  const group = byId("session-tracking");
  if (session.phase === "done") {
    group.hidden = true;
    return;
  }
  const index = session.index + (session.phase === "rest" ? 1 : 0);
  const exercise = session.exercises[index];
  group.hidden = exercise.erfassungsfelder.length === 0;
  const container = byId("session-metric-inputs");
  const key = session.id + ":" + index;
  if (container.dataset.key !== key) {
    container.dataset.key = key;
    renderTrackingInputs(container, exercise, session.messwerte[index], "session", (messwerte) => {
      session.messwerte[index] = messwerte;
    });
  }
}

function formatMetrics(messwerte) {
  return [
    Number.isFinite(messwerte.sekunden) ? messwerte.sekunden + " s" : "",
    Number.isFinite(messwerte.wiederholungen) ? messwerte.wiederholungen + " Wdh." : "",
    Number.isFinite(messwerte.gewichtKg) ? messwerte.gewichtKg.toLocaleString("de-DE") + " kg" : "",
  ].filter(Boolean).join(" · ");
}

function exercisePreference(exercise) {
  const saved = userData.uebungsEinstellungen[exercise.id] ?? {};
  if (saved.forciert) return { multiplikator: 1, forciert: true };
  const multiplikator = [0, 0.25, 0.5, 1, 2, 4].includes(saved.multiplikator) ? saved.multiplikator : 1;
  return { multiplikator, forciert: false };
}

function eligibleExercises(optionen) {
  return exercises.filter((exercise) => {
    const preference = exercisePreference(exercise);
    return exercise.anforderungen.geraete.every((item) => optionen.geraete.includes(item)) &&
      (preference.forciert || exercise.auswahlgewicht * preference.multiplikator > 0);
  });
}

function updateAvailability() {
  const optionen = getOptions();
  const available = eligibleExercises(optionen).length;
  const anzahl = Math.min(optionen.anzahl, available);
  byId("availability").textContent = available === 0
    ? "Keine passenden Übungen. Passe deine Auswahl an."
    : available < optionen.anzahl
      ? "Es passen nur " + available + " verschiedene Übungen. Das Training enthält alle " + available + "."
      : anzahl + " verschiedene Übungen · je 30 Sekunden · 10 Sekunden Pause dazwischen.";
  byId("begin").disabled = starting || available === 0;
}

// Gleich häufige Übungen teilen sich den mittleren Rang ihrer Platzierungen.
// Liegt dieser genau auf einer Quartilsgrenze, bleibt der Faktor neutral.
function haeufigkeitsFaktoren(verfuegbareUebungen) {
  const zaehlungen = new Map();
  const gruppen = new Map();
  verfuegbareUebungen.forEach((uebung) => {
    const praef = exercisePreference(uebung);
    if (praef.forciert || praef.multiplikator === 0) return;
    zaehlungen.set(uebung.id, 0);
    if (!gruppen.has(praef.multiplikator)) gruppen.set(praef.multiplikator, []);
    gruppen.get(praef.multiplikator).push(uebung);
  });
  userData.verlauf.forEach((ergebnis) => {
    if (!zaehlungen.has(ergebnis.uebungsId)) return;
    const phase = userData.uebungsEinstellungen[ergebnis.uebungsId]?.zaehlphase ?? null;
    if ((ergebnis.zaehlphase ?? null) === phase) {
      zaehlungen.set(ergebnis.uebungsId, zaehlungen.get(ergebnis.uebungsId) + 1);
    }
  });
  const faktoren = new Map();
  gruppen.forEach((gruppe) => {
    gruppe.sort((a, b) => zaehlungen.get(a.id) - zaehlungen.get(b.id));
    for (let anfang = 0; anfang < gruppe.length;) {
      let ende = anfang + 1;
      while (ende < gruppe.length && zaehlungen.get(gruppe[ende].id) === zaehlungen.get(gruppe[anfang].id)) ende++;
      const rang = (anfang + ende) / (2 * gruppe.length);
      const faktor = rang < 0.25 ? 1.5 : rang > 0.75 ? 0.66 : 1;
      for (let index = anfang; index < ende; index++) faktoren.set(gruppe[index].id, faktor);
      anfang = ende;
    }
  });
  return faktoren;
}

// Forcierte Übungen werden zuerst gleichverteilt und ohne Wiederholung gezogen.
// Übrige Plätze werden gewichtet gefüllt. Geräteanforderungen gelten immer.
function sampleExercises(optionen) {
  const eligible = eligibleExercises(optionen);
  const haeufigkeit = haeufigkeitsFaktoren(eligible);
  const forciert = eligible.filter((exercise) => exercisePreference(exercise).forciert);
  const chosen = [];
  while (forciert.length && chosen.length < optionen.anzahl) {
    const index = Math.floor(Math.random() * forciert.length);
    chosen.push(forciert.splice(index, 1)[0]);
  }
  const pool = eligible.filter((exercise) => !exercisePreference(exercise).forciert).map((exercise) => ({
    exercise,
    weight: exercise.auswahlgewicht * exercisePreference(exercise).multiplikator *
      (exercise.schwerpunkte.some((focus) => optionen.schwerpunkte.includes(focus)) ? 2 : 1) *
      (haeufigkeit.get(exercise.id) ?? 1),
  }));
  while (pool.length && chosen.length < optionen.anzahl) {
    let draw = Math.random() * pool.reduce((sum, item) => sum + item.weight, 0);
    let index = 0;
    while (index < pool.length - 1 && draw >= pool[index].weight) {
      draw -= pool[index].weight;
      index++;
    }
    chosen.push(pool.splice(index, 1)[0].exercise);
  }
  // Die Auswahlpriorität bestimmt nicht die Reihenfolge im Training.
  for (let index = chosen.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [chosen[index], chosen[other]] = [chosen[other], chosen[index]];
  }
  return chosen;
}

byId("preferences").addEventListener("toggle", () => {
  if (byId("preferences").open) centerSelectedCount();
});

byId("start").addEventListener("click", () => {
  byId("preferences").open = false;
  updateAvailability();
  byId("setup").showModal();
  centerSelectedCount();
});
byId("cancel").addEventListener("click", () => byId("setup").close());
byId("setup-form").addEventListener("input", updateAvailability);
let starting = false;
byId("setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (starting || !event.currentTarget.reportValidity()) return;
  const optionen = getOptions();
  const selected = sampleExercises(optionen);
  if (!selected.length) return;
  workoutAudio.unlock();
  starting = true;
  byId("begin").disabled = true;
  byId("cancel").disabled = true;
  const record = {
    id: crypto.randomUUID(),
    gestartetAm: new Date().toISOString(),
    uebungsIds: selected.map((exercise) => exercise.id),
    optionen,
  };
  try {
    await trainingDb.beginSession(record, optionen);
    userData.trainingsOptionen = optionen;
    byId("setup").close();
    startSession(selected, record.id);
  } catch (error) {
    byId("availability").textContent = "Die Trainingseinstellungen konnten nicht gespeichert werden. Bitte versuche es erneut.";
    console.error(error);
  } finally {
    starting = false;
    byId("begin").disabled = false;
    byId("cancel").disabled = false;
  }
});
byId("setup").addEventListener("cancel", (event) => {
  if (starting) event.preventDefault();
});

let session = null;
let timerId = null;
let bildschirmSperre = null;
let bildschirmAnfrage = 0;

function trainingAktiv() {
  return session !== null && session.phase !== "done";
}

function bildschirmHinweis(text) {
  byId("screen-status").textContent = text;
  byId("screen-status").hidden = !text;
}

async function bildschirmWachhalten() {
  const sitzung = session;
  const anfrage = ++bildschirmAnfrage;
  if (!trainingAktiv() || document.hidden) return;
  if (!navigator.wakeLock) {
    bildschirmHinweis("Dein Browser unterstützt das automatische Wachhalten nicht.");
    return;
  }
  try {
    const sperre = await navigator.wakeLock.request("screen");
    // Eine verspätete Antwort darf kein bereits beendetes Training wach halten.
    if (anfrage !== bildschirmAnfrage || session !== sitzung || !trainingAktiv() || document.hidden) {
      await sperre.release();
      return;
    }
    bildschirmSperre = sperre;
    bildschirmHinweis("");
    sperre.addEventListener("release", () => {
      if (bildschirmSperre !== sperre) return;
      bildschirmSperre = null;
      if (trainingAktiv() && !document.hidden) {
        bildschirmHinweis("Der Bildschirm kann wieder automatisch ausgehen.");
      }
    });
  } catch {
    if (session === sitzung && trainingAktiv() && !document.hidden) {
      bildschirmHinweis("Der Bildschirm konnte nicht wach gehalten werden.");
    }
  }
}

function bildschirmFreigeben() {
  bildschirmAnfrage++;
  const sperre = bildschirmSperre;
  bildschirmSperre = null;
  if (sperre) sperre.release().catch(() => {});
}

function beendeTraining(meldung = "") {
  // Bereits erreichte Abschlüsse zählen; das aktuelle Teilintervall zählt nicht.
  if (trainingAktiv()) tick(false);
  clearInterval(timerId);
  workoutAudio.stop();
  session = null;
  bildschirmFreigeben();
  byId("training-navigation").hidden = false;
  byId("session").hidden = true;
  byId("entry").hidden = false;
  byId("training-notice").textContent = meldung;
  byId("training-notice").hidden = !meldung;
  if (!document.hidden) byId("start").focus();
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && trainingAktiv()) {
    beendeTraining("Training wegen App-, Tab- oder Bildschirmwechsel beendet. Abgeschlossene Übungen bleiben gespeichert.");
  }
});
window.addEventListener("pagehide", () => {
  if (trainingAktiv()) beendeTraining();
});

function startSession(selected, id) {
  if (document.hidden) {
    byId("training-notice").textContent = "Training nicht gestartet, weil die App nicht sichtbar war. Bitte erneut starten.";
    byId("training-notice").hidden = false;
    return;
  }
  clearInterval(timerId);
  workoutAudio.stop();
  session = {
    id, exercises: selected, messwerte: selected.map(trackingDefaults), index: 0, phase: "prepare",
    zaehlphasen: selected.map((uebung) => userData.uebungsEinstellungen[uebung.id]?.zaehlphase ?? null),
    deadline: Date.now() + sessionDefaults.prepareSeconds * 1000,
    audioPhase: null, audioSecond: null,
  };
  byId("training-notice").hidden = true;
  byId("training-navigation").hidden = true;
  bildschirmHinweis("");
  void bildschirmWachhalten();
  byId("entry").hidden = true;
  byId("session").hidden = false;
  byId("stop").textContent = "Training beenden";
  renderSession();
  cueSessionAudio();
  byId("stop").focus();
  timerId = setInterval(tick, 100);
}

function cueSessionAudio() {
  if (!session) return;
  const key = session.phase + ":" + session.index;
  const remaining = Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
  if (session.audioPhase !== key) {
    session.audioPhase = key;
    session.audioSecond = null;
    workoutAudio.stop();
    if (session.phase === "done") workoutAudio.finish();
    else if (session.phase === "exercise" && remaining === sessionDefaults.exerciseSeconds) workoutAudio.start();
    else if (session.phase !== "exercise" && remaining > 3) {
      const nextIndex = session.index + (session.phase === "rest" ? 1 : 0);
      workoutAudio.announce(session.exercises[nextIndex].name);
    }
  }
  // Nur die aktuelle Sekunde ausgeben; verpasste Signale nicht nachholen.
  if (session.phase !== "done" && remaining >= 1 && remaining <= 3 &&
      session.audioSecond !== remaining) {
    session.audioSecond = remaining;
    workoutAudio.countdown(remaining);
  }
}

function tick(mitTon = true) {
  // Feste Zeitpunkte verhindern verlängerte Intervalle durch Browserdrosselung.
  while (session && session.phase !== "done" && Date.now() >= session.deadline) {
    if (session.phase === "exercise") {
      const result = {
        id: session.id + ":" + session.index,
        trainingsId: session.id,
        uebungsId: session.exercises[session.index].id,
        zaehlphase: session.zaehlphasen[session.index],
        abgeschlossenAm: new Date(session.deadline).toISOString(),
        messwerte: { sekunden: sessionDefaults.exerciseSeconds, ...session.messwerte[session.index] },
      };
      userData.verlauf.push(result);
      unsavedResults++;
      renderCatalogue();
      trainingDb.saveResult(result).then(() => {
        unsavedResults--;
        renderCatalogue();
      }).catch((error) => {
        byId("app-status").hidden = false;
        byId("app-status").textContent = "Einige Ergebnisse konnten nicht gespeichert werden. Beim Neuladen gehen sie verloren.";
        console.error(error);
      });
      if (session.index === session.exercises.length - 1) {
        session.phase = "done";
        clearInterval(timerId);
        bildschirmFreigeben();
        byId("training-navigation").hidden = false;
        bildschirmHinweis("");
      } else {
        session.phase = "rest";
        session.deadline += sessionDefaults.restSeconds * 1000;
      }
    } else {
      if (session.phase === "rest") session.index++;
      session.phase = "exercise";
      session.deadline += sessionDefaults.exerciseSeconds * 1000;
    }
  }
  renderSession();
  if (mitTon) cueSessionAudio();
}

function setExerciseIcon(image, exercise) {
  if (!exercise.bild) {
    image.hidden = true;
    image.onerror = null;
    image.removeAttribute("src");
    return;
  }
  if (image.getAttribute("src") === exercise.bild) return;
  image.onerror = () => { image.hidden = true; };
  image.hidden = false;
  image.src = exercise.bild;
}

function renderSession() {
  if (!session) return;
  const done = session.phase === "done";
  const progress = done ? "Training abgeschlossen" :
    (session.phase === "prepare" ? "Mach dich bereit" : session.phase === "rest" ? "Pause" : "Übung") + " · " +
    (session.index + 1) + " / " + session.exercises.length;
  // Gleiche Fortschrittsmeldungen für Screenreader nicht wiederholen.
  if (byId("progress").textContent !== progress) byId("progress").textContent = progress;
  byId("current-exercise").textContent = done ? "Geschafft!" :
    session.phase === "prepare" ? session.exercises[0].name :
    session.phase === "rest" ? session.exercises[session.index + 1].name :
      session.exercises[session.index].name;
  const bild = byId("current-bild");
  if (done) {
    bild.hidden = true;
    bild.removeAttribute("src");
  } else {
    setExerciseIcon(bild, session.exercises[session.index + (session.phase === "rest" ? 1 : 0)]);
  }
  byId("timer").textContent = done ? "" : Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000));
  if (done) byId("stop").textContent = "Zurück zum Start";
  renderSessionTracking();
}
byId("stop").addEventListener("click", () => beendeTraining());

const preferenceChoices = [
  { value: "0", label: "Aus", symbol: "×" },
  { value: "0.25", label: "¼× · Vierteln", symbol: "1/4" },
  { value: "0.5", label: "½× · Halbieren", symbol: "1/2" },
  { value: "1", label: "1× · Normal", symbol: "1" },
  { value: "2", label: "2× · Verdoppeln", symbol: "2" },
  { value: "4", label: "4× · Vervierfachen", symbol: "4" },
  { value: "forciert", label: "Forciert · Zuerst ziehen", symbol: "✓" },
];
let editingExerciseId = null;
let savingPreference = false;
preferenceChoices.forEach(({ value, label: title, symbol }) => {
  const label = document.createElement("label");
  label.className = "option-tile";
  label.title = title;
  if (value === "forciert") label.classList.add("forciert-option");
  if (value === "0") label.classList.add("off-option");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "exercisePreference";
  input.setAttribute("aria-label", title);
  input.value = value;
  input.required = true;
  const text = document.createElement("span");
  text.textContent = symbol;
  text.setAttribute("aria-hidden", "true");
  label.append(input, text);
  byId("preference-optionen").append(label);
});

function preferenceValue(exercise) {
  const preference = exercisePreference(exercise);
  return preference.forciert ? "forciert" : String(preference.multiplikator);
}

function openExerciseEditor(exercise) {
  editingExerciseId = exercise.id;
  byId("exercise-editor-title").textContent = exercise.name;
  setExerciseIcon(byId("exercise-editor-bild"), exercise);
  byId("exercise-editor-status").textContent = "";
  byId("default-tracking").hidden = exercise.erfassungsfelder.length === 0;
  renderTrackingInputs(byId("default-metric-inputs"), exercise, trackingDefaults(exercise), "default");
  const value = preferenceValue(exercise);
  byId("preference-optionen").querySelectorAll("input").forEach((input) => {
    input.checked = input.value === value;
  });
  byId("exercise-editor").showModal();
}

byId("exercise-editor-cancel").addEventListener("click", () => byId("exercise-editor").close());
byId("exercise-editor").addEventListener("cancel", (event) => {
  if (savingPreference) event.preventDefault();
});
byId("exercise-editor").addEventListener("close", () => {
  const trigger = [...byId("exercise-list").querySelectorAll("button")]
    .find((button) => button.dataset.uebungsId === editingExerciseId);
  trigger?.focus();
});
byId("exercise-editor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (savingPreference || !event.currentTarget.reportValidity()) return;
  const value = new FormData(event.currentTarget).get("exercisePreference");
  if (!preferenceChoices.some((choice) => choice.value === value)) return;
  const standardwerte = readTrackingInputs(byId("default-metric-inputs"));
  const uebung = exercises.find((eintrag) => eintrag.id === editingExerciseId);
  const bisher = exercisePreference(uebung);
  const multiplikator = value === "forciert" ? 1 : Number(value);
  const forciert = value === "forciert";
  const geaendert = bisher.multiplikator !== multiplikator || bisher.forciert !== forciert;
  const zaehlphase = geaendert ? crypto.randomUUID()
    : userData.uebungsEinstellungen[editingExerciseId]?.zaehlphase ?? null;
  const preferences = {
    ...userData.uebungsEinstellungen,
    [editingExerciseId]: {
      ...userData.uebungsEinstellungen[editingExerciseId],
      multiplikator,
      forciert,
      zaehlphase,
      standardwerte,
    },
  };
  savingPreference = true;
  byId("preference-fields").disabled = true;
  byId("default-tracking").disabled = true;
  byId("exercise-editor-save").disabled = true;
  byId("exercise-editor-cancel").disabled = true;
  byId("exercise-editor-status").textContent = "Wird gespeichert…";
  try {
    await trainingDb.saveExercisePreferences(preferences);
    userData.uebungsEinstellungen = preferences;
    renderCatalogue();
    updateAvailability();
    byId("exercise-editor").close();
  } catch (error) {
    byId("exercise-editor-status").textContent = "Speichern fehlgeschlagen. Bitte versuche es erneut.";
    console.error(error);
  } finally {
    savingPreference = false;
    byId("preference-fields").disabled = false;
    byId("default-tracking").disabled = false;
    byId("exercise-editor-save").disabled = false;
    byId("exercise-editor-cancel").disabled = false;
  }
});

let statsFilter = { geraete: [], schwerpunkte: [] };

function filterStatsExercises(optionen) {
  return exercises.filter((exercise) =>
    optionen.geraete.every((item) => exercise.anforderungen.geraete.includes(item)) &&
    optionen.schwerpunkte.every((focus) => exercise.schwerpunkte.includes(focus))
  );
}

function readStatsFilter() {
  const data = new FormData(byId("stats-filter-form"));
  return { geraete: data.getAll("geraete"), schwerpunkte: data.getAll("schwerpunkte") };
}

function restoreStatsFilter(optionen) {
  byId("stats-filter-form").querySelectorAll("input").forEach((input) => {
    input.checked = optionen[input.name].includes(input.value);
  });
  updateStatsFilterPreview();
}

function updateStatsFilterPreview() {
  byId("stats-filter-preview").textContent =
    filterStatsExercises(readStatsFilter()).length + " von " + exercises.length + " Übungen";
}

byId("stats-filter-open").addEventListener("click", () => {
  restoreStatsFilter(statsFilter);
  byId("stats-filter").showModal();
});
byId("stats-filter-cancel").addEventListener("click", () => byId("stats-filter").close());
byId("stats-filter-form").addEventListener("input", updateStatsFilterPreview);
byId("stats-filter-reset").addEventListener("click", () => {
  restoreStatsFilter({
    geraete: [],
    schwerpunkte: [],
  });
});
byId("stats-filter-form").addEventListener("submit", (event) => {
  event.preventDefault();
  statsFilter = readStatsFilter();
  renderCatalogue();
  byId("stats-filter").close();
});

function renderCatalogue() {
  byId("exercise-list").replaceChildren();
  const counts = new Map();
  userData.verlauf.forEach(({ uebungsId }) => counts.set(uebungsId, (counts.get(uebungsId) || 0) + 1));
  const visible = filterStatsExercises(statsFilter);
  const active = statsFilter.schwerpunkte.length > 0 || statsFilter.geraete.length > 0;
  byId("stats-filter-open").textContent = active ? "Filter · aktiv" : "Filter";
  byId("stats-filter-summary").textContent = visible.length + " von " + exercises.length + " Übungen";
  byId("stats-empty").hidden = visible.length !== 0;
  visible.sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0)).forEach((exercise) => {
    const item = document.createElement("li");
    item.className = "exercise-list-item";
    const card = document.createElement("button");
    card.type = "button";
    card.className = "exercise-card";
    card.dataset.uebungsId = exercise.id;
    card.setAttribute("aria-haspopup", "dialog");
    card.setAttribute("aria-label", exercise.name + ": Einstellungen bearbeiten");
    card.addEventListener("click", () => openExerciseEditor(exercise));
    const bild = document.createElement("img");
    bild.className = "exercise-thumbnail";
    bild.alt = "";
    bild.width = 72;
    bild.height = 72;
    bild.loading = "lazy";
    setExerciseIcon(bild, exercise);
    const text = document.createElement("span");
    text.className = "exercise-text";
    const name = document.createElement("strong");
    const details = document.createElement("small");
    name.textContent = exercise.name + " · " + (counts.get(exercise.id) || 0) + " abgeschlossen";
    details.textContent = [
      exercise.schwerpunkte.join(", "),
      exercise.anforderungen.geraete.join(", ") || "Ohne Geräte",
    ].join(" · ");
    const badge = document.createElement("span");
    badge.className = "preference-badge";
    badge.textContent = preferenceChoices.find((choice) => choice.value === preferenceValue(exercise)).label;
    text.append(name, details, badge);
    const latest = userData.verlauf.filter((result) => result.uebungsId === exercise.id && result.messwerte)
      .reduce((last, result) => !last || result.abgeschlossenAm > last.abgeschlossenAm ? result : last, null);
    if (latest && formatMetrics(latest.messwerte)) {
      const lastResult = document.createElement("small");
      lastResult.textContent = "Zuletzt: " + formatMetrics(latest.messwerte);
      text.append(lastResult);
    }
    card.append(bild, text);
    item.append(card);
    byId("exercise-list").append(item);
  });
  byId("verlauf-summary").textContent = userData.verlauf.length
    ? userData.verlauf.length + " Übungen abgeschlossen." +
      (unsavedResults ? " " + unsavedResults + " noch nicht gespeichert." : " Auf diesem Gerät gespeichert.")
    : "Noch keine Übungen abgeschlossen.";
}

async function initialize() {
  try {
    exercises = await loadExercises();
    await trainingDb.open();
    userData = await trainingDb.loadUserData();
    populateOptions();
    renderCatalogue();
    byId("app-status").hidden = true;
    byId("start").disabled = false;
    byId("stats-filter-open").disabled = false;
  } catch (error) {
    byId("app-status").hidden = false;
    byId("app-status").textContent =
      "Übungen oder lokale Daten konnten nicht geladen werden. Öffne die App über HTTP (localhost) oder HTTPS, erlaube die Browserspeicherung und lade die Seite neu.";
    console.error(error);
  }
}
initialize();
