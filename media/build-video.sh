#!/bin/bash
# media/shots/*.png と media/bgm.wav から umetsu-intro.mp4 を生成する
set -e
cd "$(dirname "$0")"
FFMPEG=${FFMPEG:-/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux}
FPS=30; D=6.7; XF=1

SHOTS=(shots/s00.png shots/s01.png shots/s01b.png shots/s02.png shots/s03.png \
       shots/s04.png shots/s05.png shots/s06.png shots/s07.png shots/s08.png shots/s09.png)
n=${#SHOTS[@]}
FRAMES=$(python3 -c "print(int($D*$FPS))")

inputs=(); filters=""
for i in "${!SHOTS[@]}"; do
  inputs+=(-loop 1 -t "$D" -i "${SHOTS[$i]}")
  if (( i % 2 == 0 )); then
    zp="zoompan=z='min(1.0+0.0006*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
  else
    zp="zoompan=z='max(1.12-0.0006*on,1.0)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
  fi
  filters+="[$i:v]scale=1920:1080,${zp}:d=${FRAMES}:s=1920x1080:fps=${FPS},format=yuv420p[v$i];"
done

prev="[v0]"
for ((i=1; i<n; i++)); do
  off=$(python3 -c "print(round($i*($D-$XF),2))")
  out="[x$i]"; [ "$i" -eq $((n-1)) ] && out="[vout]"
  filters+="${prev}[v$i]xfade=transition=fade:duration=${XF}:offset=${off}${out};"
  prev="[x$i]"
done
filters="${filters%;}"

TOTAL=$(python3 -c "print(round($n*$D-($n-1)*$XF,2))")
"$FFMPEG" -y "${inputs[@]}" -i bgm.wav \
  -filter_complex "$filters" \
  -map "[vout]" -map "$n:a" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -t "$TOTAL" -movflags +faststart \
  ../umetsu-intro.mp4
echo "done: umetsu-intro.mp4 (${TOTAL}s)"
