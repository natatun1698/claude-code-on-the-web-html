#!/usr/bin/env python3
"""Extract OCR line data from directory spread scans.

Per spread image:
  1. trim dark photo edges; split at gutter (shadow band for photos, whitest for scans)
  2. deskew each half; cut into 4 column-pair strips (grid snapped to white gaps)
  3. pass A: tesseract jpn+eng TSV on full strip (system entries)
  4. pass B: tesseract jpn TSV on name sub-column, 3x upscale (hospital names)
  5. OCR footer to get printed magazine page number
Saves JSON per spread: strips with lines from both passes + page numbers.
"""
import os, re, sys, json, subprocess, tempfile
import numpy as np
from PIL import Image

MAKER_RE = re.compile(r'^[フキシG島ジで了ンy7YGgCóōOJIＧ]{1,2}\s*[・.。°oO*+•‥:、"\'`]')


def trim_edges(arr, dark=90):
    colmean = arr.mean(axis=0)
    rowmean = arr.mean(axis=1)
    xs = np.where(colmean > dark)[0]
    ys = np.where(rowmean > dark)[0]
    return xs[0], ys[0], xs[-1], ys[-1]


def split_gutter(img):
    arr = np.asarray(img)
    x0, y0, x1, y1 = trim_edges(arr)
    arr2 = arr[y0:y1 + 1, x0:x1 + 1]
    w2 = arr2.shape[1]
    a, b = int(w2 * 0.40), int(w2 * 0.60)
    k = 101
    bright = np.convolve(arr2.mean(axis=0), np.ones(k) / k, mode='same')
    if bright[a:b].min() < 150:
        gx = a + int(np.argmin(bright[a:b]))
    else:
        ink = np.convolve((arr2 < 128).mean(axis=0), np.ones(k) / k, mode='same')
        gx = a + int(np.argmin(ink[a:b]))
    return img.crop((x0, y0, x0 + gx - 8, y1)), img.crop((x0 + gx + 8, y0, x1, y1))


def deskew(img, max_deg=1.5, steps=13):
    small = img.resize((img.width // 4, img.height // 4))
    best, best_a = -1, 0.0
    for a in np.linspace(-max_deg, max_deg, steps):
        r = small.rotate(a, expand=False, fillcolor=255)
        v = np.var(np.asarray(r).mean(axis=1))
        if v > best:
            best, best_a = v, a
    return img.rotate(best_a, expand=False, fillcolor=255) if abs(best_a) > 0.05 else img


def content_bbox(arr, thresh=128, min_frac=0.004, max_frac=0.45):
    inkc = (arr < thresh).mean(axis=0)
    inkr = (arr < thresh).mean(axis=1)
    xs = np.where((inkc > min_frac) & (inkc < max_frac))[0]
    ys = np.where((inkr > min_frac) & (inkr < 0.6))[0]
    if len(ys) == 0 or len(xs) == 0:
        return None
    return xs[0], ys[0], xs[-1], ys[-1]


def cut_strips(img, ncols=4, pad=14, snap_frac=0.07):
    arr = np.asarray(img)
    bb = content_bbox(arr)
    if bb is None:
        return []
    x0, y0, x1, y1 = bb
    w = x1 - x0
    band = arr[y0 + (y1 - y0) // 4: y1 + 1, :]
    sm = np.convolve((band < 128).mean(axis=0), np.ones(9) / 9, mode='same')
    cuts = [x0]
    for i in range(1, ncols):
        exp = x0 + int(w * i / ncols)
        win = int(w * snap_frac)
        a, b = max(x0, exp - win), min(x1, exp + win)
        cuts.append(a + int(np.argmin(sm[a:b])))
    cuts.append(x1)
    return [img.crop((max(0, cuts[i] - pad), max(0, y0 - 10),
                      min(img.width, cuts[i + 1] + pad), min(img.height, y1 + 10)))
            for i in range(ncols)]


def run_tesseract(img, lang, psm, scale):
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.LANCZOS)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f:
        img.save(f.name)
        path = f.name
    try:
        out = subprocess.run(['tesseract', path, 'stdout', '-l', lang, '--psm', str(psm), 'tsv'],
                             capture_output=True, text=True, timeout=900).stdout
    finally:
        os.unlink(path)
    lines = {}
    for row in out.splitlines()[1:]:
        c = row.split('\t')
        if len(c) < 12 or c[0] != '5' or not c[11].strip():
            continue
        # drop edge artifacts
        if c[11].strip() in '|!lI[]united' and int(c[8]) < 15 * scale:
            continue
        key = (c[2], c[3], c[4])
        lines.setdefault(key, []).append({
            'x': int(c[6]) // scale, 'y': int(c[7]) // scale,
            'w': int(c[8]) // scale, 'h': int(c[9]) // scale,
            'conf': float(c[10]), 'text': c[11]})
    out_lines = []
    for words in lines.values():
        words.sort(key=lambda w: w['x'])
        # strip leading vertical-bar junk
        while words and re.fullmatch(r'[|｜!lI\[\]〔【]', words[0]['text']):
            words.pop(0)
        if not words:
            continue
        out_lines.append({'x': words[0]['x'],
                          'y': int(np.median([w['y'] for w in words])),
                          'h': int(np.median([w['h'] for w in words])),
                          'text': ' '.join(w['text'] for w in words)})
    out_lines.sort(key=lambda l: l['y'])
    return out_lines


def footer_pageno(half):
    crop = half.crop((0, int(half.height * 0.93), half.width, half.height))
    lines = run_tesseract(crop, 'eng', 6, 2)
    for l in lines:
        m = re.search(r'[(（]\s*(\d{2,3})\s*[)）]', l['text'])
        if m:
            return int(m.group(1))
    return None


def process_spread(path, outdir, base, scale_a=2, scale_b=3):
    os.makedirs(outdir, exist_ok=True)
    img = Image.open(path).convert('L')
    halves = split_gutter(img)
    result = []
    for side, half in zip(('L', 'R'), halves):
        half = deskew(half)
        pageno = footer_pageno(half)
        strips = cut_strips(half)
        for i, strip in enumerate(strips):
            fn = os.path.join(outdir, f'{base}_{side}_c{i}.png')
            strip.save(fn)
            lines_a = run_tesseract(strip, 'jpn+eng', 6, scale_a)
            # locate maker-prefix x cluster to find name/system boundary
            mx = [l['x'] for l in lines_a if MAKER_RE.match(l['text'].replace(' ', ''))]
            sx = int(np.median(mx)) if len(mx) >= 3 else int(strip.width * 0.38)
            name_crop = strip.crop((0, 0, max(60, sx - 8), strip.height))
            lines_b = run_tesseract(name_crop, 'jpn', 6, scale_b)
            result.append({'page': base, 'side': side, 'strip': i, 'img': fn,
                           'pageno': pageno, 'width': strip.width, 'sx': sx,
                           'sys_lines': lines_a, 'name_lines': lines_b})
    return result


if __name__ == '__main__':
    src, outdir, base = sys.argv[1], sys.argv[2], sys.argv[3]
    res = process_spread(src, outdir, base)
    with open(os.path.join(outdir, f'{base}.json'), 'w') as f:
        json.dump(res, f, ensure_ascii=False)
    print(base, 'pagenos:', sorted({r['pageno'] for r in res}),
          'lines:', sum(len(r['sys_lines']) for r in res))
