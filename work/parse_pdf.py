#!/usr/bin/env python3
"""別紙様式第10-2/第11（随意契約公表）PDF をパースして JSON を出力する。

usage: python3 parse_pdf.py <pdf> <取得元URL> <出力json>

罫線が縦横とも引かれている様式は extract_tables() で取れる。
縦罫線がない様式は vertical_strategy="text" にフォールバックする。
"""
import json
import sys

import pdfplumber


def rows_from_table(t, source_url):
    out = []
    for r in t:
        cells = [(c or '').replace('\n', '').strip() for c in r]
        if len(cells) >= 7 and cells[0].isdigit():
            out.append({
                'no': int(cells[0]),
                'name': cells[1],
                'qty': cells[2],
                'dept': cells[3],
                'date': cells[4],
                'counterparty': cells[5],
                'amount': cells[6],
                'reason': cells[7] if len(cells) > 7 else '',
                'source_url': source_url,
            })
    return out


def parse_pdf(path, source_url):
    pdf = pdfplumber.open(path)
    out = []
    for p in pdf.pages:
        page_rows = []
        for t in p.extract_tables():
            page_rows.extend(rows_from_table(t, source_url))
        if not page_rows:
            t = p.extract_table({"vertical_strategy": "text",
                                 "horizontal_strategy": "lines"})
            if t:
                page_rows = rows_from_table(t, source_url)
        out.extend(page_rows)
    # 様式10-2は担当課と相手方の並びが 名称/数量/担当課/締結日/相手方 の順で同じ
    return out


if __name__ == '__main__':
    pdf_path, url, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    rows = parse_pdf(pdf_path, url)
    json.dump(rows, open(out_path, 'w'), ensure_ascii=False, indent=1)
    nos = [r['no'] for r in rows]
    missing = sorted(set(range(1, max(nos) + 1)) - set(nos)) if nos else []
    print(f'{out_path}: {len(rows)} rows', f'missing No: {missing}' if missing else '(complete)')
