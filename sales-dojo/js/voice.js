/* =========================================================
 * voice.js — ブラウザ標準の音声認識(STT)/音声合成(TTS)ラッパー
 * 非対応・失敗時はテキスト入力へフォールバックする前提の設計。
 * SpeechRecognitionは毎回新規生成する(iOS Safariは同一インスタンスの
 * 2回目以降のstart()が無反応になるため使い回し不可)。
 * ========================================================= */

const Voice = {
  rec: null,
  listening: false,
  ttsOn: true,
  voice: null,
  onText: null,    // (text) => void
  onState: null,   // (listening) => void
  onNotice: null,  // (message) => void

  hasSTT() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },
  hasTTS() {
    return "speechSynthesis" in window;
  },

  init() {
    if (!this.hasTTS()) return;
    const pick = () => {
      const vs = speechSynthesis.getVoices();
      this.voice =
        vs.find((v) => v.lang.startsWith("ja") && VOICE_PREF.genderRegex.test(v.name)) ||
        vs.find((v) => v.lang.startsWith("ja")) || null;
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  },

  _newRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "ja-JP";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0].transcript).join("").trim();
      if (text && this.onText) this.onText(text);
    };
    rec.onend = () => {
      if (this.rec === rec) {
        this.rec = null;
        this.listening = false;
        if (this.onState) this.onState(false);
      }
    };
    rec.onerror = (e) => {
      if (this.rec === rec) {
        this.rec = null;
        this.listening = false;
        if (this.onState) this.onState(false);
      }
      if (!this.onNotice) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.onNotice("マイクが許可されていません。テキスト入力で続けられます。");
      } else if (e.error === "no-speech") {
        this.onNotice("聞き取れませんでした。もう一度話すか、テキストでどうぞ。");
      } else if (e.error !== "aborted") {
        this.onNotice("音声認識に失敗しました。テキスト入力でも続けられます。");
      }
    };
    return rec;
  },

  /* silent=true: 自動再開用。開始失敗してもエラーを出さない */
  listen(silent) {
    if (!this.hasSTT() || this.listening) return;
    this.hush(); // 自声拾い防止: 読み上げ中は認識しない
    if (this.rec) {
      try { this.rec.abort(); } catch (_) {}
      this.rec = null;
    }
    const attempt = (retry) => {
      const rec = this._newRec();
      this.rec = rec;
      try {
        rec.start();
        this.listening = true;
        if (this.onState) this.onState(true);
      } catch (_) {
        // 前セッションの後片付け中はstart()が例外を投げうる。新インスタンスで1回だけ再試行
        this.rec = null;
        if (retry) setTimeout(() => { if (!this.listening) attempt(false); }, 150);
        else if (!silent && this.onNotice) this.onNotice("マイクを開始できませんでした。もう一度タップしてください。");
      }
    };
    attempt(true);
  },

  stopListening() {
    if (this.rec) { try { this.rec.stop(); } catch (_) {} }
    this.listening = false;
    if (this.onState) this.onState(false);
  },

  say(text, done) {
    if (!this.ttsOn || !this.hasTTS()) { if (done) done(); return; }
    this.hush();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.pitch = VOICE_PREF.pitch;
    let fired = false;
    const fin = () => { if (!fired) { fired = true; if (done) done(); } };
    u.onend = fin;
    u.onerror = fin;
    speechSynthesis.speak(u);
    // Safariでonendが来ないことがあるため保険タイマー
    setTimeout(fin, Math.min(30000, 1500 + text.length * 220));
  },

  hush() {
    if (this.hasTTS()) speechSynthesis.cancel();
  },
};
