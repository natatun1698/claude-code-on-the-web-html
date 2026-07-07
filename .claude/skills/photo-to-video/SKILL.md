---
name: photo-to-video
description: Use whenever the user uploads photos (individually or as a zip) and asks to turn them into a video — a slideshow, a "photo diary" recap, a montage of a period of effort (studying, training, a project), or similar. Japanese trigger phrases include "写真から動画を作って", "スライドショーにして", "動画にまとめて". Produces a narrated vertical or horizontal MP4 with Ken Burns pan/zoom per photo, date+caption overlays, a title/ending card, and generated ambient BGM — no external image/audio/video assets needed, everything is rendered with ffmpeg + Pillow + numpy.
---

# 写真から動画 (photo-to-video)

複数枚の写真を、ナレーション性のあるスライドショー動画にまとめるスキル。
タイトルカード → 各写真(Ken Burnsエフェクト + 日付/一言キャプション)→
エンディングカード、を xfade でクロスフェード連結し、生成BGMを乗せる。
外部のテンプレート動画・画像・音源は一切使わず、その場でレンダリングする。

## 手順

### 1. 写真を展開して内容を把握する

- zipなら scratchpad に展開する。ファイル名がURLエンコードされた日本語
  (`2026#U5e742...` のような形)になっていることがあるので、まず
  `unzip` した実ファイル名を見て、意味のある名前 (`01_2025-10.jpg` 等)
  にリネームしておくと後の作業が楽になる。
- **Read ツールで写真を1枚ずつ実際に見る。** ファイル名や更新日時だけで
  ストーリーを組み立てない — 写っている場所・物・行動から、どんな
  キャプションが合うかを判断する。撮影日時のExif等があれば
  `identify -verbose` や `exiftool` で補助的に見てもよいが、写真の中身
  そのものが一番の情報源。
- 時系列や意味のある順番に写真を並べ、動画全体で伝えたい一本のストーリー
  (今回なら「隙間時間を使って試験勉強を頑張った」)を決める。

### 2. 環境を整える

このスキルは以下に依存する。無ければ導入する(sudoで自動インストール可):

```bash
which ffmpeg || (sudo apt-get update && sudo apt-get install -y ffmpeg)
python3 -c "import PIL" || pip install pillow
python3 -c "import numpy" || pip install numpy
fc-list | grep -qi "noto.*cjk" || sudo apt-get install -y fonts-noto-cjk  # 日本語キャプション用
```

### 3. `scripts/make_video.py` をコピーしてカスタマイズする

このスキル同梱の `scripts/make_video.py` を作業用スクラッチディレクトリに
コピーし、ファイル先頭の `CONFIG` セクションだけを書き換える:

- `PHOTOS_DIR` / `WORK` / `OUTPUT` のパス
- `W, H` — 縦型SNS向けなら `1080, 1920`、横型なら `1920, 1080`
- `TITLE_LINES` / `TITLE_SUB` / `TITLE_DATE_RANGE` — タイトルカード
- `END_DATE` / `END_HEADLINE` / `END_BODY` / `END_FOOTER` — エンディングカード
- `SLIDES` — `(ファイル名, 表示日付, キャプション行のリスト, "in"|"out")` の
  タプルのリスト。`"in"`/`"out"` はKen Burnsのズーム方向で、交互に
  つけると単調にならない。
- 配色 (`BG_TOP`, `BG_BOTTOM`, `ACCENT`) はテーマに合わせて変更可
- キャプションは短く、写真ごとに1〜2行。日付+一言のトーンで、
  ストーリー全体が繋がって読めるようにする(「〜も」「〜まで」等の
  接続を使うと連続性が出る)

ロジック自体(セグメント生成・キャプションボックス描画・BGM合成・
xfade連結)は書き換えなくてよい。パラメータ調整で大抵のケースに対応できる。

### 4. 実行して検証する

```bash
python3 make_video.py
```

生成した動画は**必ず数フレーム抜き出して目視確認する**(音声や文字の
崩れ、フォント文字化け、キャプション位置のはみ出しなどはコマンドの
成功終了だけでは分からない):

```bash
ffmpeg -y -loglevel error -ss <秒> -i output.mp4 -frames:v 1 check.jpg
```

抜き出した `check.jpg` を Read ツールで見て、日本語が正しく表示されて
いるか(文字化け・豆腐がないか)、キャプションボックスが写真からはみ
出していないか、Ken Burnsで人物の顔などが不自然にクロップされていないか
を確認する。問題があれば CONFIG を直して再実行する。

### 5. 納品する

`SendUserFile` で mp4 を送る。リポジトリで作業している場合、動画ファイルは
サイズが大きくなりがちなので、リポジトリにコミットするかどうかは
ユーザーの意図(単なる成果物受け渡しか、リポジトリに残したいか)を踏まえて
判断する。

## Tips / 落とし穴

- **フォント**: 日本語キャプションにDejaVu等のデフォルトフォントを使うと
  文字化けする。必ずNoto Sans CJK / IPAゴシック等のCJKフォントを指定する。
- **xfadeのoffset計算**: 各セグメントの長さを `FADE` 分ずつ重ねて
  offsetを累積計算する必要がある(`make_video.py`の`main()`が実装済み)。
  セグメント数や長さを変えてもこの部分は自動で追従する。
- **BGM**: 外部音源を使わず、`make_bgm()` でコード進行からアルペジオを
  numpyで直接波形合成している。曲調を変えたい場合は `bpm` や `chords`
  引数、あるいはコード進行のタプルを差し替える。
- **写真の解像度**: `zoompan` フィルタは入力を一旦 `W*2, H*2` に
  スケール&クロップしてからズームするため、多少縦横比が違う写真が
  混じっていても破綻しにくい。
- **話をでっち上げない**: キャプションは写真から実際に読み取れる内容
  (場所、持ち物、行動)に基づいて書く。憶測で盛った内容を書かない。
