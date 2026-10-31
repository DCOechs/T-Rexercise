// Der Übungskatalog wird getrennt von den persönlichen Daten geladen.
async function loadExercises() {
  const response = await fetch("./data/exercises.json");
  if (!response.ok) throw new Error("Übungen konnten nicht geladen werden (HTTP " + response.status + ").");
  const catalogue = await response.json();
  const ids = new Set();
  const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
  if (!Array.isArray(catalogue) || !catalogue.length) throw new Error("Der Übungskatalog ist leer oder ungültig.");
  for (const exercise of catalogue) {
    if (!exercise || typeof exercise.id !== "string" || !exercise.id ||
        ids.has(exercise.id) || typeof exercise.name !== "string" ||
        (exercise.bild != null && (typeof exercise.bild !== "string" ||
          !/^\.\/assets\/icons\/exercises\/[a-z0-9-]+\.svg$/.test(exercise.bild))) ||
        !strings(exercise.schwerpunkte) || !strings(exercise.erfassungsfelder) ||
        exercise.erfassungsfelder.some((field) => !["wiederholungen", "gewichtKg"].includes(field)) ||
        !exercise.anforderungen || !strings(exercise.anforderungen.geraete) ||
        !Number.isFinite(exercise.auswahlgewicht) || exercise.auswahlgewicht < 0) {
      throw new Error("Ungültige oder doppelte Übung im Katalog.");
    }
    ids.add(exercise.id);
  }
  return catalogue;
}
