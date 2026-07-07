import json
import sys

sys.path.insert(0, "work")
from parse_pdf2 import parse_pdf

JOBS = {
    "iryo_center": [
        ("out/b2/006.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei_202301q.pdf"),
        ("out/b2/007.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei_202302q.pdf"),
        ("out/b2/008.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202303q.pdf"),
        ("out/b2/009.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202304q.pdf"),
        ("out/b2/010.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202401q.pdf"),
        ("out/b2/011.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202402q.pdf"),
        ("out/b2/012.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202403q.pdf"),
        ("out/b2/013.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202404q.pdf"),
        ("out/b2/014.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202501q.pdf"),
        ("out/b2/015.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202502q.pdf"),
        ("out/b2/016.html", "https://www.med.jrc.or.jp/Portals/0/resources/chotatsu/zuikei/zuikei_202503q.pdf"),
    ],
    "omori": [
        ("out/b2/017.html", "https://omori.jrc.or.jp/media/zuikeikouhyo2022.pdf"),
        ("out/b2/018.html", "https://omori.jrc.or.jp/media/zuikei240401.pdf"),
        ("out/b2/019.html", "https://omori.jrc.or.jp/media/zuikei20250210.pdf"),
        ("out/b2/020.html", "https://omori.jrc.or.jp/media/kouhyou20260408.pdf"),
    ],
    "katsushika": [
        ("out/b2/021.html", "https://katsushika.jrc.or.jp/media/20250411-085912-1087.pdf"),
        ("out/b2/022.html", "https://katsushika.jrc.or.jp/media/20240628-134716-5828.pdf"),
        ("out/b2/023.html", "https://katsushika.jrc.or.jp/media/20230322-152316-4413.pdf"),
    ],
    "narita": [
        ("out/b2/024.html", "https://www.narita.jrc.or.jp/about/bid/files/zuikeiR6.pdf"),
        ("out/b2/025.html", "https://www.narita.jrc.or.jp/about/bid/files/zuikeiR5.pdf"),
        ("out/b2/026.html", "https://www.narita.jrc.or.jp/about/bid/files/zuikei_202204-202303.pdf"),
    ],
    "mito": [
        ("out/b2/027.html", "https://mito.jrc.or.jp/data/media/mito-jrc/uploads/2026/06/MHP_2606008/MHP_2606008.pdf"),
        ("out/b2/028.html", "https://mito.jrc.or.jp/data/media/mito-jrc/uploads/2026/04/MHP_2604015/MHP_2604015.pdf"),
        ("out/b2/029.html", "https://mito.jrc.or.jp/data/media/mito-jrc/uploads/2025/04/MHP_2504010/MHP_2504010.pdf"),
    ],
    "koga": [
        ("out/b2/030.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2026/02/令和7年度（その3）.pdf"),
        ("out/b2/031.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2025/09/20250917固定資産発注様式兼随意契約一覧（古河）.pdf"),
        ("out/b2/032.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2025/07/20250708zuikei.pdf"),
        ("out/b2/033.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2025/04/令和6年度随意契約一覧（古河）.pdf"),
        ("out/b2/034.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2024/11/令和6年度　随意契約一覧.pdf"),
        ("out/b2/035.html", "https://www.koga.jrc.or.jp/wordpress/wp-content/uploads/2024/08/令和5年随意契約一覧（差し替え用）.pdf"),
    ],
}

for hospital, files in JOBS.items():
    rows = []
    for path, url in files:
        rows.extend(parse_pdf(path, url))
    out_path = f"work/contracts_{hospital}.json"
    json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=1)
    print(f"{hospital}: {len(rows)} rows total from {len(files)} files -> {out_path}")
