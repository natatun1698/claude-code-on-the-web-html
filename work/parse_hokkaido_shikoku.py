import json
import re
import sys

sys.path.insert(0, "work")
from parse_pdf2 import parse_pdf

JOBS = {
    "asahikawa": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (0, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R7.6.pdf"),
        (1, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R7.9.pdf"),
        (2, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R7.10.pdf"),
        (3, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R7.11.pdf"),
        (4, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R7.12.pdf"),
        (5, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R8.2.pdf"),
        (6, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2026/03/R8.3.pdf"),
        (7, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2024/11/R6.4.pdf"),
        (8, "https://www.asahikawa.jrc.or.jp/app/wp-content/uploads/2024/11/R6.7-1.pdf"),
    ]],
    "kitami": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (9, "https://www.kitami.jrc.or.jp/wp-content/uploads/2026/07/r08_zuiiikeiyaku_202606.pdf"),
        (10, "https://www.kitami.jrc.or.jp/wp-content/uploads/2026/05/r07_zuiiikeiyaku_202605.pdf"),
        (11, "https://www.kitami.jrc.or.jp/wp-content/uploads/2025/04/r07_zuiiikeiyaku_202504.pdf"),
    ]],
    "date": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (12, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/11/zuikei20251119.pdf"),
        (13, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/11/zuikei20251105.pdf"),
        (14, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/11/zuikei20251104.pdf"),
        (15, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/10/zuikei20251008.pdf"),
        (16, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/08/zuikei20250806.pdf"),
        (17, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/04/zuikei20250410.pdf"),
        (18, "https://date.jrc.or.jp/wp/wp-content/uploads/2025/04/zuikei202503.pdf"),
        (19, "https://date.jrc.or.jp/wp/wp-content/uploads/2024/11/zuikei202411.pdf"),
        (20, "https://date.jrc.or.jp/wp/wp-content/uploads/2024/07/202407zuii.pdf"),
    ]],
    "kushiro": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (21, "https://kushiro.jrc.or.jp/wordpress/wp-content/uploads/2026/04/随意契約一覧R８年度2.pdf"),
        (22, "https://kushiro.jrc.or.jp/wordpress/wp-content/uploads/2026/03/20260317zuii.pdf"),
        (23, "https://kushiro.jrc.or.jp/wordpress/wp-content/uploads/2025/03/R6zuii.pdf"),
    ]],
    "kuriyama": [
        ("out/sk4/024.html", "https://kuriyama.jrc.or.jp/wp-content/uploads/2022/06/随意契約の公表.pdf"),
    ],
    "shimizu": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (25, "https://shimizu.jrc.or.jp/files/zuikei_R2.pdf"),
        (26, "https://shimizu.jrc.or.jp/files/zuikei_R1.pdf"),
        (27, "https://shimizu.jrc.or.jp/files/zuikei_H30.pdf"),
        (28, "https://shimizu.jrc.or.jp/files/zuikei_H29.pdf"),
        (29, "https://shimizu.jrc.or.jp/files/zuikei_H28.pdf"),
        (30, "https://shimizu.jrc.or.jp/files/zuikei_H27.pdf"),
        (31, "https://shimizu.jrc.or.jp/files/zuikei_H26.pdf"),
        (32, "https://shimizu.jrc.or.jp/files/zuikei_H25.pdf"),
    ]],
    "oketo": [
        ("out/sk4/033.html", "http://oketo.jrc.or.jp/wp-content/uploads/2026/04/kouhyou.pdf"),
    ],
    "tokushima": [
        ("out/sk4/034.html", "https://www.tokushima-med.jrc.or.jp/file/attachment/11106.pdf"),
    ],
    "matsuyama": [(f"out/sk4/{i:03d}.html", u) for i, u in [
        (35, "https://www.matsuyama.jrc.or.jp/media/news/public-offer/PDF/HP掲載用R7"),
        (36, "https://www.matsuyama.jrc.or.jp/media/news/public-offer/PDF/HP掲載用R6"),
        (37, "https://www.matsuyama.jrc.or.jp/media/news/public-offer/PDF/HP掲載用R5"),
    ]],
}

for hospital, files in JOBS.items():
    rows = []
    for path, url in files:
        rows.extend(parse_pdf(path, url))
    out_path = f"work/contracts_{hospital}.json"
    json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"{hospital}: {len(rows)} rows total from {len(files)} files -> {out_path}")

# 小清水 (koshimizu): already fetched in sk3 batch as a single cumulative PDF
rows = parse_pdf("out/sk3/008.html", "http://www.phoenix-c.or.jp/~krchp/pdf/zuii.pdf")
json.dump(rows, open("work/contracts_koshimizu.json", "w"), ensure_ascii=False, indent=1)
print(f"koshimizu: {len(rows)} rows total from 1 file -> work/contracts_koshimizu.json")

# 浦河 (urakawa): data is embedded directly as HTML text on the page, not a PDF table.
# Parse the repeating block pattern instead of using parse_pdf2.
def parse_urakawa_html(path, source_url):
    text = open(path, encoding="utf-8", errors="ignore").read()
    import re as _re
    text = _re.sub(r"<[^>]+>", "\n", text)
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    out = []
    i = 0
    seq = 0
    item_re = re.compile(r"^\d+\.(.+)$")
    while i < len(lines):
        m = item_re.match(lines[i])
        if m and i + 10 < len(lines) and lines[i + 1] == "随意契約担当部課の所在地":
            name = m.group(1)
            dept = lines[i + 2]
            date = lines[i + 4] if lines[i + 3] == "随意契約を締結した日" else ""
            cp = lines[i + 6] if lines[i + 5] == "随意契約の相手方の氏名及び住所" else ""
            amount = lines[i + 8] if lines[i + 7] == "随意契約に係る契約金額" else ""
            reason = lines[i + 10] if lines[i + 9] == "随意契約にようすることとした理由" else ""
            seq += 1
            out.append({
                "no": seq, "name": name, "qty": "", "dept": dept, "date": date,
                "counterparty": cp, "amount": amount, "reason": reason, "remark": "",
                "source_url": source_url,
            })
            i += 11
        else:
            i += 1
    return out

rows = parse_urakawa_html("out/sk3/004.html", "http://urakawa.jrc.or.jp/public/")
json.dump(rows, open("work/contracts_urakawa.json", "w"), ensure_ascii=False, indent=1)
print(f"urakawa: {len(rows)} rows total from 1 file (HTML table) -> work/contracts_urakawa.json")
