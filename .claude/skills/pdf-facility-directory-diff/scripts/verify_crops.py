#!/usr/bin/env python3
"""Build labeled montage images of candidate-diff hospital regions for visual verification.

Each candidate: crop the 2024 record region and the 2025 record region from the
strip PNGs side by side, so a human/model can confirm whether the '+system' is
really new (i.e., absent in 2024 but present in 2025).
"""
import json, os, sys, math
from PIL import Image, ImageDraw

PAD_ABOVE = 60
LINEH = 55


def crop_record(jsondir, rec, extra_lines=0):
    img = Image.open(os.path.join(jsondir, f"{rec['page']}_{rec['side']}_c{rec['strip']}.png"))
    n_sys = max(1, len(rec.get('systems', [])))
    h = PAD_ABOVE + int(n_sys * 2.6 * LINEH) + extra_lines * LINEH
    y0 = max(0, rec['y'] - PAD_ABOVE)
    return img.crop((0, y0, img.width, min(img.height, y0 + h)))


def montage(items, out, cols=2, scale=1.0):
    """items: list of (label, PIL image or None)."""
    tiles = []
    maxw = 0
    for label, im in items:
        if im is None:
            im = Image.new('L', (700, 120), 255)
            d = ImageDraw.Draw(im)
            d.text((10, 50), '(not found)', fill=0)
        if scale != 1.0:
            im = im.resize((int(im.width * scale), int(im.height * scale)))
        tiles.append((label, im))
        maxw = max(maxw, im.width)
    rows = math.ceil(len(tiles) / cols)
    label_h = 34
    col_ws = []
    for c in range(cols):
        col_ws.append(max([tiles[r * cols + c][1].width for r in range(rows) if r * cols + c < len(tiles)] or [100]))
    row_hs = []
    for r in range(rows):
        row_hs.append(max([tiles[r * cols + c][1].height for c in range(cols) if r * cols + c < len(tiles)] or [100]) + label_h)
    W = sum(col_ws) + 20 * (cols + 1)
    H = sum(row_hs) + 10 * (rows + 1)
    canvas = Image.new('L', (W, H), 235)
    d = ImageDraw.Draw(canvas)
    y = 10
    for r in range(rows):
        x = 20
        for c in range(cols):
            i = r * cols + c
            if i < len(tiles):
                label, im = tiles[i]
                d.text((x, y), label, fill=0)
                canvas.paste(im, (x, y + label_h))
            x += col_ws[c] + 20
        y += row_hs[r] + 10
    canvas.save(out)
    return out
