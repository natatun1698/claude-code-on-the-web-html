import json
import sys

sys.path.insert(0, "work")
from parse_pdf2 import parse_pdf

JOBS = {
    "karatsu": [(f"out/ky3/{i:03d}.html", u) for i, u in [
        (0, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2854/keiyaku_R6_1-3.pdf"),
        (1, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2855/zuiikeiyakur6.4-5.pdf"),
        (2, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2856/zuiikeiyakur6.6-7.pdf"),
        (3, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2857/zuiikeiyakur6.8-9.pdf"),
        (4, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2858/zuiikeiyaku.r6.12-r7.1.pdf"),
        (5, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2859/keiyaku_R7.2-3.pdf"),
        (6, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2860/keiyaku_R7.4-5.pdf"),
        (7, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2861/keiyaku_R7.8-9.pdf"),
        (8, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2862/keiyaku_R7.10-11.pdf"),
        (9, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2863/keiyaku_R7.12-R8.1.pdf"),
        (10, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2864/keiyaku_R8.2-3.pdf"),
        (11, "https://www.karatsu.jrc.or.jp/var/rev0/0004/2865/keiyaku_R8.4-5.pdf"),
    ]],
    "isahaya": [
        ("out/ky3/012.html", "http://isahaya.jrc.or.jp/news/file/345file1_20260327162844.pdf"),
    ],
    "fukuoka": [
        ("out/ky3/014.html", "https://www.fukuoka-med.jrc.or.jp/storage/uploads/block/202607/20260707_184014.pdf"),
        ("out/ky3/015.html", "https://www.fukuoka-med.jrc.or.jp/storage/uploads/block/202201/20220120_165236.pdf"),
    ],
    "imazu": [
        ("out/ky3/016.html", "https://imazu-med-jrc.jp/files/libs/659/202308160910442147.pdf"),
        ("out/ky3/017.html", "https://imazu-med-jrc.jp/files/libs/722/202405021441353174.pdf"),
        ("out/ky3/018.html", "https://imazu-med-jrc.jp/files/libs/846/20250514100036543.pdf"),
        ("out/ky3/019.html", "https://imazu-med-jrc.jp/files/libs/944/20260409141033281.pdf"),
    ],
    "kama": [
        ("out/ky3/020.html", "https://www.kama-jrc.jp/files/libs/2331/202605270931213057.pdf"),
    ],
    "oita": [(f"out/ky3/{i:03d}.html", u) for i, u in [
        (21, "https://www.oitasekijyuji.jp/assets/files/10c510faf16902137e364ef11d04ca71-1.pdf"),
        (22, "https://www.oitasekijyuji.jp/assets/files/r60203.pdf"),
        (23, "https://www.oitasekijyuji.jp/assets/files/093dba95f4dcb9449b79eb2e5553b4ff-2.pdf"),
        (24, "https://www.oitasekijyuji.jp/assets/files/093dba95f4dcb9449b79eb2e5553b4ff.pdf"),
        (25, "https://www.oitasekijyuji.jp/assets/files/b5dcf7dd79b7a32cacfb01b4d92d281f.pdf"),
        (26, "https://www.oitasekijyuji.jp/assets/files/bcd9034abdeeaa3260d3079b647d10a7.pdf"),
        (27, "https://www.oitasekijyuji.jp/assets/files/1f20273c1de2b8b72699aadf8b62b6ac.pdf"),
        (28, "https://www.oitasekijyuji.jp/assets/files/7286d0147feaa7b2d81d18d232787d4d.pdf"),
        (29, "https://www.oitasekijyuji.jp/assets/files/ebfa1c88fd8c2e04a34e9b28a6890380.pdf"),
        (30, "https://www.oitasekijyuji.jp/assets/files/bcca47d410b2b72c6af6357d5e7303dc.pdf"),
        (31, "https://www.oitasekijyuji.jp/assets/files/3379af1905642359efcf03e226b56715.pdf"),
        (32, "https://www.oitasekijyuji.jp/assets/files/a2f19928868326f3084e6cf9c31d69ad.pdf"),
    ]],
    "nagasaki_genbaku": [(f"out/ky3/{i:03d}.html", u) for i, u in [
        (33, "https://nagasaki-med.jrc.or.jp/news/file/1148file1_20250807141946.pdf"),
        (34, "https://nagasaki-med.jrc.or.jp/news/file/1185file1_20251204091129.pdf"),
        (35, "https://nagasaki-med.jrc.or.jp/news/file/1224file1_20260414101709.pdf"),
        (36, "https://nagasaki-med.jrc.or.jp/news/file/1241file1_20260702134247.pdf"),
    ]],
    "kagoshima": [(f"out/ky3/{i:03d}.html", u) for i, u in [
        (37, "http://www.kagoshima-med.jrc.or.jp/images/contents/251015_令和７年度第２四半期_随意契約ホームページ公表.pdf"),
        (38, "http://www.kagoshima-med.jrc.or.jp/images/contents/news/nyusatsu/20260128/260127_令和７年度第３四半期_随意契約ホームページ公表.pdf"),
        (39, "http://www.kagoshima-med.jrc.or.jp/images/contents/magazine/260409/随意契約の公表令和７年度第４四半期.pdf"),
    ]],
}

for hospital, files in JOBS.items():
    rows = []
    for path, url in files:
        rows.extend(parse_pdf(path, url))
    out_path = f"work/contracts_{hospital}.json"
    json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"{hospital}: {len(rows)} rows total from {len(files)} files -> {out_path}")
