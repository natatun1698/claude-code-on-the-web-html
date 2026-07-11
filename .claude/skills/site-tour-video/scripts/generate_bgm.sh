#!/usr/bin/env bash
# サイト紹介動画用のBGMをffmpegのみで合成生成する（外部音源不要・著作権フリー）。
# 和音の積み重ね(ルート・5度・オクターブ・9度・シマー)にゆっくりしたトレモロと
# エコーをかけ、「和モダン×テクノロジー」向けの落ち着いたアンビエントパッドを作る。
#
# Usage: generate_bgm.sh <duration_sec> <out.wav> [root_hz]
#   duration_sec : 動画の尺(秒)と同じ長さを指定する
#   out.wav      : 出力先
#   root_hz      : ルート音の周波数。省略時 110(A2)。曲調を変えたいときだけ調整する
#                  参考: 98=G2(明るめ) / 110=A2(標準) / 130.81=C3(硬め/締まった印象)
set -euo pipefail
DUR="${1:?duration seconds required}"
OUT="${2:?output wav path required}"
ROOT="${3:-110}"

FIFTH=$(awk "BEGIN{print ${ROOT}*1.4983}")
OCT=$(awk "BEGIN{print ${ROOT}*2}")
NINTH=$(awk "BEGIN{print ${ROOT}*2*1.1225}")
SHIMMER=$(awk "BEGIN{print ${ROOT}*4}")
FADE_OUT_START=$(awk "BEGIN{d=${DUR}-3; print (d<0?0:d)}")

ffmpeg -y -v error \
  -f lavfi -i "sine=frequency=${ROOT}:duration=${DUR}" \
  -f lavfi -i "sine=frequency=${FIFTH}:duration=${DUR}" \
  -f lavfi -i "sine=frequency=${OCT}:duration=${DUR}" \
  -f lavfi -i "sine=frequency=${NINTH}:duration=${DUR}" \
  -f lavfi -i "sine=frequency=${SHIMMER}:duration=${DUR}" \
  -filter_complex "\
[0]volume=0.32[a];\
[1]volume=0.20[b];\
[2]volume=0.15[c];\
[3]volume=0.08[d];\
[4]volume=0.045,tremolo=f=0.15:d=0.6[e];\
[a][b][c][d][e]amix=inputs=5:normalize=0,\
vibrato=f=0.1:d=0.3,\
tremolo=f=0.1:d=0.22,\
aecho=0.7:0.6:900|1400:0.28|0.16,\
afade=t=in:st=0:d=3,\
afade=t=out:st=${FADE_OUT_START}:d=3,\
loudnorm=I=-21:TP=-2:LRA=9\
" \
  -ar 44100 -ac 2 -t "${DUR}" "${OUT}"

echo "generated: ${OUT} (${DUR}s, root=${ROOT}Hz)"
