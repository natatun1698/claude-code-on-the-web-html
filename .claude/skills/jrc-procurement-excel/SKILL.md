---
name: jrc-procurement-excel
description: 赤十字病院（日本赤十字社の病院・施設）の随意契約公表情報からX線装置関連（一般撮影・X線テレビ・血管撮影・外科用イメージ・回診用X線）の契約データを収集し、Excelを作成する。「〇〇赤十字病院の随意契約Excelを作って」「次は〇〇県を」という依頼で使用。全国84病院分の調査実績とツール一式を同梱。
---

# 赤十字病院 随意契約公表情報 → Excel 作成スキル

指定された赤十字病院（複数県まとめてでも可）の公式サイトから「随意契約の公表」（別紙様式
第10-2/第11）PDF・ページを取得し、X線装置関連契約を抽出して病院ごとのExcelと、複数県まとめ
て依頼された場合は地域サマリーExcelを作成する。2026年7月までに全国84病院（北陸3県を除く
全都道府県）を調査済み。同梱の `hospitals_master.json` に病院名・都道府県・調査キーが入って
いるので、続きの県を頼まれたら**まずそこを見て、既出の病院と重複しないか確認すること**。

## このスキルに同梱されているもの

```
scripts/fetch.py                 # フェッチ中継（GitHub Actions側）が呼ぶスクリプト
scripts/parse_pdf2.py            # PDFパーサ（日付セルをアンカーにする方式。最も頑健）
scripts/build_excel.py           # 病院1件分のExcelを作る（カテゴリ判定ロジック本体）
scripts/build_region_summary.py  # 複数病院ぶんの地域サマリーExcelを作る
hospitals_master.json            # 調査済み84病院の一覧（都道府県・キー・0件確定病院フラグ）
```

作業用リポジトリでは `work/contracts_<key>.json`（パース結果）と `work/notes/<key>.txt`
（病院ごとの調査注記、`BUILD_EXCEL_NOTES` で読み込む）が既に84病院分コミットされている
はずなので、同じ病院を再度頼まれた場合はまずそれらを`git log`等で探し、再利用できないか確認
すること（サイトの構造が変わっていなければ再フェッチ不要）。

## 対象装置カテゴリ（5分類）と判定順序（重要）

| 区分 | 主なキーワード（正規化後） |
|---|---|
| 回診用X線装置 | 回診用 / 回診車 / 移動型X線撮影 / ポータブル撮影 / ポータブルX線 |
| 透視撮影台（X線テレビ） | X線テレビ / X線TV / 透視撮影台 / 据置型X線透視 / X線透視撮影装置 / CUEVISTA |
| 血管撮影（CVS、アンギオ） | 血管撮影 / 血管造影 / アンギオ / 循環器X線 / X線循環器 / 心血管X線 / バイプレーン |
| 外科用イメージ（可搬型Cアーム） | 外科用イメージ / 外科用X線 / Cアーム / 移動型汎用X線透視 / 汎用X線透視診断装置 |
| 一般撮影（レントゲン） | 一般撮影 / レントゲン / X線撮影装置 / DR装置 / FPD / FCR / 撮影台 |

**判定は上から順に最初に一致したカテゴリを採用する（`build_excel.py` の `CATEGORIES` の
並び順そのもの）。この順序を変えてはいけない。** 「一般撮影」のキーワード（特に
`X線撮影装置` `FPD`）は他カテゴリの名称にも頻出する汎用語のため、必ず一般撮影を**最後**に
判定すること。過去に2度、この順序が原因で「回診用X線撮影装置」や「血管撮影システム
（FPD搭載）」が誤って一般撮影に分類されるバグが発生し、全region再監査＋再納品が発生した。
新しいキーワードをカテゴリに追加するときは、他カテゴリの語を包含していないか
（例: 「X線撮影装置」は「回診用X線撮影装置」を包含する）を必ず確認する。

製品（購入）契約と保守（保守点検・メンテナンス・修理役務）契約の両方を対象とする。
名称に「保守」「点検」「メンテナンス」「修理」を含む行は保守契約として区分する
（`MAINTENANCE_KW`）。

## 全体の流れ（複数県まとめて依頼された場合）

1. **対象病院を洗い出す。** `hospitals_master.json` に既出なら再利用。無ければ
   WebSearchで「日本赤十字社 〇〇県 病院 一覧」「〇〇県支部について｜日本赤十字社」等を
   検索し、`https://www.jrc.or.jp/chapter/<都道府県ローマ字>/about/facility/` を
   フェッチ中継経由で直接取得するのが最も正確（各支部の公式病院一覧ページ）。
   **病院が0件の県もある**（山形・奈良・宮崎で確認済み）。無いと分かったらそれも
   ユーザー報告に含める。TaskCreateで病院ごとにタスクを作ると進捗管理しやすい。
2. 病院ごとに公式サイトのトップページ（や `/about/nyuusatsu` 等の推測パス）を
   フェッチ中継で取得し、`入札` `契約` `随意契約` を含むリンクを探す。
3. 「随意契約」の一覧・公表ページを特定し、そこから実際のPDF（または後述のHTML直書き）
   リンクを抽出する。
4. PDFをフェッチ中継で取得し、`parse_pdf2.py` でパースする。
5. `build_excel.py` でカテゴリ判定し、病院ごとのExcelを作る。
6. 該当病院すべて終わったら `build_region_summary.py` で地域サマリーExcelを作る。
7. `output/` と `work/contracts_*.json` `work/notes/*.txt` をコミット・pushし、
   SendUserFileで全ファイルを届け、日本語で該当件数と調査範囲・データなし病院の説明を
   要約する。

## 1. フェッチ中継（重要: 直接アクセスは遮断されている）

**この実行環境（Claude Code on the Web のサンドボックス）は外部サイトへの直接アクセスが
遮断されている**（curl はプロキシが CONNECT 403、WebFetch も403）。JRC系サイトは加えて
海外IP/botを遮断していることがある。よって GitHub Actions をフェッチ中継として使う。

リポジトリ直下に `fetch.py`（このスキルの `scripts/fetch.py` と同一）と
`.github/workflows/fetch.yml` を用意する。**`fetch.yml` の `branches:` は必ず現在の
作業ブランチ名に書き換えること**（別ブランチ用のワークフローのままだと動かない）:

```yaml
name: fetch
on:
  push:
    branches: ['<現在の作業ブランチ名>']
    paths: ['request/**']
permissions:
  contents: write
jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Fetch pages
        run: python3 fetch.py
      - name: Push results
        run: |
          BATCH=$(cat request/batch.txt 2>/dev/null || echo batch)
          git config user.name "fetch-bot"
          git config user.email "fetch-bot@users.noreply.github.com"
          git checkout -b "results-$BATCH"
          git add -A out
          git commit -m "results $BATCH"
          git push -f origin "results-$BATCH"
```

使い方（1バッチ = 1コミット、10〜40件のURLをまとめて1バッチにするのが効率的）:

```bash
printf '<URL1>\n<URL2>\n' > request/urls.txt
echo -n <バッチ名> > request/batch.txt        # 例: b1, b2, ky1, sk4 ...
git add request out && git commit -m "queue <バッチ名> batch" && git push
```

その後、`results-<バッチ名>` ブランチが現れるまで待つ（20秒〜数分）。**Monitor ツールで
バックグラウンド待機し、ポーリングでターンを消費しないこと**:

```bash
until git ls-remote origin results-<バッチ名> 2>/dev/null | grep -q .; do sleep 5; done
```

取得後:
```bash
git fetch origin results-<バッチ名>
git checkout origin/results-<バッチ名> -- out/<バッチ名>
cat out/<バッチ名>/INDEX.txt   # 000.html=生データ(PDFもここに同じ拡張子で入る), 000.txt=テキスト+リンク一覧
```

### URLエンコードに関する重要な注意

`request/urls.txt` に**非ASCII文字（日本語ファイル名等）を含むURLをそのまま書くと
`UnicodeEncodeError` で失敗する**。必ずパス部分を `urllib.parse.quote` してから書く
（クエリ文字列 `?id=123` のような部分は `quote` すると `?` や `=` まで壊れるので、
`?` より前だけをエンコードすること）。

```python
import urllib.parse
scheme_sep = u.find('://')
prefix, rest = u[:scheme_sep+3], u[scheme_sep+3:]
host, sep, path = rest.partition('/')
if sep:
    path_part, qsep, query = path.partition('?')
    path = '/' + urllib.parse.quote(path_part) + (('?' + query) if qsep else '')
```

### stale な results ブランチに注意

バッチ名（`b1`, `t1` 等の短い名前）が過去の無関係セッションの `results-<名前>` ブランチ
と衝突することがある。**必ず fetch 前後でコミットハッシュが変化したことを確認するか、
Monitor で「ブランチが新規に現れる」ことを待つこと**（既存判定だけで信じない）。

## 2. 随意契約ページ・PDFの見つけ方（病院ごとにパターンが違う）

実際に観測されたページパターン（多い順ではなく網羅的に）:

- **年度別/月別/四半期別PDFの一覧ページ**（最も一般的）。ラベルと `.pdf` へのリンクが
  並んでいる。全期間分あることもあれば直近数年のみのこともある。**調査範囲は直近2〜3
  年度分で十分**（それ以前は他病院との一貫性のため省略してよいが、全期間が少数
  （10件未満）なら全部取ってよい）。
- **累積1ファイル形式**（置戸・小清水赤十字病院など）: 「随意契約の公表」PDFが1本だけ
  あり、過去分も含めて随時追記されていく。更新日が古い（数年前で止まっている）ことも
  あるので、その旨を notes に書く。
- **個別お知らせ形式**（岡山赤十字病院など）: 1公示＝1PDFで、トップの入札ページに
  「随意契約の公表（令和8年6月11日）」のような個別記事が並ぶ。
- **HTML直書き形式**（浦河赤十字病院で確認、極めて稀）: PDFではなくページ本文に
  「随意契約担当部課の所在地／随意契約を締結した日／…」という定型ラベルの繰り返しで
  直接記載されている。この場合 `parse_pdf2.py` は使えないので、`.txt` を正規表現で
  パースする専用コードをその場で書く（`scripts/parse_pdf2.py` は使わず、HTMLをタグ除去
  してラベルの並びをブロック単位で拾う。過去の実装例は git 履歴の
  `work/parse_hokkaido_shikoku.py` の `parse_urakawa_html` を参照）。
- **一般競争入札のみで随意契約の公表が存在しない病院**もある（高松・高知赤十字病院で
  確認）。ページ自体はあるが「随意契約」の文字列が一切出てこない場合は、それ以上探して
  も見つからないことが多い。WebSearchで `<病院名> 随意契約` を1回試し、それでも
  見つからなければ「調査対象データなし」として記録してよい。
- **サイト自体が直接アクセス不可**（403・タイムアウト等）な場合、まず `www.` の有無や
  `http`/`https` を入れ替えて再試行する（`kagoshima-med.jrc.or.jp` 等、`www.`必須の
  サイトが複数あった）。それでもダメなら Wayback Machine を中継経由で試す:
  - 履歴一覧: `https://web.archive.org/cdx/search/cdx?url=<ページURL>&output=json&limit=200`
  - スナップショット: `https://web.archive.org/web/<timestamp>/<ページURL>`
  Wayback経由でも取れない場合（姫路赤十字病院で発生）、そこで諦めて「調査対象データ
  なし」として理由を notes に詳しく書く。**病院を黙って一覧から外さないこと。**

## 3. PDFの解析（`parse_pdf2.py`）

`pip install openpyxl pdfplumber`（環境に無ければ）。

日赤の別紙様式第10-2/第11は病院により列構成が異なる（No.列・数量列の有無等）ため、
`parse_pdf2.py` は**列数ではなく「締結日」セルを正規表現アンカーとして検出し、その前後の
セルを担当課／相手方／金額／理由として切り出す**方式を採る（列数ベースの旧実装
`parse_pdf.py` は特定の病院で名称と数量を取り違える致命的なバグがあったため廃止）。

```bash
python3 scripts/parse_pdf2.py <PDFファイル> <取得元URL> <出力json>
```

複数PDFを1病院分としてまとめてパースする場合は、病院キーごとに `(path, url)` の
リストを作り、`parse_pdf` をループで呼んで1つのJSONにまとめるスクリプトをその都度書く
（過去の実装例: `work/parse_kyushu.py` 等。使い捨てでよい）。

パース後は**必ず先頭数件を目視確認**し、名称・数量・担当課・日付・金額の列がずれて
いないか、名称が異常に短く切れていないかを確認すること。

## 4. Excel生成（`build_excel.py` / `build_region_summary.py`）

病院1件:
```bash
BUILD_EXCEL_NOTES=work/notes/<key>.txt python3 scripts/build_excel.py \
  "<病院名>" work/contracts_<key>.json "output/<病院名>_随意契約_X線関連.xlsx"
```

`BUILD_EXCEL_NOTES` は「・」で始まる注記を1行1件書いたテキストファイル。調査したデータ
ソース（URL・年度範囲）や、データなし病院での調査経緯（どこを確認してどう判断したか）を
必ず書く。既存病院の `work/notes/<key>.txt` を書式の参考にすること。

該当データが無い病院も **`echo '[]' > work/contracts_<key>.json` として必ずExcelを作る**
（0件のまま一覧から省略しない）。

複数病院まとめて地域サマリー:
```bash
python3 scripts/build_region_summary.py "<地域名>" <hospitals.json> \
  "output/<地域名>_赤十字病院_随意契約_X線関連_サマリー.xlsx" work
```
`hospitals.json` の形式は `hospitals_master.json` の各リージョン配列と同じ
（`pref`/`key`/`name`、任意で `note`）。新しく調べた病院を `hospitals_master.json` の
該当リージョン（無ければ新規キーを追加）に追記しておくと、次回セッションでの重複調査を
防げる。

出力Excelの列構成（病院ごとのシート1「X線装置関連随意契約」）:
物品などまたは役務の名称 / 数量 / 随意契約担当課の名称及び所在地 / 随意契約を締結した日 /
随意契約の相手方の氏名及び住所 / 随意契約に係る契約金額（数値） / URL /
区分（装置カテゴリ） / 製品・保守 / 備考。シート2「調査サマリー」にカテゴリ別件数と
データソース一覧、備考を記載。

## 5. 納品

- `output/*.xlsx` と `work/contracts_*.json` `work/notes/*.txt`、および
  `hospitals_master.json` の更新をコミット・push。
- `out/<バッチ名>/` の生データ（HTML/PDF/txt）もコミットに含めたままでよい（トレース用）。
- SendUserFileで病院ごとのExcel＋地域サマリーExcelを全部届ける。
- ユーザーへの返信は日本語で、病院ごとのX線関連該当件数、調査範囲（年度等）、
  データなし病院とその理由を簡潔にまとめる。カテゴリ判定バグを直した場合はその旨と
  影響範囲（再分類しただけで件数自体は変わっていない、等）も明記する。

## 既知の注意点まとめ（トラブルシュート）

- fetch.py はUser-Agentを偽装しSSL検証を無効化しているが、それでも403/タイムアウトが
  出るサイトがある（`www.`の有無、http/https、海外IP拒否など）。1回失敗しても病院を
  諦めず別パターンを試すこと。
- 全角数字（１２３）で書かれた金額はExcel生成時に数値変換されず文字列のまま残る
  （`build_excel.py` の金額変換は半角0-9のみ対象）。実害は小さいが、気になる場合は
  `re.sub` の文字クラスにNFKC正規化後の判定を挟むよう改修してもよい。
- 病院サイトの「入札」ページと「随意契約」は別物であることが多い（前者は一般競争入札の
  公告、後者が本来の調査対象）。「入札」しか無いページで諦めず、「随意契約」の文字列が
  ページ全体に本当に0件かをgrepで確認すること。
