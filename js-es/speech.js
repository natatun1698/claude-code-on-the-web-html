/* =========================================================
 * speech.js — Envoltorio sobre el reconocimiento/síntesis de voz
 * nativos del navegador (locale español - es-ES). Recurre a la
 * entrada de texto cuando no está soportado (o si falla).
 * El timbre de voz (tendencia de género / tono) viene del
 * VOICE_PREF de data.js:
 *   VOICE_PREF = { genderRegex: /.../, pitch: 1.0 }
 *
 * Se crea una instancia de reconocimiento nueva en cada llamada.
 * En iOS Safari, reutilizar la misma instancia hace que start()
 * deje de responder a partir de la segunda llamada, por eso nunca
 * se reutiliza.
 * ========================================================= */

const SpeechIO = {
  recognition: null,  // instancia de reconocimiento actualmente activa
  listening: false,
  ttsEnabled: true,
  voice: null,
  onResult: null,   // (text) => void
  onStateChange: null, // (listening:boolean) => void
  onError: null,    // (message) => void

  /* ¿Está disponible el reconocimiento de voz? */
  sttSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* ¿Está disponible la síntesis de voz? */
  ttsSupported() {
    return "speechSynthesis" in window;
  },

  init() {
    if (this.ttsSupported()) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        // Prioriza una voz en español que coincida con VOICE_PREF.genderRegex de data.js
        this.voice =
          voices.find((v) => v.lang.startsWith("es") && VOICE_PREF.genderRegex.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("es")) ||
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  },

  /* Crea una instancia de reconocimiento nueva cada vez */
  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "es-ES";
    // iOS Safari a menudo termina sin devolver un resultado final, así que
    // también capturamos resultados provisionales y los confirmamos en onend.
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let buf = "";
    rec.onresult = (e) => {
      let final = "", interim = "";
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      buf = (final || interim).trim();
    };
    rec.onend = () => {
      if (this.recognition === rec) {
        this.recognition = null;
        this.listening = false;
        if (this.onStateChange) this.onStateChange(false);
      }
      const text = buf.trim();
      buf = "";
      if (text && !rec._discard && this.onResult) this.onResult(text);
    };
    rec.onerror = (e) => {
      if (this.recognition === rec) {
        this.recognition = null;
        this.listening = false;
        if (this.onStateChange) this.onStateChange(false);
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        if (this.onError) this.onError("No se permitió el uso del micrófono. Usa la entrada de texto.");
      } else if (e.error === "no-speech") {
        if (this.onError) this.onError("No pudimos escucharte. Intenta hablar de nuevo o usa la entrada de texto.");
      } else if (e.error !== "aborted") {
        if (this.onError) this.onError("Falló el reconocimiento de voz. Puedes continuar con la entrada de texto.");
      }
    };
    return rec;
  },

  /* Cuando silent=true, no muestra un error si falla el inicio (usado en el reinicio automático) */
  startListening(silent) {
    if (!this.sttSupported() || this.listening) return;
    // No escucha mientras la contraparte está hablando (evita captar la propia voz de la app)
    this.stopSpeaking();
    // Descarta cualquier instancia anterior que quede (su resultado no se entregará)
    if (this.recognition) {
      this.recognition._discard = true;
      try { this.recognition.abort(); } catch (_) {}
      this.recognition = null;
    }
    const tryStart = (retry) => {
      if (this.listening) return;
      const rec = this._createRecognition();
      this.recognition = rec;
      try {
        rec.start();
        this.listening = true;
        if (this.onStateChange) this.onStateChange(true);
      } catch (_) {
        // start() puede lanzar una excepción mientras la sesión anterior
        // todavía se está cerrando. Reintenta una vez, con una instancia nueva.
        this.recognition = null;
        if (retry) {
          setTimeout(() => { if (!this.listening) tryStart(false); }, 150);
        } else if (!silent && this.onError) {
          this.onError("No se pudo iniciar el micrófono. Toca de nuevo.");
        }
      }
    };
    // En iOS, iniciar el micrófono justo después de la síntesis de voz suele fallar, así que espera un poco
    setTimeout(() => tryStart(true), 150);
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    this.listening = false;
    if (this.onStateChange) this.onStateChange(false);
  },

  /* Lee en voz alta la línea de la contraparte. onDone se llama al terminar la lectura (o si TTS no está disponible) */
  speak(text, onDone) {
    if (!this.ttsEnabled || !this.ttsSupported()) {
      if (onDone) onDone();
      return;
    }
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-ES";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = VOICE_PREF.pitch;
    let called = false;
    const done = () => { if (!called) { called = true; if (onDone) onDone(); } };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    // Precaución para Safari: onend a veces no se dispara, por eso hay un temporizador de seguridad
    const estimate = Math.min(30000, 1500 + text.length * 220);
    setTimeout(done, estimate);
  },

  stopSpeaking() {
    if (this.ttsSupported()) speechSynthesis.cancel();
  },
};
