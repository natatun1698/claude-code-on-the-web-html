---
name: sales-dojo
description: 医療機器営業向け音声ロープレ練習アプリ「商談ロープレ道場」(/sales-dojo/)を開発・拡張する。事務長役AIと音声/テキストで商談練習し、単一テーマのフィードバックを受けられる自己完結の静的Webアプリ。「商談ロープレ道場」「ロープレ道場」「事務長との商談練習」などの依頼で使用する。
---

# 商談ロープレ道場(sales-dojo)

医用機器(放射線X線機器)営業向けの音声ロールプレイング練習Webアプリ。
リポジトリ内の他アプリ(jimucho/bucho/chara-maker)とは**完全に独立**した
自己完結アプリであり、共有ファイルは一切使わない。既存の `/sales-dojo/`
を拡張するか、同じ構成で新アプリを作る際にこのスキルを使う。

## 絶対条件

- **完全クライアントサイドの静的Webアプリ**。サーバー・APIキー・ログイン不要。
  URLを開くだけで使える(GitHub Pages想定)。
- 対応環境: iPhone Safari / Windows Chrome・Edge。レスポンシブ(スマホ縦画面優先)。
- 音声はブラウザ標準API(webkitSpeechRecognition / speechSynthesis)。
  非対応・失敗時はテキスト入力へ自動フォールバックし、機能停止させない。

## ディレクトリ構成(自己完結・共有なし)

```
sales-dojo/
  index.html        6画面(home/mode/theme/prep/play/result)を1ファイルに持つ
  css/style.css     スマホ縦画面優先のデザイン
  js/config.js      商材・専門用語・3モード・4テーマ・称号・定型セリフ・採点パターン・FEEDBACK文言
  js/scenes.js      シーン台本(SCENES)。beat/nugget/closerをモードA/B/C別に持つ
  js/dialog.js      analyze()/CustomerAIクラス/scoreSession() ※ブラウザAPI非依存
  js/voice.js       Voiceオブジェクト(STT/TTSラッパー)
  js/main.js        画面遷移・タイマー・チャットUI・localStorage記録
```

読み込み順: config.js → scenes.js → dialog.js → voice.js → main.js。
商材や文言の変更は config.js / scenes.js だけで完結させ、
dialog.js 以降に商材固有文言をハードコードしない。

## 仕様の要点

### 顧客役: 山田事務長(非医療従事者)
- 専門用語(JARGON配列: DICOM/被ばく線量/トモシンセシス等)を使われたら
  **必ず**聞き返す(同じ用語は1回だけ)。関心は経営面のみ。
- 3モード: A=やさしい(相槌・遮らない) / B=普通(130字超で言い換えなしの説明に
  1回だけ「もう少し簡単に言うと？」) / C=忙しくて怖い(冒頭「5分しかない」、
  110字超の前置きを遮る、ストライク3回で「よくわからないので結構です」と
  walkout=商談打ち切り→採点-15点。結論先出しor60字以下でストライク回復)。

### プレイヤー制約: 業界No.2・値引き不可
値引きを申し出たら(DISCOUNT_REだが拒否表現DISCOUNT_REFUSAL_REなし)
「他社はもっと下げる」と揺さぶり。値引きを断りVALUE_CATEGORIES
(保守/安全/画質/操作性/検査の幅/実績)で切り返したら承認して前進。

### 商材(config.js PRODUCT)
SONIALVISION G4シリーズ、4,500万円〜。強み: DeEP(少ないX線量で高画質)、
トモシンセシス・長尺スロット撮影、BMDオプション(専用部屋不要)、
AI Assist(技師の負担軽減)、保守の速さ。顧客計画: 2か月以内発注・5か月以内稼働。

### CustomerAI.reply()の優先順位(dialog.js)
1. C:長い前置き→遮る 2. 新出専門用語→聞き返す 3. 値引き申し出→揺さぶり
4. 値引き拒否+価値→承認 5. B:わかりにくい→1回聞き返す 6. C:歯切れ良い→回復
6.5. 通常シーンでプレイヤーが質問(QUESTION_RE+CAT_KEYWORDS一致)したら、
台本を進める前にQA_BANK[cat]で文脈回答(同カテゴリ2回目はQA_REPEAT_PREFIX付き)
7. テーマt2かつ非価格シーン→1回だけ値引き圧注入 8. ヒアリング(qaDriven)は
質問時のみnugget開示(質問なし2回目以降はヒント文に変える) 9. beat→followup→closerでend。
※同一セリフの連続はpickFresh(lastNpcと同文を避ける)で防ぐ。
※ロープレ画面は `#screen-play{height:100dvh;overflow:hidden}` で画面内スクロールに
固定し、タイマーバーが常に見えるようにする(iPhoneでタイマーが隠れる問題の対策)。

### 採点(scoreSession、選択テーマのみ評価・他観点に言及しない)
- t1 専門用語: 100点減点型(用語-12、言い換え併用-6、言い換えボーナス+4×3まで)
- t2 値引き切り返し: 基礎60点(申し出-30、拒否+10、価値カテゴリ初出+6/圧直後+10)
- t3 結論から簡潔に: 100点(遮られ-12、120字超-6、結論マーカー+4、平均100字超-10)
- t4 意図汲み取り: 30+70×(質問カテゴリCAT_KEYWORDSと回答の一致率)

結果画面: ①達成度◎(85+)/○(70+)/△(50+)/× ②良かった発言の実引用
③改善点1つだけ+言い換え例(FEEDBACKテンプレ) ④「事務長攻略度N点」+称号
(90+マスター/80+腕利き/70+一人前/55+見習い/40+駆け出し/修行中)
⑤通算回数・連続日数・自己ベスト(localStorage `salesDojoRecords`、try/catchで包む)。

### 画面フロー
シーン選択(5種+記録バッジ) → 事務長モード → 評価テーマ(1つ) →
準備(サマリ+コツ+5/10/15/20分) → ロープレ(残り時間タイマー・残り1分警告、
チャット、マイク/テキスト切替、読み上げON/OFF、終了) → 結果(もう一度/次のテーマへ/トップ)。

## 実装上の落とし穴(必ず守る)

- **SpeechRecognitionは毎回新規生成**(iOS Safariは再利用すると2回目以降無反応)。
  start()例外は新インスタンスで150ms後に1回だけ再試行。
- **iOS Safariはfinal結果(isFinal)を返さないまま認識終了することが多い**。
  `interimResults=true`にしてinterimをバッファし、**onendで確定して届ける**
  (onresultでは届けない)。破棄するインスタンスには`_discard`を立てて
  onendでの誤配信を防ぐ。読み上げ停止直後のマイク開始も失敗しやすいので
  start前に150ms待つ。
- TTS中はSTTを止める(自声拾い防止)。音声で発言した場合のみ、相手の
  読み上げ完了後にマイクを自動再開。SafariのTTS onend不発対策に
  保険タイマー(1500+len*220ms、上限30s)。
- 日本語ボイスは `voiceschanged` で選択、VOICE_PREF.genderRegexで男性寄り。
- textareaのEnter送信は `e.isComposing` を除外(日本語IME)。
- `100dvh` + `env(safe-area-inset-bottom)`、タップターゲット44px以上。
- 読み上げOFF時もセッション終了イベント(end)を取りこぼさない
  (main.js playerSaid内の `if (res.end && !Voice.ttsOn)` 参照)。

## 検証手順

1. エンジン単体(node、ブラウザ不要):
   `node -e "$(cat sales-dojo/js/config.js sales-dojo/js/scenes.js sales-dojo/js/dialog.js) ..."`
   で全シーン×全モードのループ完走・walkout発生・テーマ別スコアの大小関係
   (下手な入力 < 上手な入力)を確認する。
2. E2E: `python3 -m http.server 8093` でリポジトリ直下を配信し、
   playwright-core + `/opt/pw-browsers/chromium-*/chrome-linux/chrome` で
   `addInitScript` によりSTT非対応を模擬 → テキストフォールバックで
   選択→ロープレ→結果画面まで通す。console/pageerrorがないこと。

## 拡張のしかた

- 商材変更: config.js の PRODUCT/JARGON/VALUE_CATEGORIES と scenes.js の台本を書き換え。
- シーン追加: scenes.js の SCENES に beats(cat付き)+opener/closer(A/B/C別)を追加するだけ。
- 顧客役追加(部長等): sales-dojo/ をフォルダごと複製し、config.js/scenes.jsを書き換える(共有化しない方針)。
