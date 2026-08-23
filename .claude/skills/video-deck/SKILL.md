---
name: video-deck
description: 会議・講義・ウェビナーの録画動画(webm/mp4)から、スクリーンショットを多用したHTMLプレゼン資料を作る。「この動画をプレゼンにまとめて」「録画をスクショ多めの資料に」「講義の要点をスライドにして」などの依頼で使用する。ffmpegでのフレーム抽出・画面領域のクロップ・Artifact公開まで一気通貫で扱う。
---

# 録画動画 → スクショ多めのプレゼン資料

参考実装：`physical-ai-grasp/index.html`（Physical AI 2026 第6回演習の録画をまとめたもの）と
`media/physical-ai-grasp/*.jpg`。迷ったらこれを開いて構成をなぞる。

## 前提の確認（最初にやる）

```bash
ffmpeg -version || (apt-get update -qq && apt-get install -y ffmpeg)
ffprobe -v error -show_format -show_streams -of default=noprint_wrappers=1 "$VIDEO" \
  | grep -Ei "duration|width|height|codec_name"
```

- **音声の書き起こしツール（whisper等）はこの環境に無い**。内容の把握は「画面に映っている文字を読む」で行う。
  字幕焼き込み・チャット欄・文字起こしパネルが映っていれば、それが実質のトランスクリプトになる。
- 尺と解像度を先に確認する。1280×720 / 8〜10分なら 10秒間隔で50枚程度が下読みにちょうどよい。

## 手順

### 1. 下読み用フレームを等間隔で抜く

```bash
ffmpeg -v error -i "$VIDEO" -vf "fps=1/10,scale=960:-1" -q:v 4 frames/f_%03d.jpg
```

`f_NNN.jpg` の時刻は `(NNN-1)*10` 秒。Read ツールで **3枚おきに** ざっと見て全体構造をつかみ、
重要そうな区間だけ間を詰めて見る。1回のメッセージで4〜6枚まとめて Read すると速い。

### 2. 本番用スクショは「画面共有領域だけ」をクロップする

ブラウザのタブ・ブックマークバー・タスクバーが入った素のフレームは資料として使えない。
中身の領域を実測してクロップし、拡大する。1280×720 のZoom録画（ブラウザ全画面＋共有ビュー）なら
`crop=800:450:96:187` がだいたい合う。**必ず1枚出して目で確認してから**全部を流す。

```bash
shot(){ ffmpeg -v error -ss "$1" -i "$VIDEO" -frames:v 1 \
        -vf "crop=800:450:96:187,scale=1440:-1:flags=lanczos" -q:v 3 "$OUT/$2.jpg"; }
shot 425 12-results-table
```

- ファイル名は `01-...` `02-...` と資料の登場順に振る。あとで並べ替えが効く。
- 出力先は `media/<資料名>/`。1枚 60〜120KB、15枚で 1.3MB 程度に収まる。

**時刻ズレの罠**：`-ss` の高速シークは `fps=` で抜いた等間隔フレームと数秒ずれる。
狙った画面が出なければ ±2〜6秒で振って撮り直す。録画が2倍速再生されている場合、
プレイヤー表示時刻の差は動画時刻では半分になる（プレイヤー上で12秒進める＝動画では6秒）。

### 3. 撮るべきコマの選び方

- **結論の数値が映っている表・グラフ**（最優先。資料の背骨になる）
- **スライド1枚まるごと**（講師のまとめ、章の扉）
- **コードと、その実行結果**（セルと出力が同じ画面にあるコマを狙う）
- **before / after が並んだ画面**（動画比較、条件比較）
- 字幕やチャットが本文にかぶっていないコマを選ぶ。かぶっていたら数秒ずらす。

### 4. HTMLを書く

`physical-ai-grasp/index.html` の構造を踏襲する：

- 冒頭のヒーローで**結論の数値を3つ**先に出す（読み手が最初に知りたいのは答え）
- 以降は `<section class="slide">` の縦積み。各スライド ＝ 通し番号 ＋ 英語の小見出し ＋ 日本語見出し ＋
  リード文（`<b>` で要点をハイライト）＋ `<figure class="shot">`（画像＋figcaption）＋ 補足の箇条書き／表／callout
- **figcaption には必ず「この画面のどこを見るのか」を書く**。貼っただけのスクショは資料にならない
- 数値は本文だけでなく `<table>` にも起こす（画像内の数字は検索も引用もできないため）
- 最後に「明日からの手順」を番号付きリストで置く。動画の内容を行動に翻訳するのが資料の仕事
- 画像は `src="../media/<資料名>/01-....jpg"` の相対パス。CSS/JSはインライン、外部依存はGoogle Fontsのみ
- ライト/ダーク両対応：`:root` に全トークン → `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) }`
  → `:root[data-theme="dark"]` の3段構え。色は必ずトークン経由で使う

### 5. Artifactとして公開する

Artifactは単一HTMLなので相対パスの画像は表示されない。**画像をbase64で埋め込んだ版**を生成して公開する。

```python
import base64, re, pathlib
src  = pathlib.Path("physical-ai-grasp/index.html").read_text()
frag = src[src.index("<title>"):src.index("</body>")]
frag = frag.replace("</head>\n","").replace("<body>\n","")
def repl(m):
    p = pathlib.Path("media/physical-ai-grasp")/pathlib.Path(m.group(1)).name
    return 'src="data:image/jpeg;base64,%s"' % base64.b64encode(p.read_bytes()).decode()
frag = re.sub(r'src="\.\./media/[^/]+/([^"]+)"', repl, frag)
pathlib.Path("/tmp/.../deck.html").write_text(frag)
```

doctype / html / head / body タグは Artifact 側が付けるので落とす（`<title>` と `<style>` は残す）。
上限16MBに対し、JPEG 15枚なら base64 化しても 1.6MB 程度で余裕がある。

## やらないこと

- 音声の内容を推測で書かない。**画面に映っていない数値・主張は資料に入れない**
- スクショを「雰囲気」で貼らない。1枚ごとに、その枚数を使う理由（数値・比較・手順）を持たせる
- 元動画そのものをリポジトリにコミットしない（サイズ）。切り出したJPEGだけを置く
