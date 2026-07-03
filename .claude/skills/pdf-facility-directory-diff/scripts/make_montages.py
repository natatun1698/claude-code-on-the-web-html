#!/usr/bin/env python3
"""Build verification montages: for each systems_added candidate, show the
2024 entry crop (left) and 2025 entry crop (right) with labels."""
import json, os, math, sys
from PIL import Image, ImageDraw, ImageFont

LINEH = 55
PAD_ABOVE = 55

try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', 26)
except Exception:
    FONT = None


def crop_rec(jsondir, rec, min_lines=5, extra=1.5):
    img = Image.open(os.path.join(jsondir, f"{rec['page']}_{rec['side']}_c{rec['strip']}.png"))
    n = max(1, len(rec.get('systems', [])))
    hgt = PAD_ABOVE + int(max(min_lines, n * 2.4 + extra) * LINEH)
    y0 = max(0, rec['y'] - PAD_ABOVE)
    return img.crop((0, y0, img.width, min(img.height, y0 + hgt)))


def jp_label(canvas, xy, text):
    d = ImageDraw.Draw(canvas)
    d.text(xy, text, fill=0, font=FONT)


def build_batch(cands, idxs, out, scale=0.62):
    rows = []
    for k in idxs:
        c = cands[k]
        t24 = crop_rec('ocr2024', c['h24']) if c['h24'] else None
        t25 = crop_rec('ocr2025', c['h25']) if c['h25'] else None
        added = ' / '.join(f"{s['maker'] or '?'} {s['model']}" for s in c['added'])
        flags = ','.join(sorted({f for s in c['added'] for f in s['flags']})) if c.get('added') else ''
        label = f"#{k} {c['pref']} sim={c.get('sim',0):.0f} [{flags}] +{added}"
        rows.append((label, t24, t25))
    tile_w = max([im.width for _, a, b in rows for im in (a, b) if im] or [600])
    tile_w = int(tile_w * scale)
    label_h = 40
    row_hs = []
    for _, a, b in rows:
        h = max([im.height for im in (a, b) if im] or [120])
        row_hs.append(int(h * scale) + label_h + 14)
    W = tile_w * 2 + 60
    H = sum(row_hs) + 10
    canvas = Image.new('L', (W, H), 235)
    y = 6
    for (label, a, b), rh in zip(rows, row_hs):
        jp_label(canvas, (10, y), label)
        for col, im in enumerate((a, b)):
            if im is None:
                continue
            im2 = im.resize((int(im.width * scale), int(im.height * scale)))
            canvas.paste(im2, (10 + col * (tile_w + 40), y + label_h))
        y += rh
    canvas.save(out)
    return out


if __name__ == '__main__':
    cands = [c for c in json.load(open('candidates.json')) if c['type'] == 'systems_added']
    per = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    os.makedirs('montage', exist_ok=True)
    nb = math.ceil(len(cands) / per)
    for b in range(nb):
        idxs = list(range(b * per, min((b + 1) * per, len(cands))))
        build_batch(cands, idxs, f'montage/batch{b:02d}.png')
    print('built', nb, 'batches of', per, '| total', len(cands))
