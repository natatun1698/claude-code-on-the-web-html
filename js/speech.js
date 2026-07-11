/* =========================================================
 * speech.js — ブラウザ標準の音声認識/音声合成のラッパー
 * 非対応環境(または失敗時)はテキスト入力へフォールバックする。
 * ========================================================= */

const SpeechIO = {
  recognition: null,
  listening: false,
  ttsEnabled: true,
  voice: null,
  onResult: null,   // (text) => void
  onStateChange: null, // (listening:boolean) => void
  onError: null,    // (message) => void

  /* 音声認識が使えるか */
  sttSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /* 音声合成が使えるか */
  ttsSupported() {
    return "speechSynthesis" in window;
  },

  init() {
    if (this.sttSupported()) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "ja-JP";
      rec.interimResults = false;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0].transcript).join("");
        if (text.trim() && this.onResult) this.onResult(text.trim());
      };
      rec.onend = () => {
        this.listening = false;
        if (this.onStateChange) this.onStateChange(false);
      };
      rec.onerror = (e) => {
        this.listening = false;
        if (this.onStateChange) this.onStateChange(false);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          if (this.onError) this.onError("マイクの使用が許可されていません。テキスト入力をご利用ください。");
        } else if (e.error === "no-speech") {
          if (this.onError) this.onError("音声が聞き取れませんでした。もう一度話すか、テキスト入力をどうぞ。");
        } else if (e.error !== "aborted") {
          if (this.onError) this.onError("音声認識に失敗しました。テキスト入力でも続けられます。");
        }
      };
      this.recognition = rec;
    }

    if (this.ttsSupported()) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        // 日本語の女性系ボイスを優先(事務長=佐藤さん)
        this.voice =
          voices.find((v) => v.lang.startsWith("ja") && /female|女性|kyoko|o-?ren|nanami|haruka|ayumi/i.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("ja")) ||
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  },

  startListening() {
    if (!this.recognition || this.listening) return;
    // 事務長が話している最中は聞き取らない(自声拾い防止)
    this.stopSpeaking();
    try {
      this.recognition.start();
      this.listening = true;
      if (this.onStateChange) this.onStateChange(true);
    } catch (_) {
      /* 連続start等は無視 */
    }
  },

  stopListening() {
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch (_) {}
    }
  },

  /* 事務長のセリフを読み上げる。onDone は読み上げ完了(またはTTS不可)時に呼ぶ */
  speak(text, onDone) {
    if (!this.ttsEnabled || !this.ttsSupported()) {
      if (onDone) onDone();
      return;
    }
    this.stopSpeaking();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = 1.1;
    let called = false;
    const done = () => { if (!called) { called = true; if (onDone) onDone(); } };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
    // Safari対策: onend が来ないことがあるため保険タイマー
    const estimate = Math.min(30000, 1500 + text.length * 220);
    setTimeout(done, estimate);
  },

  stopSpeaking() {
    if (this.ttsSupported()) speechSynthesis.cancel();
  },
};
