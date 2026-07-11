---
name: site-tour-video
description: 単一HTMLサイト(自己完結型ページ)をブラウザで自動操縦しながら録画し、BGM付きの短尺紹介動画(MP4)をファイルとして書き出す。「サイトの紹介動画を作って」「ホームページの動画」「サイトツアー動画」「BGM付きで」などの依頼で使用する。外部素材(音楽ファイル・ナレーション録音)には依存せず、ffmpegのみでBGMを合成生成する。
---

# サイト紹介動画の制作(BGM付き)

30秒前後の「サイトをスクロールしながら紹介する」動画を、外部リソース(音源ファイル・
API課金)に一切依存せず、Playwright(録画) + ffmpeg(BGM合成・エンコード)だけで
完結させるスキル。ナレーション音声は扱わない(必要になったら別途相談する)。

## 全体の流れ

1. **録画**: Playwrightでヘッドレスブラウザにサイトを開き、オープニング→ヒーロー→
   各セクションを滑らかにスクロール→エンディング、の流れを自動操作しながら
   `recordVideo` で無音webmを録画する
2. **エンコード**: webm→mp4に変換し、動画全体の再生速度を調整して目標尺(30秒前後)に収める
3. **BGM生成**: `scripts/generate_bgm.sh` でffmpegのsine波を和音に積み上げたアンビエントBGMを
   動画と同じ長さで合成する(著作権フリー・完全ローカル完結)
4. **合成**: `scripts/mux_bgm.sh` で無音動画とBGMを1本のmp4にまとめる
5. **検証**: `ffprobe`で映像・音声ストリームの有無と尺を確認してから納品する

## 環境準備(初回のみ確認)

- Chromium: `find /opt/pw-browsers -maxdepth 2 -type f -name chrome` で実体パスを取得する
  (バージョンディレクトリ名は環境で変わるため決め打ちしない)
- `playwright-core` がスクラッチパスに無ければ `npm i playwright-core` する
  (`playwright install` は絶対に実行しない。ブラウザは既にインストール済み)
- ffmpegは `/opt/pw-browsers/ffmpeg-*/ffmpeg-linux` に簡易版が同梱されているが、
  `-movflags` 等の主要オプションに対応していないことがある。
  `which ffmpeg` で `/usr/bin/ffmpeg` が無ければ `apt-get update && apt-get install -y ffmpeg`
  でフル版を入れる
- 日本語を録画に含める場合、`fc-list | grep -ci noto.*cjk` で0なら
  `apt-get install -y fonts-noto-cjk` を先に実行する(文字化け・縦書き崩れの原因になる)

## Step 1: 録画スクリプトを作る

`scripts/record_tour.template.js` をコピーし、対象サイトに合わせて `CONFIG` を書き換える。

- `url`: `file:///絶対パス/index.html` 等
- `openingHtml` / `endingHtml`: サイトのキャッチコピー・結びの一文をそのまま使う。
  独自のCSSに依存せず、インラインstyleで完結させる(録画用オーバーレイはページ本体の
  スタイルを汚さない別レイヤーとして`position:fixed`で重ねる)
- `tour`: 巡回するセクションのセレクタと、移動時間・停止時間(ms)。
  情報量の多いセクション(タイムライン・数値カウンター等)は停止を長めに、
  単純なセクションは短めにしてテンポを作る。**合計時間が目標尺-6秒程度**
  (オープニング+エンディングで約6秒消費する分)に収まるよう配分する
- スクロールはCSSの`scroll-behavior`に任せず、`__glide`(easeInOutCubicのrAFループ)で
  自前制御する。理由: ブラウザ標準のスムーズスクロールは速度が録画のテンポと合わせにくい

実行:
```bash
node record_tour.js
# => 標準出力に "VIDEO:/path/to/xxx.webm" が出る
```

## Step 2: mp4化 + 尺調整

```bash
ffmpeg -y -v error -ss <頭の不要部分をカットする秒数> -i input.webm \
  -vf "setpts=PTS/<速度倍率>,fps=30" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart \
  video_silent.mp4
```

`setpts=PTS/1.15` のように速度倍率を上げ下げして、目標尺(例: 30秒)に近づける。
`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video_silent.mp4`
で最終尺を必ず確認する。

## Step 3: BGM生成

```bash
DUR=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 video_silent.mp4)
scripts/generate_bgm.sh "$DUR" bgm.wav [root_hz]
```

- ルート音・完全5度・オクターブ・長9度・シマー(4オクターブ上)の5音を異なる音量で重ね、
  ゆっくりしたトレモロ/ビブラート+エコーで「和モダン×テクノロジー」向けの
  落ち着いたアンビエントパッドにする
- `root_hz` でサイトの世界観に合わせて曲調を調整できる: 98(G2, 明るめ) / 110(A2, 標準) /
  130.81(C3, 締まった印象)。派手なメロディは付けない(BGMが主張しすぎるとサイトの
  内容が入ってこない)
- 出力は動画と**寸分違わぬ長さ**にトリムされる(echoの残響で伸びる分をスクリプト内で吸収済み)

## Step 4: 合成

```bash
scripts/mux_bgm.sh video_silent.mp4 bgm.wav 完成品.mp4 [bgm_volume_db]
```

`bgm_volume_db` は最終音量調整(デフォルト0dB)。BGMが主張しすぎると感じたら `-3`〜`-6` を指定する。

## Step 5: 検証(納品前に必ず実行)

```bash
ffprobe -v error -show_entries stream=codec_type,codec_name -of default=noprint_wrappers=1 完成品.mp4
# => codec_type=video / codec_type=audio の両方が出ること
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 完成品.mp4
# => 目標尺に近いこと(±2秒程度)
ffmpeg -y -v error -ss 0 -i 完成品.mp4 -frames:v 1 check.png   # 冒頭が想定通り映っているか目視確認
```

`SendUserFile` でユーザーに渡す。ファイル名は日本語で内容が分かるものにする
(例: `〇〇サイト紹介.mp4`)。

## 注意点

- **音声=BGMのみ**。ナレーション(TTS/人声)は環境に日本語TTSエンジンが無く、
  品質を保証できないため本スキルの範囲外。依頼された場合はその旨をユーザーに伝えて
  別途方針を確認する
- BGMはffmpegのsine波合成のみで作るため、既存曲の権利問題は発生しない
- 録画中に`prefers-reduced-motion`が有効だとサイト側のフェードイン演出が発火しない
  ことがあるため、録画用ブラウザコンテキストでは指定しない(デフォルトのままでよい)
- 動画は横長(16:9, 1280x720)を既定とする。縦型(9:16, 例 720x1280)が必要な場合は
  `viewport`とサイト側のレスポンシブレイアウトが対応しているか先に確認してから録画する
