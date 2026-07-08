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

DATE_RE = re.compile(
    r"^(令和|平成)?\d{1,4}年\d{1,2}月\d{1,2}日$|^\d{1,2}月\d{1,2}日$|"
    r"^\d{4}[/.]\d{1,2}[/.]\d{1,2}$|^R\d{1,2}\.\d{1,2}\.\d{1,2}$"
)


def is_header_row(cells):
    joined = "".join(cells)
    if not any(m in joined for m in HEADER_MARKERS):
        return False
    # Header rows are short column labels; data rows contain a long reason
    # paragraph, which can itself mention "随意契約" and must not be dropped.
    return not any(len(c) > 40 for c in cells)


def clean(c):
    return (c or "").replace("\n", "").strip()


def find_date_index(cells):
    for i, c in enumerate(cells):
        # PDF extraction sometimes inserts stray spaces inside the date
        # (e.g. "令和５ 年１２月１２日"); strip whitespace before matching.
        if DATE_RE.match(re.sub(r"\s+", "", c)):
            return i
    return None


AMOUNT_RE = re.compile(r"[\d,，]{4,}\s*円|^[\d,，]{4,}$")


def rows_from_table(t, source_url):
    """Locate the date cell (a reliable anchor) and derive the surrounding
    columns from it, since hospitals vary in whether they have a No./qty/unit
    column before the name, and column count alone is ambiguous."""
    out = []
    seq = 0
    last_dept = last_date = last_cp = last_reason = ""
    for r in t:
        cells = [clean(c) for c in r]
        if not any(cells):
            continue
        if is_header_row(cells):
            continue
        n = len(cells)
        date_idx = find_date_index(cells)
        if date_idx is None:
            # Bundle-purchase continuation row: same contract as the row
            # above, only the item name and amount differ (dept/date/
            # counterparty cells are blank because they were merged in
            # the source PDF). Inherit the previous row's context.
            amount_cell = next((c for c in cells[1:] if AMOUNT_RE.search(c)), None)
            if cells[0] and amount_cell and last_date:
                seq += 1
                out.append({
                    "no": seq, "name": cells[0], "qty": "",
                    "dept": last_dept, "date": last_date,
                    "counterparty": last_cp, "amount": amount_cell,
                    "reason": last_reason, "remark": "",
                    "source_url": source_url,
                })
            continue
        # dept is always immediately before date; cp, amount follow date;
        # reason/remark are whatever remains at the end.
        if date_idx < 1 or date_idx + 2 >= n:
            continue
        dept = cells[date_idx - 1]
        date = cells[date_idx]
        cp = cells[date_idx + 1]
        amount = cells[date_idx + 2]
        tail = cells[date_idx + 3:]
        reason = tail[0] if len(tail) >= 1 else ""
        remark = tail[1] if len(tail) >= 2 else ""
        leading = cells[:date_idx - 1]
        seq += 1
        no = None
        if len(leading) == 1:
            name, qty = leading[0], ""
        elif len(leading) == 2:
            if re.match(r"^\d+$", leading[0]):
                no, name, qty = leading[0], leading[1], ""
            else:
                name, qty = leading[0], leading[1]
        elif len(leading) >= 3:
            if re.match(r"^\d+$", leading[0]):
                no, name, qty = leading[0], leading[1], "".join(leading[2:])
            else:
                name, qty = leading[0], "".join(leading[1:])
        else:
            continue
        if not name:
            continue
        try:
            no_v = int(no)
        except (ValueError, TypeError):
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
        last_dept, last_date, last_cp, last_reason = dept, date, cp, reason
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
