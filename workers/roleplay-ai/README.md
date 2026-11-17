# roleplay-ai — 営業ロープレ生成AI版の Cloudflare Worker

`/bucho-ai/` の顧客役のセリフを、Workers AI で生成する Worker です。
手番(聞き返す・揺さぶる・打ち切る)と採点はブラウザ側の既存ルールが決め、
この Worker はセリフの文面だけを作ります。

## 費用を0円に保つための決まり

- **Workers Free プランのまま使う。** Free では Workers AI の無料枠(1日10,000 Neurons)を
  超えると止まるだけで、請求は発生しない。Paid に上げると超過分が課金される。
- LLMのAPIキー(Anthropic、OpenAI など)は登録しない。Workers AI のバインディングだけを使う。
- 上限に達すると Worker は 429 を返し、アプリはその日のセッションを定型の返事で続ける。

## ファイル

| ファイル | 役割 |
|---|---|
| `worker.src.js` | Worker 本体(手で編集するのはこちら) |
| `build.cjs` | `bucho/js/data.js` と `bucho-ai/js/data-ai.js` から台詞と人物設定を取り出し、`worker.js` を生成する |
| `worker.js` | **デプロイするファイル**(生成物。直接編集しない) |
| `wrangler.toml` | wrangler でデプロイする場合の設定 |

台詞や人物設定を変えたら `node workers/roleplay-ai/build.cjs` を実行し、`worker.js` をデプロイし直す。

## デプロイ方法A: Cloudflare のダッシュボードだけで行う(手元PC不要)

1. https://dash.cloudflare.com でアカウントを作る(Free)。
2. **Workers & Pages** → **Create** → Worker を作成(Hello World のテンプレートでよい)。
   名前は `roleplay-ai`。いったん Deploy する。
3. **Edit code** を開き、中身をすべて `worker.js` の内容に置き換えて Deploy する。
   `worker.js` は GitHub 上の Raw 表示からコピーできる。
4. **Settings** → **Bindings** → **Add** → **Workers AI**。変数名は `AI`。
5. **Settings** → **Variables and Secrets** に次の3つを登録する。

   | 名前 | 種類 | 値 |
   |---|---|---|
   | `ALLOWED_ORIGINS` | Text | `https://natatun1698.github.io` |
   | `MODEL` | Text | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
   | `ACCESS_CODE` | **Secret** | 利用者に配る招待コード(自分で決める) |

6. Worker のURL(`https://roleplay-ai.<サブドメイン>.workers.dev`)を控える。
7. `bucho-ai/js/data-ai.js` の `AI_ENDPOINT` に、そのURLの末尾に `/line` を付けて入れる。

ダッシュボードの画面名は変わることがあります。見当たらない場合は、Cloudflare の公式ドキュメントで確認してください。

## デプロイ方法B: wrangler で行う

Cloudflare の API トークン(Workers の編集権限)が必要です。

```bash
cd workers/roleplay-ai && node build.cjs && npx wrangler@4 deploy
```

```bash
cd workers/roleplay-ai && npx wrangler@4 secret put ACCESS_CODE
```

## 動作の確認

- アプリの準備画面で招待コードを入れて始め、右上の表示が「🤖 AI応答」のまま返事が来れば接続できている。
- 招待コードが違うと「定型モード」になり、案内が出る。
- `?mock=ok` を付けると、Worker があっても模擬で動く(比較用)。

## Worker が受け付けるもの・拒否するもの

- `POST /line` のみ。オリジンが `ALLOWED_ORIGINS` にあり、`X-Access-Code` が `ACCESS_CODE` と一致すること。
- 受け取るのはシナリオID・シーン・モード・手番・台本番号・直近の会話(最大13発言、各300字)だけ。
  プロンプトは Worker 側で組み立てるので、汎用の無料LLMとしては使えない。
- `ACCESS_CODE` が未設定なら、すべて拒否する(誰でも使える状態にしない)。
- 会話の内容はログに出さない。

招待コードとオリジンの確認は、意図的な攻撃を完全には防げません。その場合も Free プランなら、最悪の結果は「その日の無料枠切れ」です。招待コードが広まったら、`ACCESS_CODE` を変えて配り直してください。

## テスト(ネットワーク不要)

```bash
node tests-ai/worker.test.cjs
```

```bash
node tests-ai/e2e.js
```
