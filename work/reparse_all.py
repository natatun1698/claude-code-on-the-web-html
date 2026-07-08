import json
import sys

sys.path.insert(0, "work")
from parse_pdf2 import parse_pdf

JOBS = {
    # --- Kanto region 1 (b1-b6) ---
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
    "azumino": [
        ("out/b6/000.html", "https://www.azumino.jrc.or.jp/cms/wp-content/uploads/2025/05/令和6年度下半期随意契約.pdf"),
        ("out/b6/001.html", "https://www.azumino.jrc.or.jp/cms/wp-content/uploads/2025/03/令和6年度上半期随意契約-202503.pdf"),
        ("out/b6/002.html", "https://www.azumino.jrc.or.jp/cms/wp-content/uploads/2025/02/r5-contract.pdf"),
    ],
    "iiyama": [
        ("out/b5/000.html", "https://www.iiyama.jrc.or.jp/file/attachment/1364.pdf"),
        ("out/b5/001.html", "https://www.iiyama.jrc.or.jp/file/attachment/1026.pdf"),
        ("out/b5/002.html", "https://www.iiyama.jrc.or.jp/file/attachment/1711.pdf"),
    ],
    "yamanashi": [
        ("out/b4/002.html", "https://www.yamanashi-med.jrc.or.jp/wp-content/uploads/2024/03/contract_20240312-1.pdf"),
        ("out/b5/003.html", "https://www.yamanashi-med.jrc.or.jp/wp-content/uploads/2025/04/contract_20250409.pdf"),
    ],
    "nagano": [
        ("out/b4/003.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/zuikeikouhyou.pdf"),
        ("out/b4/004.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R4zuikeikouhyou2.pdf"),
        ("out/b4/005.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei1.pdf"),
        ("out/b4/006.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei2.pdf"),
        ("out/b4/007.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei3.pdf"),
        ("out/b4/008.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei4.pdf"),
        ("out/b4/009.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei5.pdf"),
        ("out/b4/010.html", "https://www.nagano-med.jrc.or.jp/wp/wp-content/uploads/R3zuikei6.pdf"),
    ],
    # --- Tohoku region (t1-t4) ---
    "hachinohe": [
        ("out/t3/000.html", "https://www.hachinohe.jrc.or.jp/wp/wp-content/uploads/2024/11/184682d5984070e78bbc56a517fd9143-1.pdf"),
        ("out/t3/001.html", "https://www.hachinohe.jrc.or.jp/wp/wp-content/uploads/2024/11/74937714a167b97fb1dc7837287891ea.pdf"),
        ("out/t3/002.html", "https://www.hachinohe.jrc.or.jp/wp/wp-content/themes/red_cross_society/lib/pdf/voluntary-contract-r4.pdf"),
    ],
    "morioka": [
        ("out/t3/003.html", "http://www.morioka.jrc.or.jp/wp-content/uploads/2026/06/zuii_20260624.pdf"),
        ("out/t3/004.html", "http://www.morioka.jrc.or.jp/wp-content/uploads/2026/04/zuii_20260416.pdf"),
        ("out/t3/005.html", "http://www.morioka.jrc.or.jp/wp-content/uploads/2025/05/zuii_20250515.pdf"),
    ],
    "sendai": [
        ("out/t4/000.html", "https://www.sendai.jrc.or.jp/file/attachment/3929.pdf"),
        ("out/t4/001.html", "https://www.sendai.jrc.or.jp/file/attachment/3890.pdf"),
        ("out/t4/002.html", "https://www.sendai.jrc.or.jp/file/attachment/3769.pdf"),
    ],
    "ishinomaki": [
        ("out/t2/004.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20260610_01.pdf"),
        ("out/t2/005.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20260405_01.pdf"),
        ("out/t2/006.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20260205_01.pdf"),
        ("out/t2/007.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20251210_01.pdf"),
        ("out/t2/008.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20251012_01.pdf"),
        ("out/t2/009.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20250812_01.pdf"),
        ("out/t2/010.html", "https://www.ishinomaki.jrc.or.jp/data/media/ishimaki_rc_personnel/page/tender/zuikeikouhyou20250612_01.pdf"),
    ],
    "fukushima": [
        ("out/t2/011.html", "https://www.fukushima-med-jrc.jp/data/bidlist_r7.pdf"),
        ("out/t2/012.html", "https://www.fukushima-med-jrc.jp/data/bidlist_r6.pdf"),
        ("out/t2/013.html", "https://www.fukushima-med-jrc.jp/data/bidlist_r5.pdf"),
    ],
    # --- Kanto region 2 (n1-n8) ---
    "nasu": [
        ("out/n3/000.html", "https://www.nasu.jrc.or.jp/data/media/zuiikeiyakuitiran2025.pdf"),
        ("out/n3/001.html", "https://www.nasu.jrc.or.jp/data/media/nasu-jrc/page/tender/pdf/2024_kouhyoukeiyaku.pdf"),
        ("out/n3/002.html", "https://www.nasu.jrc.or.jp/data/media/nasu-jrc/page/tender/pdf/cedc5f5de7ee0a81ac11fca4330a2212.pdf"),
    ],
    "haga": [
        ("out/n3/003.html", "https://www.haga.jrc.or.jp/data/media/haga/page/about/procurement/Reiwa7.pdf"),
        ("out/n3/004.html", "https://www.haga.jrc.or.jp/data/media/haga/page/about/procurement/令和６年度随意契約の公表について.pdf"),
        ("out/n3/005.html", "https://www.haga.jrc.or.jp/data/media/haga/page/about/procurement/令和５年度　随意契約の公表-3.pdf"),
    ],
    "ashikaga": [
        ("out/n3/006.html", "https://www.ashikaga.jrc.or.jp/files/libs/7092/202601271005459505.pdf"),
        ("out/n3/007.html", "https://www.ashikaga.jrc.or.jp/files/libs/7091/202506021147286443.pdf"),
        ("out/n3/008.html", "https://www.ashikaga.jrc.or.jp/files/libs/4469/202310260953243744.pdf"),
    ],
    "maebashi": [
        ("out/n3/009.html", "https://www.maebashi.jrc.or.jp/other/pdf/2025.pdf"),
        ("out/n3/010.html", "https://www.maebashi.jrc.or.jp/other/pdf/2024up.pdf"),
        ("out/n3/011.html", "https://www.maebashi.jrc.or.jp/other/pdf/2023.pdf"),
    ],
    "saitama": [
        ("out/n3/012.html", "https://www.saitama-med.jrc.or.jp/albums/abm00003351.pdf"),
        ("out/n3/013.html", "https://www.saitama-med.jrc.or.jp/albums/abm00003503.pdf"),
        ("out/n3/014.html", "https://www.saitama-med.jrc.or.jp/albums/abm00003576.pdf"),
        ("out/n3/015.html", "https://www.saitama-med.jrc.or.jp/albums/abm00003746.pdf"),
    ],
    "ogawa": [
        ("out/n3/016.html", "https://www.ogawa.jrc.or.jp/bid/29zuikei.pdf"),
        ("out/n3/017.html", "https://www.ogawa.jrc.or.jp/bid/28zuikei.pdf"),
        ("out/n3/018.html", "https://www.ogawa.jrc.or.jp/bid/zuikei27.pdf"),
    ],
    "fukaya": [
        ("out/n3/019.html", "https://www.fukaya.jrc.or.jp/announcement/?fileid=00000093"),
        ("out/n3/020.html", "https://www.fukaya.jrc.or.jp/announcement/?fileid=00000090"),
        ("out/n3/021.html", "https://www.fukaya.jrc.or.jp/announcement/?fileid=00000085"),
        ("out/n3/022.html", "https://www.fukaya.jrc.or.jp/announcement/?fileid=00000084"),
        ("out/n3/023.html", "https://www.fukaya.jrc.or.jp/announcement/?fileid=00000067"),
    ],
    "nagaoka": [
        ("out/n6/000.html", "https://www.nagaoka.jrc.or.jp/wp-content/uploads/2015/08/1a92e5278a5a5b9893a68344b4c4af972.pdf"),
        ("out/n6/001.html", "https://www.nagaoka.jrc.or.jp/wp-content/uploads/2015/08/ad144dd9128402bc74628141a8d9e94f.pdf"),
        ("out/n6/002.html", "https://www.nagaoka.jrc.or.jp/wp-content/uploads/2015/08/df40832c0b5dc002cc0c7f398170061c.pdf"),
    ],
    "haramachi": [
        ("out/n8/000.html", "https://www.haramachi.jrc.or.jp/grit/wp-content/uploads/2025/04/media-38.pdf"),
        ("out/n8/001.html", "https://www.haramachi.jrc.or.jp/grit/wp-content/uploads/2025/04/media-33.pdf"),
        ("out/n8/002.html", "https://www.haramachi.jrc.or.jp/grit/wp-content/uploads/2025/04/media-34.pdf"),
    ],
    # --- Kanagawa/Shizuoka region (s1-s3) ---
    "minato": [
        ("out/s2/001.html", "https://www.yokohama.jrc.or.jp/wp/wp-content/uploads/2024/10/令和5年度_随意契約の公表.pdf"),
        ("out/s2/002.html", "https://www.yokohama.jrc.or.jp/wp/wp-content/uploads/2025/05/随意契約の公表（令和6年度）-1.pdf"),
        ("out/s2/003.html", "https://www.yokohama.jrc.or.jp/wp/wp-content/uploads/2025/10/随意契約の公表（令和7年度）.pdf"),
    ],
    "sagamihara": [
        ("out/s3/000.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2026/06/随意契約締結状況（R8年度）4月分.pdf"),
        ("out/s3/001.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2026/04/随意契約締結状況（R7年度）3月分.pdf"),
        ("out/s3/002.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2026/03/随意契約締結状況（R7年度）1月分.pdf"),
        ("out/s3/003.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2026/03/随意契約締結状況（R7年度）12月分.pdf"),
        ("out/s3/004.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2025/12/随意契約締結状況（R7年度）11月分.pdf"),
        ("out/s3/005.html", "http://www.sagamihara.jrc.or.jp/wp/wp-content/uploads/2025/10/随意契約締結状況（R7年度）10月.pdf"),
    ],
    "hadano": [
        ("out/s2/010.html", "https://hadano-med-jrc.jp/files/libs/3263/202605151309068627.pdf"),
        ("out/s2/011.html", "https://hadano-med-jrc.jp/files/libs/3229/202604220838189067.pdf"),
        ("out/s2/012.html", "https://hadano-med-jrc.jp/files/libs/3178/202603101316116010.pdf"),
        ("out/s2/013.html", "https://hadano-med-jrc.jp/files/libs/2971/202601081237069862.pdf"),
        ("out/s2/014.html", "https://hadano-med-jrc.jp/files/libs/2955/20251208094007799.pdf"),
        ("out/s2/015.html", "https://hadano-med-jrc.jp/files/libs/2891/202511041621417358.pdf"),
    ],
    "shizuoka": [
        ("out/s3/006.html", "https://www.shizuoka-med.jrc.or.jp/medical/bid/file/3348/bid270.pdf"),
        ("out/s3/007.html", "https://www.shizuoka-med.jrc.or.jp/medical/bid/file/3141/bid260.pdf"),
        ("out/s3/008.html", "https://www.shizuoka-med.jrc.or.jp/medical/bid/file/2913/bid258.pdf"),
    ],
    "hamamatsu": [
        ("out/s2/021.html", "http://www.hamamatsu.jrc.or.jp/media/zuii20240315.pdf"),
    ],
    "susono": [
        ("out/s2/022.html", "https://www.susono-jrc.jp/data/7/87/0087_f20250818.pdf"),
        ("out/s2/023.html", "https://www.susono-jrc.jp/data/7/59/b9ddfc02e3688313d40acfb550114577.pdf"),
    ],
}

for hospital, files in JOBS.items():
    rows = []
    for path, url in files:
        rows.extend(parse_pdf(path, url))
    out_path = f"work/contracts_{hospital}.json"
    old_count = None
    try:
        old_count = len(json.load(open(out_path)))
    except Exception:
        pass
    json.dump(rows, open(out_path, "w"), ensure_ascii=False, indent=1)
    flag = "" if old_count == len(rows) else f"  <-- CHANGED (was {old_count})"
    print(f"{hospital}: {len(rows)} rows{flag}")
