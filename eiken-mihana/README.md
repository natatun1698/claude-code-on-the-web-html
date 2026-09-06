# 🐈 オレとえいけん準2級(弥花ちゃんせんよう)

小学5年生の弥花さんが英検準2級を楽しく学べる学習アプリ。ラグドールの猫「オレ(au lait)」が
ずっと隣で伴走し、正解すると名前を呼んでほめてくれます。

- HTML / CSS / JavaScript のみ・ビルド不要。`index.html` をブラウザで開けば動きます。
- 外部通信なし(完全オフライン)。効果音・BGMはWeb Audio APIでその場合成しており、音声ファイルは使っていません。
- オレのイラストは画像ファイルではなく、インラインSVG＋CSSアニメーションで描いています。
- 問題・解答データは `questions.js` / `answers.js`(内容は `questions.json` / `answers.json` と同じ)に分離しています。
  `file://` で直接開いたときに `fetch()` がブラウザのセキュリティ制限でブロックされるため、
  `<script src>` で読み込めるJS形式を実際の実行用データとして採用しています。
  問題を追加・修正するときは、まず `questions.json` / `answers.json` を編集し、
  下記コマンドで `questions.js` / `answers.js` を再生成してください。

  ```bash
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

## モード
| モード | 内容 |
|---|---|
| 🔤 4たくクイズ | 空所補充の4択問題(単語・熟語・前置詞など)を1セッション10問(問題数が少ない場合は全問) |
| 💬 かいわ文 | 会話文の空所を4択で完成させる問題 |
| ✍️ えい作文 | Eメール返信・意見英作文。模範解答と自分の解答を並べて表示し、自己採点する形式 |
| 🐾 にがて問題を復習 | 4たくクイズ・かいわ文でまちがえた問題だけを出題(localStorageに保存) |

## 演出・仕様
- 正解: オレが跳ねて、名前入りの褒め言葉をランダム表示。紙吹雪と肉球スタンプが舞う。連続正解でコンボ表示。
- 不正解: 絶対に叱らず「おしい！いっしょに見てみようね」と寄り添う口調で、やさしい日本語の解説を表示。
- 5問ごとに「にぼしポイント」のごほうび演出。
- 効果音(正解/不正解/ボタンタップ/コンボ/結果画面)とBGMはすべてWeb Audio APIのオシレーターで合成。
  画面右上の「おん」「BGM」トグルで独立にON/OFFでき、設定はlocalStorageに保存。初期状態は効果音ON・BGM OFF。
  ブラウザの自動再生制限のため、AudioContextは初回タップまで起動しません。

## ⚠️ 取り扱いについて
このアプリは市販の英検準2級予想問題集の問題をもとにしています。
**弥花さん個人の家庭学習専用**です。インターネット上での公開・第三者への配布はしないでください。

## データについて
`questions.json` の解答のうち、出題範囲06〜08の(9)〜(12)(会話文2問を含む)は、
解答冊子の解説ページの写真が撮れていなかったため、文脈から論理的に判断した解答を暫定的に採用しています。
念のため解答冊子と照合してください。
