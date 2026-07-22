/* =========================================================
 * speech.js — Wrapper sobre o reconhecimento/síntese de voz nativos
 * do navegador (locale português - pt-BR). Faz fallback para entrada
 * de texto quando não suportado (ou em caso de falha).
 * O timbre de voz (tendência de gênero / tom) vem do VOICE_PREF do
 * data.js:
 *   VOICE_PREF = { genderRegex: /.../, pitch: 1.0 }
 *
 * Uma nova instância de reconhecimento é criada a cada chamada.
 * No iOS Safari, reutilizar a mesma instância faz o start() parar
 * de responder a partir da segunda chamada, por isso nunca é reutilizada.
 * ========================================================= */

const SpeechIO = {
  recognition: null,  // instância de reconhecimento atualmente ativa
  listening: false,
  ttsEnabled: true,
  voice: null,
  onResult: null,   // (text) => void
  onStateChange: null, // (listening:boolean) => void
  onError: null,    // (message) => void

  /* O reconhecimento de voz está disponível? */
  sttSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* A síntese de voz está disponível? */
  ttsSupported() {
    return "speechSynthesis" in window;
  },

  init() {
    if (this.ttsSupported()) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        // Prioriza uma voz em português que combine com VOICE_PREF.genderRegex do data.js
        this.voice =
          voices.find((v) => v.lang.startsWith("pt") && VOICE_PREF.genderRegex.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("pt")) ||
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  },

  /* Cria uma instância de reconhecimento nova a cada vez */
  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    // O iOS Safari frequentemente termina sem retornar um resultado final,
    // então também capturamos resultados interinos e os confirmamos no onend.
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
        if (this.onError) this.onError("O uso do microfone não foi permitido. Use a entrada de texto.");
      } else if (e.error === "no-speech") {
        if (this.onError) this.onError("Não conseguimos ouvir você. Tente falar novamente ou use a entrada de texto.");
      } else if (e.error !== "aborted") {
        if (this.onError) this.onError("Falha no reconhecimento de voz. Você pode continuar com a entrada de texto.");
      }
    };
    return rec;
  },

  /* Quando silent=true, não exibe erro se o início falhar (usado no reinício automático) */
  startListening(silent) {
    if (!this.sttSupported() || this.listening) return;
    // Não escuta enquanto a contraparte está falando (evita captar a própria voz do app)
    this.stopSpeaking();
    // Descarta qualquer instância anterior restante (o resultado dela não será entregue)
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
        // start() pode lançar exceção enquanto a sessão anterior ainda está
        // sendo encerrada. Tenta novamente uma vez, com uma instância nova.
        this.recognition = null;
        if (retry) {
          setTimeout(() => { if (!this.listening) tryStart(false); }, 150);
        } else if (!silent && this.onError) {
          this.onError("Não foi possível iniciar o microfone. Toque novamente.");
        }
      }
    };
    // No iOS, iniciar o microfone logo após a síntese de voz costuma falhar, por isso espera um pouco
    setTimeout(() => tryStart(true), 150);
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    this.listening = false;
    if (this.onStateChange) this.onStateChange(false);
  },

  /* Lê em voz alta a fala da contraparte. onDone é chamado ao terminar a leitura (ou se TTS não estiver disponível) */
  speak(text, onDone) {
    if (!this.ttsEnabled || !this.ttsSupported()) {
      if (onDone) onDone();
      return;
    }
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = VOICE_PREF.pitch;
    let called = false;
    const done = () => { if (!called) { called = true; if (onDone) onDone(); } };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    // Precaução para o Safari: onend às vezes não dispara, então usa um timer de segurança
    const estimate = Math.min(30000, 1500 + text.length * 220);
    setTimeout(done, estimate);
  },

  stopSpeaking() {
    if (this.ttsSupported()) speechSynthesis.cancel();
  },
};
