#!/usr/bin/env python3
"""Diff 2024 vs 2025 records: order-preserving DP alignment of hospital
sequences per prefecture, then canonical system-set comparison with
noise filters. Output candidates for visual verification."""
import json, re, unicodedata
from rapidfuzz import fuzz
from canon import canon_system
from assign import norm_hosp, hosp_sim

PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
         '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県']

MATCH_FLOOR = 42   # below this, prefer gap in alignment
GAP = -6


def align(A, B):
    """Needleman-Wunsch on hospital sequences; returns list of (i or None, j or None)."""
    n, m = len(A), len(B)
    S = [[0.0] * (m + 1) for _ in range(n + 1)]
    P = [[0] * (m + 1) for _ in range(n + 1)]  # 1 diag, 2 up(del A), 3 left(ins B)
    for i in range(1, n + 1):
        S[i][0] = S[i - 1][0] + GAP
        P[i][0] = 2
    for j in range(1, m + 1):
        S[0][j] = S[0][j - 1] + GAP
        P[0][j] = 3
    simcache = {}
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = hosp_sim(A[i - 1]['hospital'], B[j - 1]['hospital'])
            d = S[i - 1][j - 1] + (s - MATCH_FLOOR) / 10.0
            u = S[i - 1][j] + GAP
            l = S[i][j - 1] + GAP
            best = max(d, u, l)
            S[i][j] = best
            P[i][j] = 1 if best == d else (2 if best == u else 3)
    pairs = []
    i, j = n, m
    while i > 0 or j > 0:
        p = P[i][j]
        if p == 1:
            pairs.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif p == 2:
            pairs.append((i - 1, None))
            i -= 1
        else:
            pairs.append((None, j - 1))
            j -= 1
    pairs.reverse()
    return pairs


def canon_set(rec):
    out = []
    for s in rec['systems']:
        mk, md, fam, sc = canon_system(s)
        out.append({'maker': mk, 'model': md, 'fam': fam, 'raw': s, 'conf': sc})
    return out


def variant_similar(m1, m2):
    return fuzz.ratio(m1, m2) >= 70


def diff_all(recs24, recs25):
    results = []
    for pref in PREFS:
        A = [r for r in recs24 if r['pref'] == pref]
        B = [r for r in recs25 if r['pref'] == pref]
        pairs = align(A, B)
        # neighborhood models pool for attribution-drift filtering
        for k, (i, j) in enumerate(pairs):
            if j is None:
                continue
            b = B[j]
            b_sys = [s for s in canon_set(b) if s['fam']]
            if i is None:
                if b_sys:
                    results.append({'type': 'new_hospital', 'pref': pref, 'h24': None,
                                    'h25': b, 'added': b_sys, 'sim': 0})
                continue
            a = A[i]
            sim = hosp_sim(a['hospital'], b['hospital'])
            a_models = {}
            a_fams = {}
            for s in canon_set(a):
                if not s['fam']:
                    continue
                a_models[s['model']] = a_models.get(s['model'], 0) + 1
                a_fams.setdefault(s['fam'], []).append(s['model'])
            # neighbor models (attribution drift): previous & next 2024 records
            neigh_models = set()
            for off in (-2, -1, 1, 2):
                if 0 <= i + off < len(A):
                    for s in canon_set(A[i + off]):
                        if s['fam']:
                            neigh_models.add(s['model'])
            avail = dict(a_models)
            added = []
            for s in b_sys:
                if avail.get(s['model'], 0) > 0:
                    avail[s['model']] -= 1
                    continue
                # same family, similar variant string -> OCR variant, not new
                if s['fam'] in a_fams and any(variant_similar(s['model'], m) for m in a_fams[s['fam']]):
                    continue
                flags = []
                if s['conf'] < 78:
                    flags.append('lowconf')
                if s['model'] in neigh_models:
                    flags.append('neighbor')
                if sim < 65:
                    flags.append('weakmatch')
                added.append({**s, 'flags': flags})
            if added:
                results.append({'type': 'systems_added', 'pref': pref,
                                'h24': a, 'h25': b, 'added': added, 'sim': sim})
    return results


if __name__ == '__main__':
    recs24 = json.load(open('records2024.json'))
    recs25 = json.load(open('records2025.json'))
    res = diff_all(recs24, recs25)
    json.dump(res, open('candidates.json', 'w'), ensure_ascii=False, indent=1)
    clean, flagged, newh = 0, 0, 0
    for r in res:
        if r['type'] == 'new_hospital':
            newh += 1
        else:
            if all(not s['flags'] for s in r['added']):
                clean += 1
            else:
                flagged += 1
    print('systems_added records:', sum(1 for r in res if r['type'] == 'systems_added'),
          '(clean:', clean, 'flagged:', flagged, ') new_hospital:', newh)
    print('total added systems:', sum(len(r['added']) for r in res))
    from collections import Counter
    print(Counter(r['pref'] for r in res))
