#!/usr/bin/env python3
"""随意契約公表データからX線装置関連契約のExcelを生成する。

入力: contracts JSON (parse_pdf.py の出力、複数可)
出力: xlsx (7列: 名称/数量/担当課/締結日/相手方/契約金額/URL)
"""
import json
import re
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

# 対象装置カテゴリと判定キーワード（半角ｶﾅ・全角どちらも考慮）
CATEGORIES = [
    ("一般撮影（レントゲン）",
     ["一般撮影", "レントゲン", "ﾚﾝﾄｹﾞﾝ", "X線撮影装置", "Ｘ線撮影装置",
      "デジタルラジオグラフィ", "DR装置", "FPD", "X線診断装置", "撮影台"]),
    ("透視撮影台（X線テレビ）",
     ["X線テレビ", "Ｘ線テレビ", "X線TV", "透視撮影", "透視診断装置",
      "据置型X線透視", "デジタル透視"]),
    ("血管撮影（CVS、アンギオ）",
     ["血管撮影", "アンギオ", "ｱﾝｷﾞｵ", "血管造影", "循環器X線", "心血管X線",
      "バイプレーン", "CVS"]),
    ("外科用イメージ（可搬型Cアーム透視装置）",
     ["外科用イメージ", "外科用X線", "Cアーム", "Cｱｰﾑ", "移動型汎用X線透視",
      "移動型X線透視", "可搬型透視"]),
    ("回診用X線装置",
     ["回診用", "回診車", "移動型X線撮影", "ポータブル撮影", "移動型汎用一体型X線"]),
]

MAINTENANCE_KW = ["保守", "点検", "メンテナンス", "ﾒﾝﾃﾅﾝｽ", "修理", "保守点検"]


def norm(s):
    """全角英数→半角、半角ｶﾅ→全角に正規化して比較しやすくする。"""
    import unicodedata
    return unicodedata.normalize("NFKC", s or "")


def categorize(name):
    n = norm(name)
    for cat, kws in CATEGORIES:
        for kw in kws:
            if norm(kw) in n:
                return cat
    return None


def is_maintenance(name):
    n = norm(name)
    return any(norm(k) in n for k in MAINTENANCE_KW)


def build(rows, out_path, hospital="徳島赤十字病院"):
    wb = Workbook()
    ws = wb.active
    ws.title = "X線装置関連随意契約"

    headers = ["物品などまたは役務の名称", "数量", "随意契約担当課の名称及び所在地",
               "随意契約を締結した日", "随意契約の相手方の氏名及び住所",
               "随意契約に係る契約金額", "URL"]
    extra = ["区分（装置カテゴリ）", "製品/保守"]

    title_font = Font(bold=True, size=14)
    ws.cell(row=1, column=1, value=f"{hospital} 随意契約公表情報（X線装置関連）").font = title_font

    head_fill = PatternFill("solid", fgColor="C00000")
    head_font = Font(bold=True, color="FFFFFF")
    thin = Side(style="thin")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    all_cols = headers + extra
    for ci, h in enumerate(all_cols, 1):
        c = ws.cell(row=3, column=ci, value=h)
        c.fill = head_fill
        c.font = head_font
        c.border = border
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    r = 4
    for row in rows:
        amount = row["amount"]
        try:
            amount_v = int(re.sub(r"[^0-9]", "", amount)) if re.search(r"\d", amount) else amount
        except ValueError:
            amount_v = amount
        values = [row["name"], row["qty"], row["dept"], row["date"],
                  row["counterparty"], amount_v, row["source_url"],
                  row.get("category", ""), row.get("kind", "")]
        for ci, v in enumerate(values, 1):
            c = ws.cell(row=r, column=ci, value=v)
            c.border = border
            c.alignment = Alignment(vertical="top", wrap_text=True)
            if ci == 6 and isinstance(v, int):
                c.number_format = "#,##0"
        r += 1

    widths = [42, 6, 34, 14, 34, 14, 46, 26, 10]
    for ci, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w
    ws.freeze_panes = "A4"
    wb.save(out_path)
    print(f"saved {out_path} ({len(rows)} rows)")


if __name__ == "__main__":
    rows = []
    for path in sys.argv[1:-1]:
        rows.extend(json.load(open(path)))
    matched = []
    for row in rows:
        cat = categorize(row["name"])
        if cat:
            row["category"] = cat
            row["kind"] = "保守" if is_maintenance(row["name"]) else "製品"
            matched.append(row)
    build(matched, sys.argv[-1])
