#!/usr/bin/env python3
"""Parse v4: OCR JSON -> ordered hospital records + bar events.
Prefecture assignment is a separate post-pass (assign.py) because shaded-bar
detection is unreliable on photographed pages.
"""
import json, re, sys, unicodedata
import numpy as np
from rapidfuzz import fuzz
from canon import canon_system

PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
         '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']

JUNK_RE = re.compile(
    r'新医療|\d{4}年\d+月号|社名の略号|次のとおり|機器のタイ|プレーンタイ|ブレーンタイ|'
    r'IVR-CT|シネ=シネ撮影|施設名が|掲載する予定|血管造影システム|設置施設名簿|'
    r'ヘルスケア|メディカルシステム|島津製作所$|ジャパン$|現在$')


def norm(s):
    return unicodedata.normalize('NFKC', s).replace(' ', '').replace('　', '')


def find_pref_text(text):
    t = norm(text)
    t = re.sub(r'^[^ぁ-ん一-龥A-Za-z]+', '', t)
    if not (2 <= len(t) <= 10) or re.search(r'病|院|大学|センタ|クリニック|医', t):
        return None, 0
    best, bs = None, 0
    for p in PREFS + ['新潟県']:
        sc = max(fuzz.ratio(t, p), fuzz.ratio(t, p[:-1]))
        if sc > bs:
            best, bs = p, sc
    return (best, bs) if bs >= 75 else (None, 0)


def parse_strip(strip, state):
    sx = strip['sx']
    sys_lines = strip['sys_lines']
    name_lines = strip['name_lines']
    bars = strip.get('bars', [])

    ys = sorted(l['y'] for l in sys_lines)
    diffs = [b - a for a, b in zip(ys, ys[1:]) if 20 < b - a < 200]
    pitch = int(np.median(diffs)) if diffs else 55

    entries = []
    for l in sys_lines:
        t = l['text']
        tn = norm(t)
        if not tn or JUNK_RE.search(tn):
            continue
        mk, md, fam, sc = canon_system(t)
        is_start = fam is not None and sc >= 68
        seg = t
        if l['x'] < sx - 80 and is_start:
            m = re.search(r'[フキシG島ジでンyY7+FfLC(（]\s*[・.。°oO*+•‥:、¢]', t)
            if m and m.start() > 0:
                seg = t[m.start():]
        entries.append({'y': l['y'], 'text': seg, 'start': is_start})

    start_ys = [e['y'] for e in entries if e['start']]

    header_events = []
    for by in bars:
        best, bs = None, 0
        for src in (name_lines, sys_lines):
            for l in src:
                if abs(l['y'] - by) < 45:
                    p, sc = find_pref_text(l['text'])
                    if p and sc > bs:
                        best, bs = p, sc
        header_events.append({'y': by, 'text_pref': best, 'score': bs})

    hospitals = []
    for l in name_lines:
        t = norm(l['text'])
        if not t or len(t) < 2 or JUNK_RE.search(t):
            continue
        p, sc = find_pref_text(t)
        if p and sc >= 85:
            # header missed by bar detector: add as header event
            header_events.append({'y': l['y'], 'text_pref': p, 'score': sc})
            continue
        # near a shaded bar AND prefecture-ish/short -> header bar text, not a hospital
        if any(abs(l['y'] - by) < 40 for by in bars) and (sc >= 55 or len(t) <= 4):
            continue
        aligned = any(abs(l['y'] - my) < pitch * 0.55 for my in start_ys)
        if hospitals and not aligned and l['y'] - hospitals[-1]['y'] < pitch * 3.4:
            hospitals[-1]['name'] += t
        else:
            hospitals.append({'y': l['y'], 'name': t})

    events = ([(h['y'] - pitch * 0.35, 0, 'hosp', h) for h in hospitals] +
              [(e['y'], 1, 'sys', e) for e in entries] +
              [(he['y'] - pitch * 0.7, -1, 'bar', he) for he in header_events])
    events.sort(key=lambda x: (x[0], x[1]))

    for y, _, kind, obj in events:
        if kind == 'bar':
            state['bars'].append({'pos': len(state['records']), 'ocr': obj['text_pref'],
                                  'score': obj['score'], 'page': strip['page'],
                                  'side': strip['side'], 'strip': strip['strip'], 'y': obj['y']})
            state['cur_hosp'] = None
        elif kind == 'hosp':
            rec = {'hospital': obj['name'], 'systems': [], 'page': strip['page'],
                   'side': strip['side'], 'strip': strip['strip'], 'y': obj['y']}
            state['records'].append(rec)
            state['cur_hosp'] = rec
        else:
            if state['cur_hosp'] is None:
                if state['records']:
                    state['cur_hosp'] = state['records'][-1]
                else:
                    continue
            if obj['start']:
                state['cur_hosp']['systems'].append(obj['text'])
            elif state['cur_hosp']['systems']:
                state['cur_hosp']['systems'][-1] += ' ' + obj['text']


def parse_year(order, jsondir):
    state = {'cur_hosp': None, 'records': [], 'bars': []}
    cache = {}
    for base, side in order:
        if base not in cache:
            cache[base] = json.load(open(f'{jsondir}/{base}.json'))
        for strip in [s for s in cache[base] if s['side'] == side]:
            parse_strip(strip, state)
    return state['records'], state['bars']


ORDER_2024 = [('pg-01', 'R'), ('pg-02', 'L'), ('pg-02', 'R'), ('pg-04', 'L'), ('pg-04', 'R'),
              ('pg-03', 'L'), ('pg-03', 'R'), ('pg-05', 'L'), ('pg-05', 'R'), ('pg-06', 'L')]
ORDER_2025 = [('pg-1', 'S'), ('pg-2', 'S'), ('pg-3', 'S'), ('pg-4', 'S'), ('pg-5', 'S')]

if __name__ == '__main__':
    for year, order, d in (('2024', ORDER_2024, 'ocr2024'), ('2025', ORDER_2025, 'ocr2025')):
        recs, bars = parse_year(order, d)
        json.dump({'records': recs, 'bars': bars},
                  open(f'parsed{year}.json', 'w'), ensure_ascii=False, indent=1)
        print(year, len(recs), 'hospitals;', sum(len(r["systems"]) for r in recs),
              'systems;', len(bars), 'bars')
