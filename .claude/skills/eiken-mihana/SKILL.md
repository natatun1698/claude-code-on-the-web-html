---
name: eiken-mihana
description: 小学5年生・弥花さん専用の英検準2級学習アプリ(/eiken-mihana/)を開発・拡張する。ラグドール猫「オレ(au lait)」が伴走し、4択空所補充・会話文完成・Eメール返信英作文・意見英作文を出題するログイン不要の静的Webアプリ。「英検アプリ」「オレとえいけん」「英検準2級」「問題を追加」などの依頼で使用する。
---

# 英検準2級学習アプリ(eiken-mihana)

小学5年生の弥花さんが英検準2級を楽しく学べる学習アプリ。既存の
`/eiken-mihana/` を拡張する際にこのスキルを使う。

## 絶対条件

- **完全クライアントサイドの静的Webアプリ**。ビルド不要・ダブルクリックで
  `index.html` が動く。サーバー・APIキー・ログイン一切不要。
- 音声ファイルは一切使わず、効果音・BGMは**Web Audio APIで合成**する
  (単一ファイル構成を保つため)。AudioContextは初回タップまで起動しない。
- キャラクター「オレ(au lait)」はインラインSVG＋CSSアニメーションのみで
  描画する。外部画像は使わない。
- 全テキストは小学5年生が読める日本語。難しい漢字には`ruby`タグでふりがな。
- 不正解時は絶対に叱らない口調(「おしい！いっしょに見てみようね」)を守る。
- 対象は弥花さん個人。README に「家庭学習専用」の注記を残す。

## キャラクター仕様(変更しない)

- 名前は「オレ(au lait)」。画面表示は「オレ」、英語表記は `au lait`。
- ラグドール。配色: 毛(ベース)`#F6EFE6` / ポイント`#9A8579` / 目`#5D9CD6` /
  耳の内側`#E9B7BA` / 鼻`#E39AA0` / マズル`#EFE2D4`。
- 顔は単一の丸(額の色分け・マズルの別パーツ化はしない、フラットな丸顔)。
  耳は太めの三角、目は大きめ(顔全体に対してかなり大きい)、口元は高め(鼻の
  すぐ下)の位置に描く。ユーザー承認済みのデザイン(`ore-preview.html`参照)。
- 表情は5種類: つうじょう / わくわく(出題時・耳が前向き) / せいかい
  (目が`^ ^`の弧、頬にピンク、口を開けて笑う) / おしい(眉が下がる、口は
  小さな弧、耳が片方寝る) / おねむ(目を閉じ、口は小さな丸)。
- 一人称「ボク」、呼びかけは「みはなちゃん」。語尾に時々「〜だニャ」を
  混ぜるが多用しない。

## ファイル構成

```
eiken-mihana/
├── index.html         # アプリ本体(HTML/CSS/JS)。<script src>でデータを読み込む
├── questions.js       # 問題データ(questions.jsonと同内容、実行用)
├── answers.js         # 解答データ(answers.jsonと同内容、実行用)
├── questions.json      # 問題データの編集用ソース
├── answers.json        # 解答データの編集用ソース
├── ore-preview.html    # オレの5表情だけを確認するプレビューページ
└── README.md
```

### なぜ questions.json と questions.js の二重管理か

`file://` で直接開いたとき、`fetch()` によるJSON読み込みはブラウザの
CORS制限でブロックされる。`<script src>` はこの制限を受けないため、
実行時データは `questions.js`(`const QUESTIONS = [...]`)/`answers.js`
(`const ANSWERS = [...]`)として読み込む。**問題を追加・修正するときは
`questions.json`/`answers.json` を編集してから、必ず以下で再生成する**
(README.md にも同じコマンドを記載):

```bash
cd eiken-mihana
python3 -c "
import json
q = json.load(open('questions.json', encoding='utf-8'))
a = json.load(open('answers.json', encoding='utf-8'))
with open('questions.js','w',encoding='utf-8') as f:
    f.write('// 英検準2級 学習アプリ 問題データ(questions.jsonと同内容)\n')
    f.write('const QUESTIONS = ' + json.dumps(q, ensure_ascii=False, indent=2) + ';\n')
with open('answers.js','w',encoding='utf-8') as f:
    f.write('// 英検準2級 学習アプリ 解答データ(answers.jsonと同内容)\n')
    f.write('const ANSWERS = ' + json.dumps(a, ensure_ascii=False, indent=2) + ';\n')
"
```

## データスキーマ

`questions.json`(配列)の各要素:
- `id`: 一意なID(例 `V1-01`, `C2-01`, `E-01`, `O-01`)
- `unit`: 出題範囲ラベル(教材のメタ情報、表示には使わない)
- `type`: `vocab`(4択空所補充) / `conversation`(会話文完成) /
  `email`(Eメール返信英作文) / `opinion`(意見英作文)
- `vocab`/`conversation`: `sentence`(空所は`( )`で表現、会話は`A:`/`B:`を
  `\n`区切りで格納) + `choices`(4つの配列)
- `email`: `intro`(指示文) / `originalEmail`(`greeting`/`body`/`closing`/
  `signature`) / `replyTemplate`(`greeting`/`opening`/`closing`) /
  `wordCountRange`
- `opinion`: `intro` / `question` / `wordCountRange`

`answers.json`(配列、`id`で対応):
- `vocab`/`conversation`: `correct`(1〜4、1-indexed) / `explanationJa`
  (やさしい日本語の解説、難しい語には`ruby`タグ可)
- `email`/`opinion`: `modelAnswers`(`text`+`wordCount`の配列、1〜2件) /
  `explanationJa`(書き方のポイント解説)

## アプリの構造(index.html内)

- `QUESTION_MAP`/`ANSWER_MAP`: idをキーにしたインデックス
- `VOCAB_POOL`/`CONV_POOL`/`ESSAY_POOL`: typeごとのプール
- `SoundEngine`: Web Audio APIのラッパー(`click`/`correct`/`incorrect`/
  `combo`/`fanfare`/`startBgm`/`stopBgm`)。新しい効果音を足す場合はここに
  `tone(freq, start, dur, type, peak)`呼び出しを追加する
- `session`: 4択クイズ・会話文・にがて復習で共通の進行状態
  (`mode`/`ids`/`index`/`correctCount`/`wrongIds`/`combo`)
- にがて問題は `localStorage["eikenMihana_mistakes"]` に問題idの配列で保存
- 音/BGM設定は `localStorage["eikenMihana_soundOn"]` /
  `["eikenMihana_bgmOn"]` に保存(初期値: 効果音ON・BGM OFF)

## 問題を追加するときの手順

1. 出典(問題集の写真など)から`questions.json`/`answers.json`に新しい
   オブジェクトを追記する(idは種別プレフィックス+連番、他と重複しないように)。
2. 上記コマンドで`questions.js`/`answers.js`を再生成する。
3. `python3 -c "import json; ..."` などで件数・id対応(questionsとanswersの
   idが過不足なく一致するか)を検証してから使う。
4. 解答が読み取れなかった問題は、文脈から論理的に判断した旨をREADMEの
   「データについて」セクションに残す(推測であることを隠さない)。

## 動作確認

Playwright(`/opt/pw-browsers/chromium`、`NODE_PATH=/opt/node22/lib/node_modules`)
でスタート画面→各モード→結果画面まで一通り操作し、コンソールエラーが
ないことを確認してからコミットする。スクリーンショットや`test.js`などの
一時ファイルはコミット前に削除する。
