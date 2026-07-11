#!/usr/bin/env bash
# 無音の動画(mp4/webm)にBGMを重ねて1本のmp4に書き出す。
# 動画尺よりBGMが長い場合は動画尺で打ち切り、短い場合は動画尺に合わせて無音を足す。
#
# Usage: mux_bgm.sh <input_video> <bgm_wav> <out.mp4> [bgm_volume_db]
#   bgm_volume_db : BGMの最終音量調整(dB)。省略時 0。ナレーションを足す予定がある場合は
#                   -6 程度に下げておくと後で声を乗せやすい
set -euo pipefail
IN_VIDEO="${1:?input video path required}"
BGM="${2:?bgm wav path required}"
OUT="${3:?output mp4 path required}"
VOL_DB="${4:-0}"

ffmpeg -y -v error \
  -i "${IN_VIDEO}" \
  -i "${BGM}" \
  -filter_complex "[1:a]volume=${VOL_DB}dB[a]" \
  -map 0:v:0 -map "[a]" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
  -c:a aac -b:a 192k \
  -shortest -movflags +faststart \
  "${OUT}"

echo "muxed: ${OUT}"
