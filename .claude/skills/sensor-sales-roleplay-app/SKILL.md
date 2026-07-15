---
name: sensor-sales-roleplay-app
description: センサー営業向けの音声ロールプレイング練習Webアプリ(/seimitsu-sensor/)を開発・拡張する。営業担当者(プレイヤー)と製造課長役AIが音声で対話し、付加価値営業(特徴ではなく利点・価値/潜在ニーズ質問)の単一テーマフィードバックを受けられる、ログイン不要の自己完結静的Webアプリ。「センサー営業ロープレ」「田中課長攻略」「価値提案トレーニング」などの依頼で使用する。
---

# センサー営業ロールプレイングアプリ(価値提案トレーニング)

センサー営業向けの音声ロープレ練習Webアプリを拡張するためのスキル。
医療機器営業アプリ(`.claude/skills/sales-roleplay-app/`、`jimucho/`・`bucho/`)
とは**完全に独立**しており、そちらの共有ロジック(リポジトリ直下の
`style.css`・`js/`)には**一切依存しない・変更しない**。

## リポジトリ構成(必ず守ること)

完全クライアントサイドの静的Webアプリ。サーバー・APIキー・ログイン不要。
すべてのファイルは `/seimitsu-sensor/` 配下で自己完結する。

```
seimitsu-sensor/
  index.html        画面本文(タイトル・文言はここに直書き)
  css/style.css     専用スタイル(工場/FA系配色。既存style.cssのコピーではない)
  js/
    data.js         ペルソナ・商材・台本・検出パターン・FEEDBACK文言(唯一の設定源)
    engine.js       analyzeUtterance() / RoleAI / scoreSession()(v1/v2テーマ採点)
    speech.js       SpeechIO(音声認識・合成ラッパー)
    app.js          画面遷移・タイマー・チャットUI・localStorage
  manual/           初心者向けスクショ付きマニュアル(index.html + images/ + demo動画)
```

**localStorageのキーは `sensorRoleplayStats`**。既存アプリの
`salesRoleplayStats` とは別管理で、統計は混ざらない。変更しないこと。

## data.js が提供すべきグローバル(engine.js/speech.js/app.jsが参照)

| 定義 | 内容 |
|---|---|
| `ROLE_LABEL` | 顧客役の呼称("田中課長") |
| `VOICE_PREF` | `{ genderRegex, pitch }`(男性声・pitch 0.9) |
| `PRODUCT` | 商材(画像判別センサー「VS-3000シリーズ」1ライン一式380万円〜) |
| `JARGON` | 課長が知らない専門用語(`{label, re}`。テレセントリック/HDR撮像等) |
| `PLAIN_MARKERS` / `CONCLUSION_MARKERS` | 言い換え/結論先出しの検出 |
| `DISCOUNT_RE` / `DISCOUNT_REFUSAL_RE` | 値引き言及・拒否の検出 |
| `FEATURE_RE` | 特徴(自社目線スペック)語りの検出 |
| `BENEFIT_CATEGORIES` | 利点(顧客目線の効果)カテゴリ(`{id,label,re}`: stop/defect/labor/seg/trace/skill/maint) |
| `QUANT_VALUE_RE` | 金額・時間・率への定量化表現(◯円/◯時間/◯%等) |
| `CUSTOMER_CONTEXT_RE` | 顧客固有文脈への接続(御社では/このラインでは) |
| `QUESTION_RE` / `LATENT_Q_RE` / `SURFACE_Q_RE` | 質問/潜在ニーズ質問(未来・仮定・波及)/顕在確認質問 |
| `NEXT_STEP_RE` | 次アクション提案(デモ・テスト機・日程等) |
| `MODES` | A(やさしい)/B(普通)/C(忙しくて厳しい)の3モード |
| `THEMES` | 評価テーマ2種: `v1`(特徴ではなく利点・価値を売れ)/`v2`(潜在ニーズを掘る質問) |
| `TITLES` / `titleFor()` | スコア→称号(価値提案マイスター等) |
| `SCENES` | シーン台本。hearing は `qaDriven` + `nuggets`(顕在) + `latentNuggets`(潜在質問でのみ開示) |
| `JARGON_REPLIES` / `FEATURE_PUSHBACK` / `DISCOUNT_SHAKE` / `VALUE_ACK` / `INTERRUPT_C` / `SIMPLIFY_B` / `WALKOUT_C` / `DISCOUNT_PUSH_INJECT` | モード別の定型セリフ |
| `FEEDBACK` | テーマ別FB(`v1.featureOnly/noQuant/good/discount`, `v2.noQuestion/surfaceOnly/good/discount`) |

engine.js/app.js は上記グローバルにのみ依存し、商材固有文言をハードコード
しない。文言変更は data.js だけで完結させること。

## 顧客ペルソナ(共通の型)

田中課長(48歳・自動車部品メーカー製造課長・検査工程統括)。稟議は数字に
厳しい工場長へ上げる。相見積もり(K社が2割安)をちらつかせて値引きを迫り、
スペック語りには「それってうちに何のメリット?」と切り返す。
専門用語は必ず聞き返す(同じ用語は1回だけ)。

3モード: A=やさしい / B=普通(スペック羅列・長い説明に1回だけ突っ込む) /
C=忙しくて厳しい(冒頭「10分で頼むよ」、110字超の前置きを遮る、
ストライク3回で「K社さんに決めるよ」と打ち切り=walkout)。

プレイヤー制約: 業界No.2・値引き不可。値引きを申し出たら相見積もりで
揺さぶられ、値引きを断って価値(利点カテゴリor定量化)で切り返すと
「値段だけじゃないってことね」と認めて前進する。

## 評価テーマと採点(scoreSession)

テーマは開始前に1つ選択。採点は選択テーマのみ:

- **v1 特徴ではなく利点・価値を売れ**(基礎40の加点型):
  特徴語りのみ-8/回、利点カテゴリ初出+8、定量化(QUANT_VALUE_RE)+12(3回まで、
  値引き圧直後はさらに+10)、顧客文脈接続+6(2回まで)、値引き申し出-25。
- **v2 潜在ニーズを掘る質問**(基礎30の加点型):
  潜在質問(LATENT_Q_RE)+15(3回まで)、顕在質問+4(4回まで)、
  質問なし3連続-10、値引き圧への質問返し+6、値引き申し出-25。
  ヒアリングシーンでは潜在質問でのみ `latentNuggets`(山本さん定年/
  全数トレーサビリティ要求/夜勤流出3倍)が開示される。

結果は既存アプリと同型: 達成度◎○△×、良かった実発言の引用、改善点1つ+
言い換え例(FEEDBACKテンプレ)、100点スコア+称号、walkout時-15。

## 技術要件(既存アプリと同じ)

- iPhone Safari / Windows Chrome・Edge対応。STT非対応時はテキスト入力へ自動フォールバック
- SpeechRecognitionは**startのたびに新規生成**(iOS Safari対策)、TTS中は認識停止
- TTSは`voiceschanged`で日本語男性声を選択、Safariのonend不発対策に保険タイマー
- `100dvh` + `env(safe-area-inset-bottom)`、IMEのEnter送信除外、localStorageはtry/catch

## 検証方法

- エンジン単体(ブラウザ非依存):
  `node -e "$(cat seimitsu-sensor/js/data.js seimitsu-sensor/js/engine.js) …"`
  で RoleAI/scoreSession を検証。
- `python3 -m http.server` でリポジトリ直下を配信し `/seimitsu-sensor/` を
  テキスト入力モードで各シーン×各モード1往復以上。
- Playwright(`/opt/pw-browsers/chromium`)でE2Eスモーク。
- **既存アプリ(/jimucho/・/bucho/)に副作用がないこと**(このアプリは
  共有ファイルに触れないので、直下 `style.css`・`js/`・各シナリオの
  差分ゼロを git status で確認する)。
