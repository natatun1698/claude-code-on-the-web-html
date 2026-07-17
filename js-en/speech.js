/* =========================================================
 * speech.js — Wrapper around the browser's built-in speech
 * recognition/synthesis (English locale). Falls back to text
 * input when unsupported (or on failure).
 * Voice tone (gender leaning / pitch) comes from data.js's VOICE_PREF:
 *   VOICE_PREF = { genderRegex: /.../, pitch: 1.0 }
 *
 * A fresh recognition instance is created on every call.
 * iOS Safari stops responding to start() on a reused instance
 * after the first run, so instances are never reused.
 * ========================================================= */

const SpeechIO = {
  recognition: null,  // currently active recognition instance
  listening: false,
  ttsEnabled: true,
  voice: null,
  onResult: null,   // (text) => void
  onStateChange: null, // (listening:boolean) => void
  onError: null,    // (message) => void

  /* Is speech recognition available? */
  sttSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* Is speech synthesis available? */
  ttsSupported() {
    return "speechSynthesis" in window;
  },

  init() {
    if (this.ttsSupported()) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        // Prefer an English voice matching data.js's VOICE_PREF.genderRegex
        this.voice =
          voices.find((v) => v.lang.startsWith("en") && VOICE_PREF.genderRegex.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  },

  /* Create a brand-new recognition instance every time */
  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    // iOS Safari often ends without ever returning a final result, so we
    // also capture interim results and commit them on onend.
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
        if (this.onError) this.onError("Microphone access isn't allowed. Please use text input instead.");
      } else if (e.error === "no-speech") {
        if (this.onError) this.onError("We couldn't hear you. Try speaking again, or use text input.");
      } else if (e.error !== "aborted") {
        if (this.onError) this.onError("Speech recognition failed. You can still continue with text input.");
      }
    };
    return rec;
  },

  /* When silent=true, don't surface an error if start fails (used for auto-restart) */
  startListening(silent) {
    if (!this.sttSupported() || this.listening) return;
    // Don't listen while the counterpart is speaking (avoid picking up our own voice)
    this.stopSpeaking();
    // Discard any leftover instance from before (its result won't be delivered)
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
        // start() can throw while a previous session is still tearing down.
        // Retry once, after a short delay, with a fresh instance.
        this.recognition = null;
        if (retry) {
          setTimeout(() => { if (!this.listening) tryStart(false); }, 150);
        } else if (!silent && this.onError) {
          this.onError("Couldn't start the microphone. Please tap again.");
        }
      }
    };
    // iOS often fails to start the mic right after speech synthesis stops, so wait briefly
    setTimeout(() => tryStart(true), 150);
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    this.listening = false;
    if (this.onStateChange) this.onStateChange(false);
  },

  /* Speak the counterpart's line. onDone fires when speech finishes (or TTS is unavailable) */
  speak(text, onDone) {
    if (!this.ttsEnabled || !this.ttsSupported()) {
      if (onDone) onDone();
      return;
    }
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = VOICE_PREF.pitch;
    let called = false;
    const done = () => { if (!called) { called = true; if (onDone) onDone(); } };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    // Safari safeguard: onend sometimes never fires, so use a fallback timer
    const estimate = Math.min(30000, 1500 + text.length * 220);
    setTimeout(done, estimate);
  },

  stopSpeaking() {
    if (this.ttsSupported()) speechSynthesis.cancel();
  },
};
