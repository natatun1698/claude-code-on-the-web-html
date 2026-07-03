#!/usr/bin/env python3
"""Extraction v4 (photographed spreads): segment the WHOLE spread into 8
column-pair strips directly (no gutter split — gutter splitting fails on
photos and slices pairs).

Pair boundaries are found as 'red' tracks: name|systems boundaries, which
always have a companion track (maker|model gap) 55-115px to their right.
Cut position = red - NAME_W (name column sits left of the red boundary).
"""
import os, sys, json
import numpy as np
from PIL import Image
from extract import deskew, content_bbox, run_tesseract, MAKER_RE
from extract2 import band_boundaries, link_tracks
from extract3 import header_bars

NAME_W = 340


def trim_photo(img, dark=95):
    arr = np.asarray(img)
    colm, rowm = arr.mean(axis=0), arr.mean(axis=1)
    xs = np.where(colm > dark)[0]
    ys = np.where(rowm > dark)[0]
    return img.crop((xs[0], ys[0], xs[-1] + 1, ys[-1] + 1))


def red_tracks(tracks):
    reds = []
    for t in tracks:
        if t['left'] - t['right'] > 0.02:
            if any(55 <= u['x'] - t['x'] <= 115 for u in tracks):
                reds.append(t)
    reds.sort(key=lambda t: t['x'])
    # dedupe close reds, keep strongest
    out = []
    for t in reds:
        if out and t['x'] - out[-1]['x'] < 300:
            if t['n'] > out[-1]['n']:
                out[-1] = t
        else:
            out.append(t)
    return out


def make_strips_spread(img, nprs=8, pad=10):
    arr = np.asarray(img)
    bb = content_bbox(arr)
    x0, y0, x1, y1 = bb
    sub = arr[y0:y1 + 1, x0:x1 + 1]
    h, w = sub.shape
    bands, nb = band_boundaries(sub)
    tracks = link_tracks(bands, w)
    reds = red_tracks(tracks)
    if len(reds) != nprs:
        print(f'WARN: {len(reds)} red tracks (expected {nprs}):', [t['x'] for t in reds])
    # red curves per row
    rows = np.arange(h)
    curves = []
    for t in reds:
        bys = [int(h * (bi + 0.5) / nb) for bi, _ in t['pts']]
        bxs = [x for _, x in t['pts']]
        curves.append(np.interp(rows, bys, bxs))
    pitch = int(np.median([np.median(curves[i + 1] - curves[i]) for i in range(len(curves) - 1)]))
    cuts = [c - NAME_W for c in curves]
    cuts.append(np.clip(cuts[-1] + pitch, 0, w - 1))
    strips = []
    for i in range(len(cuts) - 1):
        a, b = cuts[i], cuts[i + 1]
        xa, xb = int(max(0, a.min() - pad)), int(min(w, b.max() + pad))
        canvas = sub[:, xa:xb].copy()
        for y in range(h):
            la = int(a[y]) - pad - xa
            lb = int(b[y]) + pad - xa
            if la > 0:
                canvas[y, :la] = 255
            if lb < canvas.shape[1]:
                canvas[y, lb:] = 255
        strips.append(Image.fromarray(canvas))
    return strips


def process_spread(path, outdir, base, scale_a=2, scale_b=3):
    os.makedirs(outdir, exist_ok=True)
    img = Image.open(path).convert('L')
    img = deskew(trim_photo(img))
    strips = make_strips_spread(img)
    result = []
    for i, strip in enumerate(strips):
        fn = os.path.join(outdir, f'{base}_S_c{i}.png')
        strip.save(fn)
        lines_a = run_tesseract(strip, 'jpn+eng', 6, scale_a)
        mx = [l['x'] for l in lines_a if MAKER_RE.match(l['text'].replace(' ', ''))]
        sx = int(np.median(mx)) if len(mx) >= 3 else int(strip.width * 0.42)
        name_crop = strip.crop((0, 0, max(60, sx - 8), strip.height))
        lines_b = run_tesseract(name_crop, 'jpn', 6, scale_b)
        bars = header_bars(strip)
        result.append({'page': base, 'side': 'S', 'strip': i, 'img': fn,
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
