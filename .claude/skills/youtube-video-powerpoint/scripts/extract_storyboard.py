#!/usr/bin/env python3
"""yt-dlpのストーリーボード(sb.mhtml)からタイル画像をタイムスタンプ付きで切り出す。

使い方:
    yt-dlp -f sb0 -o "sb.%(ext)s" "<URL>"
    python3 extract_storyboard.py sb.mhtml <動画長秒> [開始秒] [終了秒] [出力dir]

出力: <出力dir>/t<秒4桁>.jpg (160x90) と、拡大版 <出力dir>_up/t<秒4桁>.png (640x360)
"""
import io
import os
import re
import sys

from PIL import Image

TILE_W, TILE_H = 160, 90


def main():
    mhtml = sys.argv[1]
    total_dur = float(sys.argv[2])
    start = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    end = float(sys.argv[4]) if len(sys.argv) > 4 else total_dur
    outdir = sys.argv[5] if len(sys.argv) > 5 else "sb_frames"

    data = open(mhtml, "rb").read()
    m = re.search(rb'boundary="([^"]+)"', data)
    if not m:
        sys.exit("boundaryが見つかりません")
    parts = data.split(b"--" + m.group(1))

    tiles = []
    for p in parts:
        j = p.find(b"\xff\xd8\xff")
        if j < 0:
            continue
        img = Image.open(io.BytesIO(p[j:p.rfind(b"\xff\xd9") + 2]))
        cols, rows = img.width // TILE_W, img.height // TILE_H
        for r in range(rows):
            for c in range(cols):
                tiles.append(img.crop((c * TILE_W, r * TILE_H, (c + 1) * TILE_W, (r + 1) * TILE_H)))

    if not tiles:
        sys.exit("タイルが見つかりません")
    sec_per = total_dur / len(tiles)
    print(f"tiles={len(tiles)} interval={sec_per:.2f}s")

    os.makedirs(outdir, exist_ok=True)
    os.makedirs(outdir + "_up", exist_ok=True)
    n = 0
    for i, tile in enumerate(tiles):
        t = i * sec_per
        if start <= t <= end:
            tile.save(f"{outdir}/t{int(t):04d}.jpg", quality=92)
            tile.resize((640, 360), Image.LANCZOS).save(f"{outdir}_up/t{int(t):04d}.png")
            n += 1
    print(f"saved {n} tiles to {outdir}/ and {outdir}_up/")


if __name__ == "__main__":
    main()
