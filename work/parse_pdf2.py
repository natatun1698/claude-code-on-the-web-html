#!/usr/bin/env python3
"""別紙様式第10-2/第11（随意契約公表）PDF汎用パーサ。

病院により列構成が異なる（No.列の有無、数量が名称に含まれるか等）ため、
末尾6列は必ず [担当課, 締結日, 相手方, 金額, 理由, 備考] という前提のもと、
先頭列数の違い（7/8/9列）から No./数量列の有無を推定する。

usage: python3 parse_pdf2.py <pdf> <取得元URL> <出力json>
"""
import json
import re
import sys

import pdfplumber

HEADER_MARKERS = ("随意契約", "物品等", "No.", "会計課長", "作成者")


def is_header_row(cells):
    joined = "".join(cells)
    if not any(m in joined for m in HEADER_MARKERS):
        return False
    # Header rows are short column labels; data rows contain a long reason
    # paragraph, which can itself mention "随意契約" and must not be dropped.
    return not any(len(c) > 40 for c in cells)


def clean(c):
    return (c or "").replace("\n", "").strip()


def rows_from_table(t, source_url):
    out = []
    seq = 0
    for r in t:
        cells = [clean(c) for c in r]
        if not any(cells):
            continue
        if is_header_row(cells):
            continue
        n = len(cells)
        seq += 1
        if n == 9:
            no, name, qty, dept, date, cp, amount, reason, remark = cells
        elif n == 8:
            if re.match(r"^\d+$", cells[0]):
                no, name, dept, date, cp, amount, reason, remark = cells
                qty = ""
            else:
                name, qty, dept, date, cp, amount, reason, remark = cells
                no = str(seq)
        elif n == 7:
            name, dept, date, cp, amount, reason, remark = cells
            qty = ""
            no = str(seq)
        elif n == 6:
            name, dept, date, cp, amount, reason = cells
            qty = ""
            remark = ""
            no = str(seq)
        else:
            continue
        if not name:
            continue
        try:
            no_v = int(no)
        except ValueError:
            no_v = seq
        out.append({
            "no": no_v,
            "name": name,
            "qty": qty,
            "dept": dept,
            "date": date,
            "counterparty": cp,
            "amount": amount,
            "reason": reason,
            "remark": remark,
            "source_url": source_url,
        })
    return out


def parse_pdf(path, source_url):
    pdf = pdfplumber.open(path)
    out = []
    for p in pdf.pages:
        tables = p.extract_tables()
        page_rows = []
        for t in tables:
            page_rows.extend(rows_from_table(t, source_url))
        if not tables:
            t = p.extract_table({"vertical_strategy": "text",
                                 "horizontal_strategy": "lines"})
            if t:
                page_rows = rows_from_table(t, source_url)
        out.extend(page_rows)
    return out


if __name__ == '__main__':
    pdf_path, url, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    rows = parse_pdf(pdf_path, url)
    json.dump(rows, open(out_path, 'w'), ensure_ascii=False, indent=1)
    print(f'{out_path}: {len(rows)} rows')
