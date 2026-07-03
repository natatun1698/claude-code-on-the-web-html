#!/usr/bin/env python3
"""Extraction v3 driver: curved-pair segmentation + 2-pass OCR + header bars."""
import os, sys, json
import numpy as np
from PIL import Image
from extract import split_gutter, deskew, run_tesseract, MAKER_RE
from extract2 import make_strips


def header_bars(img):
    """Detect shaded prefecture-header bars in a strip: rows whose background
    is locally darker (halftone shading) than surrounding rows."""
    arr = np.asarray(img)
    h, w = arr.shape
    bg = np.median(arr, axis=1).astype(float)
    k = 601
    pad = k // 2
    padded = np.pad(bg, pad, mode='edge')
    base = np.array([np.median(padded[y:y + k]) for y in range(h)])
    dev = base - bg
    ink = (arr < 140).mean(axis=1)
    bars = []
    s = None
    for y in range(h + 1):
        ok = y < h and dev[y] > 16
        if ok and s is None:
            s = y
        elif not ok and s is not None:
            if 16 <= y - s <= 90 and ink[s:y].max() > 0.04:
                bars.append((s + y) // 2)
            s = None
    return bars


def process_spread(path, outdir, base, scale_a=2, scale_b=3):
    os.makedirs(outdir, exist_ok=True)
    img = Image.open(path).convert('L')
    halves = split_gutter(img)
    result = []
    for side, half in zip(('L', 'R'), halves):
        half = deskew(half)
        strips = make_strips(half)
        for i, strip in enumerate(strips):
            fn = os.path.join(outdir, f'{base}_{side}_c{i}.png')
            strip.save(fn)
            lines_a = run_tesseract(strip, 'jpn+eng', 6, scale_a)
            mx = [l['x'] for l in lines_a if MAKER_RE.match(l['text'].replace(' ', ''))]
            sx = int(np.median(mx)) if len(mx) >= 3 else int(strip.width * 0.42)
            name_crop = strip.crop((0, 0, max(60, sx - 8), strip.height))
            lines_b = run_tesseract(name_crop, 'jpn', 6, scale_b)
            bars = header_bars(strip)
            result.append({'page': base, 'side': side, 'strip': i, 'img': fn,
                           'width': strip.width, 'sx': sx, 'bars': bars,
                           'sys_lines': lines_a, 'name_lines': lines_b})
    return result


if __name__ == '__main__':
    src, outdir, base = sys.argv[1], sys.argv[2], sys.argv[3]
    res = process_spread(src, outdir, base)
    with open(os.path.join(outdir, f'{base}.json'), 'w') as f:
        json.dump(res, f, ensure_ascii=False)
    print(base, 'strips:', len(res), 'bars:', sum(len(r['bars']) for r in res),
          'lines:', sum(len(r['sys_lines']) for r in res), flush=True)
