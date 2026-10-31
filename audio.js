// Browser-native sound only: German speech plus short synthesized timing cues.
const workoutAudio = (() => {
  let context;
  const tones = new Set();
  const synth = window.speechSynthesis;

  function stop() {
    if (synth) synth.cancel();
    for (const tone of tones) {
      try { tone.stop(); } catch { /* Already ended. */ }
    }
    tones.clear();
  }

  function speak(text) {
    if (!synth || !window.SpeechSynthesisUtterance) return;
    try {
      synth.cancel(); // Never queue old instructions behind a countdown.
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      const voices = synth.getVoices().filter((voice) => /^de(?:[-_]|$)/i.test(voice.lang));
      // Voice names are only hints; the browser exposes no standard quality rating.
      utterance.voice = voices.find((voice) => /natural|neural|premium|enhanced/i.test(voice.name)) ||
        voices.find((voice) => voice.default) ||
        voices.find((voice) => /^de[-_]DE$/i.test(voice.lang)) || voices[0] || null;
      utterance.rate = 1;
      utterance.onerror = () => {}; // Visual timer and tones remain available.
      synth.speak(utterance);
    } catch { /* Speech support must not interrupt the workout. */ }
  }

  // Call synchronously from a tap, before awaiting IndexedDB, for mobile autoplay.
  function unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        context ??= new AudioContext();
        if (context.state !== "running") context.resume().catch(() => {});
      }
    } catch { /* Continue with speech or the visual timer. */ }
    speak("Bereit.");
  }

  function beep(frequency = 660, duration = 0.12) {
    if (!context || context.state !== "running") return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      tones.add(oscillator);
      oscillator.onended = () => {
        tones.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch { /* Audio is optional; timing stays independent. */ }
  }

  return {
    unlock,
    stop,
    announce(name) { speak(name); },
    countdown() {
      beep();
    },
    start() {
      beep(880, 0.22);
    },
    finish() {
      beep(880, 0.35);
    },
  };
})();
