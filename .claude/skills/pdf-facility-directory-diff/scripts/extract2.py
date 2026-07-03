#!/usr/bin/env python3
"""Extraction v2: band-wise curved column-pair segmentation + 2-pass OCR.

Handles page curvature (photographed books) and skew by detecting pair
boundaries per horizontal band, linking them into tracks, and masking
along row-interpolated boundary curves.
"""
import os, re, sys, json
import numpy as np
from PIL import Image
from extract import split_gutter, deskew, content_bbox, run_tesseract, MAKER_RE

BAND_H = 450


def band_boundaries(sub, dark=150):
    """Return per-band candidate boundaries: list of lists of (x, kind)
    kind: 'pair' (dense->sparse) with occupancy direction check."""
    h, w = sub.shape
    nb = max(4, h // BAND_H)
    bands = []
    for b in range(nb):
        y0, y1 = int(h * b / nb), int(h * (b + 1) / nb)
        band = sub[y0:y1]
        colink = (band < dark).mean(axis=0)
        sm = np.convolve(colink, np.ones(7) / 7, mode='same')
        # rules: thin dark columns
        rulexs = set()
        for x in np.where((band < 205).mean(axis=0) > 0.5)[0]:
            rulexs.add(x)
        cands = []
        gap = sm < 0.012
        s = None
        for x in range(w + 1):
            g = gap[x] if x < w else False
            if g and s is None:
                s = x
            elif not g and s is not None:
                if x - s >= 7:
                    lo, hi = max(0, s - 140), min(w, x + 140)
                    left = (sm[lo:s] > 0.02).mean() if s > lo else 0
                    right = (sm[x:hi] > 0.02).mean() if hi > x else 0
                    has_rule = any(rx in rulexs for rx in range((s + x) // 2 - 12, (s + x) // 2 + 12))
                    cands.append({'x': (s + x) // 2, 'left': left, 'right': right,
                                  'rule': has_rule, 'w': x - s})
                s = None
        # rules not inside detected gaps are also candidates
        rx_sorted = sorted(rulexs)
        clusters = []
        for x in rx_sorted:
            if clusters and x - clusters[-1][-1] <= 5:
                clusters[-1].append(x)
            else:
                clusters.append([x])
        for c in clusters:
            if len(c) <= 8:
                cx = int(np.mean(c))
                if not any(abs(cx - cd['x']) < 25 for cd in cands):
                    lo, hi = max(0, cx - 140), min(w, cx + 140)
                    left = (sm[lo:cx - 6] > 0.02).mean()
                    right = (sm[cx + 6:hi] > 0.02).mean()
                    cands.append({'x': cx, 'left': left, 'right': right, 'rule': True, 'w': 2})
        bands.append(sorted(cands, key=lambda c: c['x']))
    return bands, nb


def link_tracks(bands, w):
    """Link band candidates into vertical tracks."""
    tracks = []  # each: list of (band_idx, cand)
    for bi, cands in enumerate(bands):
        for c in cands:
            best, bd = None, 45
            for t in tracks:
                lb, lc = t[-1]
                if bi - lb <= 3 and abs(c['x'] - lc['x']) < bd:
                    best, bd = t, abs(c['x'] - lc['x'])
            if best is not None:
                best.append((bi, c))
            else:
                tracks.append([(bi, c)])
    out = []
    for t in tracks:
        n = len(t)
        if n < max(3, len(bands) * 0.35):
            continue
        xs = [c['x'] for _, c in t]
        left = np.mean([c['left'] for _, c in t])
        right = np.mean([c['right'] for _, c in t])
        rule = np.mean([c['rule'] for _, c in t])
        out.append({'x': int(np.median(xs)), 'n': n, 'left': left, 'right': right,
                    'rule': rule, 'pts': [(bi, c['x']) for bi, c in t]})
    out.sort(key=lambda t: t['x'])
    return out


def select_pair_cuts(tracks, w):
    """Choose 3 pair-boundary tracks (dense left, sparse right or rule)."""
    scored = []
    for t in tracks:
        if t['x'] < w * 0.08 or t['x'] > w * 0.92:
            continue
        dirscore = t['left'] - t['right']
        score = t['n'] * 2 + dirscore * 30 + t['rule'] * 25
        scored.append((score, t))
    scored.sort(key=lambda s: -s[0])
    # try to pick 3 with consistent pitch
    best = None
    from itertools import combinations
    cand = [t for _, t in scored[:8]]
    for combo in combinations(cand, 3):
        xs = sorted(t['x'] for t in combo)
        d1, d2 = xs[1] - xs[0], xs[2] - xs[1]
        if abs(d1 - d2) > max(d1, d2) * 0.18:
            continue
        pitch = (d1 + d2) / 2
        if not (w * 0.19 < pitch < w * 0.33):
            continue
        sc = sum(t['n'] * 2 + (t['left'] - t['right']) * 30 + t['rule'] * 25 for t in combo)
        if best is None or sc > best[0]:
            best = (sc, sorted(combo, key=lambda t: t['x']))
    if best:
        return best[1]
    # fallback: top 3 by score
    top3 = sorted(cand[:3], key=lambda t: t['x'])
    return top3


def cut_curved_strips(half, pad=12):
    arr = np.asarray(half)
    bb = content_bbox(arr)
    if bb is None:
        return []
    x0, y0, x1, y1 = bb
    sub = arr[y0:y1 + 1, x0:x1 + 1]
    h, w = sub.shape
    bands, nb = band_boundaries(sub)
    tracks = link_tracks(bands, w)
    cuts = select_pair_cuts(tracks, w)
    # build per-row cut curves
    curves = []
    for t in cuts:
        pts = t['pts']
        bys = [int(h * (bi + 0.5) / nb) for bi, _ in pts]
        bxs = [x for _, x in pts]
        rows = np.arange(h)
        curve = np.interp(rows, bys, bxs)
        curves.append(curve)
    # estimate outer edges: first cut - pitch, last + pitch
    pitch = int(np.mean([np.mean(curves[i + 1] - curves[i]) for i in range(len(curves) - 1)])) if len(curves) > 1 else w // 4
    left_edge = np.clip(curves[0] - pitch, 0, w - 1) if curves else np.zeros(h)
    right_edge = np.clip(curves[-1] + pitch, 0, w - 1) if curves else np.full(h, w - 1)
    allc = [left_edge] + curves + [right_edge]
    return allc, sub, (x0, y0)


def make_strips(half, pad=12):
    res = cut_curved_strips(half, pad)
    if not res:
        return []
    allc, sub, origin = res
    h, w = sub.shape
    strips = []
    for i in range(len(allc) - 1):
        a, b = allc[i], allc[i + 1]
        xa, xb = int(max(0, a.min() - pad)), int(min(w, b.max() + pad))
        canvas = sub[:, xa:xb].copy()
        rows = np.arange(h)
        for y in range(h):
            la = int(a[y]) - pad - xa
            lb = int(b[y]) + pad - xa
            if la > 0:
                canvas[y, :la] = 255
            if lb < canvas.shape[1]:
                canvas[y, lb:] = 255
        strips.append(Image.fromarray(canvas))
    return strips
