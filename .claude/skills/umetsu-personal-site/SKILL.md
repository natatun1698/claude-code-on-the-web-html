---
name: umetsu-personal-site
description: 梅津希裕 公式パーソナルサイト(umetsu.html)と紹介動画(umetsu-intro.mp4)を更新・再生成する。「公式サイト更新」「プロフィール追加」「紹介動画を作り直す」などの依頼で使用する。単一HTMLの縦スクロール構成サイトと、スクリーンショット＋合成BGMによる約1分の動画パイプラインを扱う。
---

# 梅津希裕 公式パーソナルサイト

単一HTMLファイル `umetsu.html`（リポジトリ直下）と、BGM付き紹介動画 `umetsu-intro.mp4` を管理する。

## サイトの芯（変更時も必ず守る）

コンテンツは「一人の人間の物語」として、次の4軸を全セクションで反復する：

1. **学び直す人** — 文系選択で数学を捨てた → 2026年、三角比からE資格再挑戦
2. **越境する人** — 上海駐在・中国15省・転勤族10地域と山形の両根
3. **言葉を残す人** — 高祖父=日本製乳創業者（社史寄稿）、曾祖父=和田健男（「和田の湖」論文）
4. **日常を大切にする人** — PTA・送迎・ルンバ10年・階段・7時間睡眠・1万歩

各セクション末尾の `.bridge` 要素が次セクションへの繋ぎ文。セクションを追加・変更したら、前後の bridge が4軸のどれかを回収しているか確認する。

## 構成・実装

- 1ファイル完結（CSS/JSインライン）。開けばそのまま閲覧可。外部依存はGoogle Fonts（Shippori Mincho / Zen Kaku Gothic New。オフラインでもシステムフォントにフォールバック）
- セクションは `<section id="…" data-title="…">`。ヘッダーnavと右側ドットnavは `data-title` から自動生成される（JS）
- 演出：`.rv`(+`.d1〜.d3`)=IntersectionObserverフェードイン、`.cnt[data-n]`=カウントアップ、`.fill[data-w]`=プログレスバー、`.stats`=数値バンド、`.timeline`=年表
- 配色トークンは `:root` の CSS変数（--sumi 墨 / --ai 藍 / --kin 金茶 / --grad テックグラデ）。和モダン×テクノロジーの基調を崩さない。原色・ネオンは使わない
- 年号をカウントアップ表示するときは `.cnt` に `data-plain="1"` を付ける（付けないと `toLocaleString` でカンマ区切りになり「2,026年」のような誤表記になる）。歩数など桁区切りが自然な数値には付けない
- SNSアイコン（`.sns-icons`）は実URLを直書き。プレースホルダー（`href="#"`）に戻さない

## 動画の再生成（media/ 配下）

1. **フォント準備（コンテナ初回のみ）**: Google FontsのTTFを取得し `/usr/local/share/fonts` に配置して `fc-cache -f`。Shippori Minchoはウェイト別ファミリー名になっているため、fonttoolsで nameID 1/4/16 を "Shippori Mincho" に統一してから配置する（さもないとChromiumで明朝が出ない）
2. **撮影**: `node media/shoot.mjs` — Playwright（グローバル導入済み、実行バイナリ `/opt/pw-browsers/chromium`）で各セクションを 1920×1080 相当で `media/shots/` に撮影
3. **BGM**: `python3 media/bgm.py` — Cメジャー・ペンタトニックの明るく弾む曲調（BPM122、スウィング、シェイカー＋ベース＋メロディ）を純Pythonで64秒合成 → `media/bgm.wav`。曲調を変えたいときは `PENTA`/`CHORD`（音階・コード）と `BPM`/`SWING`（テンポ・跳ね感）を調整する
4. **合成**: `FFMPEG=<フルビルドffmpeg> bash media/build-video.sh` — Ken Burns（zoompan）＋クロスフェードで約64秒の `umetsu-intro.mp4` を出力。Playwright同梱のffmpegはlibx264非対応なので、`pip install imageio-ffmpeg` のバイナリ（`python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"`）を使う

セクションを増減したら `media/shoot.mjs` の `ids` 配列と `media/build-video.sh` の `SHOTS` 配列、スライド秒数 `D`（合計≈60秒になるよう調整）を揃える。

## 文体

誠実・知的・前向き。自虐（EQ低め等）は「in progress＝成長中」としてユーモアで包む。各セクション冒頭に1〜2文の導入コピー（`.lead`）を置き、箇条書きだけで終わらせない。
