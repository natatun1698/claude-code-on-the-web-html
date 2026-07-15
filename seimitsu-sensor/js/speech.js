/* =========================================================
 * speech.js — ブラウザ標準の音声認識/音声合成のラッパー
 * センサー営業ロープレ専用コピー(既存アプリとは独立)。
 * 非対応環境(または失敗時)はテキスト入力へフォールバックする。
 * 声質は data.js の VOICE_PREF で指定する。
 *
 * 音声認識は毎回新しいインスタンスを生成する。
 * iOS Safari は同一インスタンスの再利用で2回目以降の start() が
 * 無反応になるため、使い回しは不可。
 * ========================================================= */

const SpeechIO = {
  recognition: null,
  listening: false,
  ttsEnabled: true,
  voice: null,
  onResult: null,      // (text) => void
  onStateChange: null, // (listening:boolean) => void
  onError: null,       // (message) => void

  sttSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  ttsSupported() {
    return "speechSynthesis" in window;
  },

  init() {
    if (this.ttsSupported()) {
      const pickVoice = () => {
        const voices = speechSynthesis.getVoices();
        this.voice =
          voices.find((v) => v.lang.startsWith("ja") && VOICE_PREF.genderRegex.test(v.name)) ||
          voices.find((v) => v.lang.startsWith("ja")) ||
          null;
      };
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
  },

  _createRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "ja-JP";
    // iOS Safariはfinal結果を返さないまま終了することが多いため、
    // interimも受け取ってバッファし、認識終了時(onend)に確定させる。
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
        if (this.onError) this.onError("マイクの使用が許可されていません。テキスト入力をご利用ください。");
      } else if (e.error === "no-speech") {
        if (this.onError) this.onError("音声が聞き取れませんでした。もう一度話すか、テキスト入力をどうぞ。");
      } else if (e.error !== "aborted") {
        if (this.onError) this.onError("音声認識に失敗しました。テキスト入力でも続けられます。");
      }
    };
    return rec;
  },

  /* silent=true のとき、開始に失敗してもエラー表示しない(自動再開用) */
  startListening(silent) {
    if (!this.sttSupported() || this.listening) return;
    // 相手が話している最中は聞き取らない(自声拾い防止)
    this.stopSpeaking();
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
        this.recognition = null;
        if (retry) {
          setTimeout(() => { if (!this.listening) tryStart(false); }, 150);
        } else if (!silent && this.onError) {
          this.onError("マイクを開始できませんでした。もう一度タップしてください。");
        }
      }
    };
    // iOSは読み上げ停止直後のマイク開始に失敗しやすいため、少し待ってから開始
    setTimeout(() => tryStart(true), 150);
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    this.listening = false;
    if (this.onStateChange) this.onStateChange(false);
  },

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
    u.pitch = VOICE_PREF.pitch;
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
