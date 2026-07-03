#!/usr/bin/env python3
"""Assign prefectures to parsed records.

2024 (flat scan, reliable bars): sequential bar advance; confident-OCR bars
re-sync; surplus bars between confident anchors dropped (shortest segment first).

2025 (photographed, noisy bars): monotone DP alignment against the 2024
records — each 2025 hospital votes for the prefecture of its best 2024 fuzzy
match; confident-OCR bars act as hard anchors.
"""
import json, re, unicodedata
import numpy as np
from rapidfuzz import fuzz

PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
         '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']


def norm_hosp(s):
    s = unicodedata.normalize('NFKC', s)
    s = re.sub(r'[\s　・,、.。|「」()（）\[\]{}<>《》〈〉:;!?]', '', s)
    for bad, good in [('了', '院'), ('病説', '病院'), ('病計', '病院'), ('病窟', '病院'),
                      ('病干', '病院'), ('岳院', '病院'), ('岳司', '病院'), ('病足', '病院')]:
        s = s.replace(bad, good)
    return s


def hosp_sim(a, b):
    a, b = norm_hosp(a), norm_hosp(b)
    if not a or not b:
        return 0
    return max(fuzz.ratio(a, b), fuzz.partial_ratio(a, b) * 0.9)


def assign_2024(records, bars, verified_path='verified_bars_2024.json'):
    """Assign via visually verified bar table (page/side/strip/y -> pref)."""
    verified = json.load(open(verified_path))

    def match(b):
        for v in verified:
            if (b['page'], b['side'], b['strip']) == (v['page'], v['side'], v['strip']) \
                    and abs(b['y'] - v['y']) < 80:
                return v['pref']
        return None

    events = sorted(bars, key=lambda b: b['pos'])
    marks = []  # (pos, pref)
    seen = set()
    for b in events:
        p = match(b)
        if p and p not in seen:
            marks.append((b['pos'], p))
            seen.add(p)
    missing = [v['pref'] for v in verified if v['pref'] not in seen]
    if missing:
        print('WARN verified bars not matched in parsed bars:', missing)
    cur = None
    mi = 0
    for i, r in enumerate(records):
        while mi < len(marks) and marks[mi][0] <= i:
            cur = marks[mi][1]
            mi += 1
        r['pref'] = cur
    return [r for r in records if r['pref']]


def assign_2025(records25, records24, bars25):
    """Monotone DP with match votes and confident-bar anchors."""
    votes = []
    for r in records25:
        best_p, best_s = None, 0
        for a in records24:
            s = hosp_sim(r['hospital'], a['hospital'])
            if s > best_s:
                best_p, best_s = a['pref'], s
        if best_s >= 63 and best_p:
            votes.append((PREFS.index(best_p), best_s / 100.0))
        else:
            votes.append((None, 0))
    # anchors: confident bars force transition at their positions
    anchors = {}
    for b in bars25:
        if b['ocr'] in PREFS and b['score'] >= 80:
            anchors[b['pos']] = PREFS.index(b['ocr'])
    N, P = len(records25), len(PREFS)
    NEG = -1e9
    dp = np.full((N + 1, P), NEG)
    bk = np.zeros((N + 1, P), dtype=int)
    dp[0, 0] = 0
    for i in range(N):
        # anchor between record i-... : anchor at pos i means records >= i are pref >= anchor, records < i are pref <= anchor
        for p in range(P):
            if dp[i, p] == NEG:
                continue
            for q in range(p, P):
                # anchor constraint
                ok = True
                if i in anchors:
                    if q < anchors[i]:
                        ok = False
                    # also disallow being past anchor already? monotone handles
                if not ok:
                    continue
                gain = 0.0
                vp, vs = votes[i]
                if vp is not None:
                    gain = vs if vp == q else -0.35 * vs
                # discourage skipping prefectures entirely
                gain -= 0.15 * max(0, q - p - 1)
                if dp[i, p] + gain > dp[i + 1, q]:
                    dp[i + 1, q] = dp[i, p] + gain
                    bk[i + 1, q] = p
    # backtrack from best final state (should be 神奈川県)
    end_p = int(np.argmax(dp[N]))
    seq = []
    p = end_p
    for i in range(N, 0, -1):
        seq.append(p)
        p = bk[i, p]
    seq.reverse()
    for r, pi in zip(records25, seq):
        r['pref'] = PREFS[pi]
    return records25


if __name__ == '__main__':
    d24 = json.load(open('parsed2024.json'))
    d25 = json.load(open('parsed2025.json'))
    recs24 = assign_2024(d24['records'], d24['bars'])
    recs25 = assign_2025(d25['records'], recs24, d25['bars'])
    json.dump(recs24, open('records2024.json', 'w'), ensure_ascii=False, indent=1)
    json.dump(recs25, open('records2025.json', 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    for y, recs in (('2024', recs24), ('2025', recs25)):
        c = Counter(r['pref'] for r in recs)
        print(y, len(recs), {p: c.get(p, 0) for p in PREFS + [None]})
