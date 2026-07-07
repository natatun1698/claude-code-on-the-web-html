#!/usr/bin/env python3
"""別紙様式第11（随意契約公表）PDF をパースして JSON を出力する。

usage: python3 parse_pdf.py <pdf> <取得元URL> <出力json>
"""
import json
import sys

import pdfplumber


def parse_pdf(path, source_url):
    pdf = pdfplumber.open(path)
    out = []
    for p in pdf.pages:
        for t in p.extract_tables():
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


if __name__ == '__main__':
    pdf_path, url, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    rows = parse_pdf(pdf_path, url)
    json.dump(rows, open(out_path, 'w'), ensure_ascii=False, indent=1)
    print(f'{out_path}: {len(rows)} rows')
