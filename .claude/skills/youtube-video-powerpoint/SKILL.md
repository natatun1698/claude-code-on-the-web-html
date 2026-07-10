---
name: youtube-video-powerpoint
description: >
  YouTube動画(全体または指定区間)からスクリーンショット多めのPowerPoint(.pptx)を生成する。
  「この動画の最後のN分をパワポにして」「YouTubeの◯◯をスライドで要約して」等の依頼で使用。
  動画ダウンロード → フレーム抽出 → python-pptxでのデッキ生成までのパイプラインと、
  ダウンロードがブロックされる環境(データセンターIP)向けのフォールバックを含む。
---

# YouTube動画 → スクリーンショット付きPowerPoint 生成

## 目的

YouTube動画の指定区間を、実際の映像フレーム(スクリーンショット)を多用した
PowerPointダイジェストに変換する。各画像には `https://youtu.be/<ID>?t=<秒>s` 形式の
タイムスタンプリンクを付け、クリックで該当シーンに飛べるようにする。

## 前提セットアップ

```bash
pip install yt-dlp yt-dlp-ejs bgutil-ytdlp-pot-provider python-pptx pillow imageio-ffmpeg
# ffmpeg が無い環境では imageio-ffmpeg のバイナリを使う
ln -sf "$(python3 -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')" /usr/local/bin/ffmpeg
```

重要な環境ノウハウ(Claude Code on the Web のリモート環境で検証済み):

1. **yt-dlpにはNode 22以上を明示指定する。** PATH上の古いnode(v20)を拾うと
   `JS runtimes: node-20.x (unsupported)` となり、n-sigチャレンジが解けず403になる。
   `--js-runtimes node:/opt/node22/bin/node` のようにフルパスで渡す。
2. **POトークンプロバイダー(bgutil)を用意する。** データセンターIPではGVS POトークンが
   ほぼ必須。
   ```bash
   git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider /root/bgutil-ytdlp-pot-provider
   cd /root/bgutil-ytdlp-pot-provider/server && npm install && npx tsc
   node build/main.js &   # HTTPプロバイダー(127.0.0.1:4416)
   ```
3. **PDF/PNGでの見た目検証にはlibreoffice-impressが必要。**
   `apt-get install -y libreoffice-impress poppler-utils` →
   `soffice --headless --convert-to pdf --outdir /tmp/check deck.pptx`
   (impressが無いと「source file could not be loaded」になる)
4. **Playwright/Chromiumをこのプロキシ環境で使う場合**は
   `--ssl-version-max=tls1.2` を付ける(MITMプロキシがChromiumのTLS1.3
   ClientHelloを処理できずERR_CONNECTION_RESETになる)。proxyは
   `proxy: { server: process.env.HTTPS_PROXY }` で明示する。

## 手順

### 1. メタデータ確認

```bash
yt-dlp --js-runtimes node:/opt/node22/bin/node \
  --print "%(title)s | duration=%(duration)s | %(uploader)s" "<URL>"
```

区間指定(例: 最後の17分)は `duration - 17*60` から `duration` まで。

### 2. 動画ダウンロード(プランA)

```bash
yt-dlp --js-runtimes node:/opt/node22/bin/node \
  -f "bv*[height<=720]/b[height<=720]" -o full.mp4 \
  --write-auto-subs --sub-langs "ja,ja-orig,en" "<URL>"
```

- 403が出る場合はクライアントを変えて試す:
  `--extractor-args "youtube:player_client=android_vr"` / `tv_simply` / `web`(+bgutil)。
- 部分ダウンロード(`--download-sections`)はffmpeg経由のTLSがプロキシと相性が悪く
  失敗することがある。全体を落としてローカルで切り出す方が確実。

### 3. フレーム抽出(プランA成功時)

```bash
# 区間を切り出し、10秒ごと+シーンチェンジでフレーム抽出
ffmpeg -ss <開始秒> -i full.mp4 -t <長さ秒> -vf "fps=1/10" -q:v 2 frames/t%04d.jpg
# シーンチェンジ検出を併用する場合
ffmpeg -ss <開始秒> -i full.mp4 -t <長さ秒> \
  -vf "select='gt(scene,0.3)',showinfo" -vsync vfr scenes/s%04d.jpg
```

### 4. ストーリーボード・フォールバック(プランB)

動画本体が全クライアントで403/ボット判定になる環境
(エグレスIPが接続ごとにローテーションし、IPバインドされたgooglevideo URLが常に不一致になる等)では、
**ストーリーボード(シークプレビュー画像)** を使う。これは i.ytimg.com 配信で
POトークン/IPバインドの対象外のため、ほぼ確実に取得できる。

```bash
yt-dlp --js-runtimes node:/opt/node22/bin/node -f sb0 -o "sb.%(ext)s" "<URL>"
```

- `sb.mhtml` はマルチパートMIME。boundary(Content-Typeヘッダーに記載)で分割し、
  各パートのJPEG(通常5x5グリッド、タイル160x90)を切り出す。
  補助スクリプト: `scripts/extract_storyboard.py`
- タイル間隔 ≒ `動画長 / 総タイル数`(約10秒)。タイムスタンプはこれで割り当てる。
- 160x90は文字が読めないため、PPTX側に必ず注記を入れ、
  各画像にYouTubeタイムスタンプリンクを付けて原寸確認への導線を作る。
- PILのLANCZOSで640x360程度に拡大してから貼ると見栄えがよい。

### 5. PPTX生成

`scripts/build_pptx.py` が実例(そのまま流用可)。設計ポイント:

- 16:9 (13.333 x 7.5 in)、ダークネイビー背景 + 白文字 + 水色アクセント。
- 構成: 表紙 → この資料について(手法・制約の注記) → タイムライン →
  セクション別スライド(3x2グリッド、画像6枚/枚) → 付録(全フレーム7列グリッド)。
- 各画像の下に `mm:ss + 短いキャプション` を置き、
  `run.hyperlink.address = f"{VIDEO_URL}?t={秒}s"` でリンクにする。
- デフォルトテーマのハイパーリンク色(濃青)は暗背景で読めないので、
  保存後にzipを開いて `theme1.xml` の `<a:hlink>/<a:folHlink>` の色を書き換える。
- 日本語フォントは "Yu Gothic UI" を指定。
- キャプションは**フレームから実際に読み取れた内容だけ**を書く。読み取れない場合は
  「トーク」「資料の確認」など安全な表現にとどめ、推定は「この資料について」で明示する。

### 6. 検証

LibreOfficeでPDF化して主要ページを目視確認する(タイトルの折返し重なり、
画像サイズ、リンク色)。問題があれば修正して再生成。

## 内容(トーク内容)の補完

- 字幕があれば `--write-auto-subs --sub-langs ja` で取得して要約に使う。
- 字幕が無い/取れない場合は、イベントレポート記事等をWeb検索して裏取りし、
  フレームの見出しと突き合わせる。確証のない内容は書かない。
