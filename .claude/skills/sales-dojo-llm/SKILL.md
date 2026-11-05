---
name: sales-dojo-llm
description: 医療機器営業向け音声ロープレ練習アプリ「商談ロープレ道場」(/sales-dojo/)を、台本・正規表現によるルールベース(決定論)から、Claude APIで事務長役が毎回違う反応をする非決定論的ロールプレイングへ発展させる。利用者が自分のAPIキーをブラウザに保存して使い(BYOK)、キー未設定・通信失敗時は既存のルールベース(sales-dojo スキル)に自動で戻る。「ロープレ道場をAI化」「事務長の反応をLLMに」「毎回違う商談にしたい」「APIキーで動くロープレ」などの依頼で使用する。既存の決定論版の仕様・落とし穴は sales-dojo スキルを併読すること。
---

# 商談ロープレ道場 LLM版(sales-dojo-llm)

`/sales-dojo/` の事務長役を、**台本と正規表現で決まる応答(決定論)**から、
**Claude APIが文脈を読んで毎回違う応答を返す(非決定論)**ロールプレイングへ
発展させるためのスキル。既存の `sales-dojo` スキル(ルールベース版)は
そのまま残し、本スキルはその**上に重ねる**層として設計する。

> 先に `.claude/skills/sales-dojo/SKILL.md` を読むこと。画面フロー・音声
> (STT/TTS)の落とし穴・採点テーマ・称号・localStorage記録はすべてそのまま使う。
> 本スキルが変えるのは「事務長のセリフの生成方法」と「採点の根拠」だけ。

## なぜルールベースでは足りないか(課題の整理)

| ルールベース版の挙動 | 練習として困る点 |
|---|---|
| beat配列を順に出す(質問の順番が固定) | 2回目以降は展開を暗記してしまう |
| 専門用語は JARGON 正規表現に一致したときだけ聞き返す | 配列にない用語はスルー。言い換えの質も見ない |
| 値引きの検出が DISCOUNT_RE 一発 | 「ご予算に合わせて調整」のような婉曲表現を拾えない |
| 回答は QA_BANK のモード別定型文 | プレイヤーの発言内容を踏まえた返しにならない |
| 遮り判定が文字数のみ | 短くても要領を得ない発言を見抜けない |

LLM版は上の全てを「事務長の人格・状況・隠し情報・評価テーマ」を与えた
システムプロンプトと会話履歴で置き換える。**ただしルールベースは消さない**。
APIキーがない人・通信できない環境でも今まで通り練習できることが絶対条件。

## 絶対条件(sales-dojo から引き継ぐもの + 追加)

- 完全クライアントサイドの静的Webアプリ。**サーバーは置かない**。
  APIは利用者が自分のキーをブラウザに入れて直接呼ぶ(BYOK)。
- **APIキーは localStorage に保存**(キー `salesDojoApiKey`)。リポジトリ・
  HTML・JSに**絶対に書き込まない**。入力欄は `type="password"`、
  「このブラウザにだけ保存されます。送信先は api.anthropic.com のみ」と明記。
- LLM不可(キー未設定 / fetch失敗 / 401・429・5xx / 応答JSONが壊れている / タイムアウト)
  のときは**その発言から**ルールベース `CustomerAI` にフォールバックし、
  会話を止めない。チャット欄に小さく「(定型モードで応答)」と出す。
- iPhone Safari / Windows Chrome・Edge 対応、音声は従来どおり。
  LLM応答の待ち時間中はマイクを止め、「事務長が考えています…」を表示する。
- 既存の `sales-dojo/js/dialog.js`(ルールベース)は**書き換えない**。
  LLM版は新ファイルを追加し、`main.js` の分岐だけで切り替える。

## ディレクトリ構成(追加ファイルのみ)

```
sales-dojo/
  js/llm.js          LlmCustomerAI クラス + callClaude()。ブラウザfetch直叩き
  js/persona.js      事務長の人格・状況・隠し情報・モード別の振る舞い指示(文字列)
  (既存) index.html  設定画面(APIキー入力)と「AIモード」トグルを追加
  (既存) main.js     App.useLlm に応じて CustomerAI / LlmCustomerAI を生成
```

読み込み順: config.js → scenes.js → dialog.js → **persona.js → llm.js** → voice.js → main.js。
`persona.js` は config.js の PRODUCT / MODES / THEMES / SCENES を参照して
プロンプト文字列を**組み立てる関数**だけを持ち、商材固有文言を二重管理しない。

## Claude API の呼び方(ブラウザ直接・SDKなし)

リポジトリはビルド工程のない素のJSなので、SDKは使わず `fetch` で
`POST https://api.anthropic.com/v1/messages` を叩く。必須ヘッダー:

```js
headers: {
  "content-type": "application/json",
  "x-api-key": apiKey,
  "anthropic-version": "2026-10-21",
  "anthropic-dangerous-direct-browser-access": "true", // ブラウザ直叩きの明示オプトイン
  "anthropic-beta": "server-side-fallback-2026-07-01", // 安全分類器で拒否された時の自動代替
}
```

リクエスト本文の要点:

```js
{
  model: "claude-opus-5-5",          // 既定。設定画面で sonnet(claude-sonnet-5-5)/haiku(claude-haiku-5-5)に変更可
  max_tokens: 1024,                  // 事務長の一言は短い。構造化JSONでも十分
  fallbacks: "default",              // 拒否時はカテゴリ別に自動で別モデルへ
  output_config: {
    effort: "low",                   // 会話のテンポ優先。採点時だけ "medium"
    format: { type: "json_schema", schema: REPLY_SCHEMA },   // 構造化出力(下記)
  },
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
  messages: history,                 // user/assistant交互。assistantはJSON文字列をそのまま保持
}
```

- `thinking` は**送らない**(Opus 5.5は常時アダプティブ。`disabled` や
  `budget_tokens` は400になる)。`temperature` 等のサンプリング引数も送らない(400)。
- `tool_choice` の強制(`any`/`tool`)は使わない。JSONが欲しいだけなので
  **structured outputs(`output_config.format`)**で受ける。
- 応答は `stop_reason` を先に見る。`"refusal"` なら fallbacks が効かなかった
  ケースなのでルールベースへフォールバック。`content` の `text` ブロックを
  `JSON.parse` し、スキーマ外なら同じくフォールバック。
- システムプロンプトは会話中に変えない(プロンプトキャッシュの前方一致を壊さない)。
  ターン途中で追加したい指示(残り1分、テーマ2の値引き圧注入など)は
  `messages` 末尾に `{role:"user", content:"[進行指示] …"}` ではなく
  **`{role:"system", content:"…"}` をメッセージ配列に追記**する
  (Opus 5.5 / Sonnet 5.5 / Haiku 5.5 で利用可。user直後に置き、最後尾か次のassistantの前)。
- タイムアウトは `AbortController` で 20秒。超えたらフォールバック。
- 1セッションのAPI呼び出しは「ターン数 + 採点1回」。10分のロープレでおよそ
  15〜25回。利用者に概算コストが分かるよう設定画面に一文書く。

## 事務長役の構造化応答(REPLY_SCHEMA)

事務長の「セリフ」と、採点・進行に必要な「観測」を1回の応答で返させる。
観測はルールベースの `analyze()` が返していた項目と互換にし、
既存 `scoreSession()` の決定論スコアを**そのまま**計算できるようにする。

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["say", "mood", "strike_delta", "event", "observed"],
  "properties": {
    "say": { "type": "string", "description": "事務長のセリフ。話し言葉、1〜3文、120字以内。読み上げるので記号や箇条書きは禁止" },
    "mood": { "type": "string", "enum": ["warm", "neutral", "irritated", "angry"] },
    "strike_delta": { "type": "integer", "enum": [-1, 0, 1], "description": "モードCの信頼度変化。歯切れ良い=-1、要領を得ない=+1" },
    "event": { "type": "string", "enum": ["none", "interrupt", "jargon_ask", "discount_shake", "value_ack", "walkout", "done"] },
    "observed": {
      "type": "object",
      "additionalProperties": false,
      "required": ["jargon", "has_plain", "conclusion_first", "discount_offered", "discount_refused", "value_cats", "answered_cat", "on_point"],
      "properties": {
        "jargon": { "type": "array", "items": { "type": "string" }, "description": "事務長に通じなかった専門用語(言い換えが添えられていれば含めない)" },
        "has_plain": { "type": "boolean" },
        "conclusion_first": { "type": "boolean" },
        "discount_offered": { "type": "boolean" },
        "discount_refused": { "type": "boolean" },
        "value_cats": { "type": "array", "items": { "type": "string", "enum": ["service", "safety", "quality", "usability", "extra", "record"] } },
        "answered_cat": { "type": "string", "enum": ["cost", "diff", "safety", "ops", "sched", "need", "next", "none"], "description": "直前の事務長の質問カテゴリに対し、プレイヤーの回答が実際に答えていたカテゴリ" },
        "on_point": { "type": "boolean", "description": "直前の質問の意図に正面から答えていたか" }
      }
    }
  }
}
```

`LlmCustomerAI.reply()` は `{ text: say, event, end }` を返し(`CustomerAI.reply()` と同じ形)、
内部の `this.turns` には `{ player: {text,len, ...observed を analyze() 互換の名前に写像}, cat, interrupted, jargonAsked, discountPushed, npc }`
を積む。これで `main.js` と `scoreSession()` は**どちらのAIでも無改造で動く**。

### walkout(打ち切り)の決め方
LLMに丸投げせず、**strike は JS 側で数える**(モードCで `strikes >= MODES.C.maxStrikes`)。
LLMの `event:"walkout"` は無視し、JS側が閾値到達を検知したら次の応答で
`{role:"system", content:"信頼を失ったので、この返答で商談を打ち切って退席させる"}` を
添えて最終セリフを生成させる。打ち切りの**判断**は決定論、**セリフ**は非決定論、が原則。
`done`(自然終了)も同様に、ターン数または残り時間が閾値(残り90秒 or 12ターン)で
JS側が `{role:"system", content:"次の返答で商談を締めくくる。次回の約束か見送りを一言で"}` を添える。

## システムプロンプトの組み立て(persona.js)

`buildSystemPrompt(sceneId, modeId, themeId)` が以下を**この順で**結合する。
全体は日本語。箇条書きで短く、禁止事項より「どう振る舞うか」を書く。

1. **役割と状況**: 「あなたは中規模病院の事務長・山田。医療職ではなく、
   関心は経営(費用・稼働・スタッフ負担・理事会)。相手は装置メーカーの営業。
   今日のシーンは『{scene.name}: {scene.desc}』」
2. **隠し情報(ヒアリング用)**: scenes.js の nuggets / QA_BANK から抽出した
   事実を「聞かれたら答える。聞かれるまで自分からは言わない」と添える
   (装置13年目で月1不調、予算5,000万円が理事会ライン、技師2名で残業、
   他社の方が安い提示、2か月以内発注・5か月以内稼働)。
3. **モード別の振る舞い**(MODES[modeId] から):
   - A: 最後まで聞く。わからない言葉は素直に聞き返す。相槌を入れる。
   - B: 淡々と必要事項を確認。要領を得ない説明には一度だけ「簡単に言うと？」。
   - C: 冒頭で「5分しかない」。前置きが長い・結論がない発言は途中で遮る。
     値引きを強く迫る。歯切れが悪いと苛立ちが増す(strike_delta=+1)。
4. **専門用語ルール**: 「医療・放射線の専門用語(例: {JARGON labels})や、
   それに類する聞き慣れない語が**言い換えなしで**出たら必ず聞き返す。
   同じ語を二度は聞き返さない(既に聞いた語: {askedJargon})」。
   ※ JARGON配列は「例示」として渡し、配列外の用語もLLMの判断で拾わせる。
5. **値引きルール**: 「営業が値引きを口にしたら『他社はもっと下げる』と揺さぶる。
   値引きを断って保守・安全性・画質・操作性・検査の幅・実績のいずれかで
   切り返してきたら、納得して前に進む(event: value_ack)」。
6. **テーマ別の圧**(THEMES[themeId]): t2なら価格シーン以外でも途中一度は
   値引きを持ち出す / t3なら結論のない発言に厳しく / t4なら質問の意図が
   一つに絞れる聞き方をし、ずれた回答には「聞きたいのはそこじゃなくて」。
7. **出力規則**: 「`say` は話し言葉で120字以内、読み上げるので記号・箇条書き・
   カッコ書きの説明は禁止。営業のセリフを代弁しない。自分がAIだと言わない。
   `observed` は営業の**直前の発言だけ**を評価する」。
8. **非決定論の担保**: 「同じ内容を聞かれても毎回言い回しを変える。質問の順番は
   会話の流れで決め、台本どおりに進めない。ときどき脱線(院内の事情・最近の
   出来事)を一言挟んでよい」。

モード・シーン・テーマが決まれば system は固定なので `cache_control` を置く。
**ターン途中で変わる値(残り時間・strike数・聞き返し済み用語)は system に
入れず**、`messages` 内の system メッセージで渡す(キャッシュ破壊を避ける)。

## 採点(非決定論との両立)

「選択テーマ1つだけを評価し、他には言及しない」原則は不変。構成は二段:

1. **決定論スコア**: `observed` から復元した `turns` を既存 `scoreSession()` に渡す。
   点数・達成度◎○△×・称号・通算記録は従来どおりここで確定(再現性と公平性)。
2. **LLM講評**(1回だけ、`effort:"medium"`、`max_tokens: 2048`):
   会話全体と選択テーマを渡し、次のスキーマで受ける。

```json
{ "good_quote": "実際の発言の引用(改変禁止・なければ空)",
  "improvement_point": "改善点はひとつだけ。テーマ外に触れない",
  "rewrite_example": "プレイヤーの実際の発言を、テーマに沿って言い直した例(80字以内)" }
```

結果画面では `goodQuote` / `improvement.point` / `improvement.example` を
LLM講評で**上書き**し、点数は決定論のまま。LLM講評の取得に失敗したら
従来の FEEDBACK テンプレを表示する(結果画面が空にならない)。
`good_quote` がチャットログに実在しない文字列なら捨てて従来ロジックの引用に戻す
(幻覚の引用を見せない)。

## 設定画面とモード切替(index.html / main.js)

- トップ画面に ⚙️ ボタン → `#screen-settings`:
  APIキー(password入力・保存・削除)、モデル選択(opus 5.5 既定 / sonnet 5.5 / haiku 5.5)、
  「接続テスト」ボタン(`max_tokens: 16` の最小リクエストで 200 を確認)、
  注意書き(キーはこのブラウザのみ・送信先・概算コスト・共有端末では削除を)。
- 準備画面に「🤖 AI事務長(毎回違う反応)」/「📋 定型事務長(台本)」の表示。
  キー未設定なら定型固定で、理由を一行表示。
- `App.useLlm = !!apiKey && settings.llmOn` で `startSession()` の生成先を分岐。
  `App.ai` の型が違っても `main.js` の他の箇所は触らない(同じインターフェース)。
- LLM待ち中のUI: 送信ボタン無効化・「…」バブル表示・マイク停止。
  応答到着後に従来と同じ `Voice.say()` → 音声で話していたら自動でマイク再開。

## 実装上の落とし穴(本スキル固有)

- **structured outputs でも `JSON.parse` は try/catch**。`max_tokens` 到達で
  途中切れになることがある(`stop_reason:"max_tokens"`)。その場合もフォールバック。
- **会話履歴のassistantターンは「JSON文字列そのまま」で積む**(sayだけに
  削ると次回の `observed` 判断がぶれる)。履歴は user/assistant 交互を守る。
  system メッセージ(進行指示)を途中に挟むときは user の直後に置く。
- **プレフィル(assistant末尾の書きかけ)は使わない**(400)。
- **429 はリトライしない**で即フォールバック(会話のテンポ優先)。5xx は1回だけ
  1.5秒後に再試行。
- **APIキーを console.log / エラー表示 / localStorage以外に出さない**。
  fetch 失敗時の `notice()` は「AIに接続できないため定型モードで続けます」まで。
- **TTS読み上げ文に `say` 以外を含めない**(observed等を読んでしまう事故防止)。
- ルールベース版の `pickFresh` 相当は不要だが、**LLMの `say` が直前と同一**なら
  一度だけ `{role:"system", content:"直前と同じ言い回しを避ける"}` を添えて再生成。
- iOS Safari の `fetch` は画面ロック中に失敗しやすい。失敗=フォールバックで良い。
- 採点呼び出しは `endSession()` の中で `await` せず、先に決定論の結果画面を出して
  講評だけ後から差し替える(結果が出るまで待たせない)。

## 検証手順

1. **オフライン(ルールベース)回帰**: sales-dojo スキルの node 単体テストが
   そのまま通ること(`dialog.js` 無改変の確認)。
2. **LlmCustomerAI 単体(node, fetch をモック)**:
   `globalThis.fetch` を差し替え、(a) 正常JSON (b) 壊れたJSON (c) 401 (d) 429
   (e) `stop_reason:"refusal"` (f) 20秒超 の6ケースで、(a)以外が
   `CustomerAI` の応答に切り替わり `turns` が採点可能な形で残ることを確認。
   モードCで strike を3回積んだら次の応答が `end:true` になること。
3. **E2E(playwright, STT非対応を模擬)**: `page.route("**/v1/messages", …)` で
   APIを偽装し、設定→キー保存→接続テスト→ロープレ→結果(講評差し替え)まで通す。
   console/pageerror がないこと。キー削除後は定型モードに戻ること。
4. **実キーでの手動確認(任意)**: 同じ入力を3回送って事務長のセリフが毎回
   変わること、JARGON配列にない用語(例「コリメータ」)でも聞き返すこと、
   婉曲な値引き(「ご予算に合わせて調整」)に揺さぶりが入ること。

## 拡張のしかた

- 顧客役を増やす: `persona.js` の人格ブロックと隠し情報を差し替える
  (部長なら関心を「臨床・症例数・学会」に)。採点テーマは config.js で追加。
- 難易度を増やす: MODES にDを足し、persona の振る舞い節を追加するだけ。
- ルールベース版へ戻す: 設定画面でAIモードOFF。ファイル削除は不要。
