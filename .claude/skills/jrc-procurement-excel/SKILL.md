---
name: jrc-procurement-excel
description: 赤十字病院（日本赤十字社の病院・施設）の随意契約公表情報からX線装置関連（一般撮影・X線テレビ・血管撮影・外科用イメージ・回診用X線）の契約データを収集し、Excelを作成する。「〇〇赤十字病院の随意契約Excelを作って」という依頼で使用。
---

# 赤十字病院 随意契約公表情報 → Excel 作成スキル

指定された赤十字病院の公式サイトから「随意契約の公表」（別紙様式第11）PDF を取得し、
X線装置関連契約を抽出して Excel を作成する。

## 対象装置カテゴリ（5分類）

| 区分 | 主なキーワード（正規化後） |
|---|---|
| 一般撮影（レントゲン） | 一般撮影 / レントゲン / X線撮影装置 / DR / FPD / デジタルラジオグラフィ / 撮影台 |
| 透視撮影台（X線テレビ） | X線テレビ / X線TV / 透視撮影 / 透視診断装置（据置型） |
| 血管撮影（CVS、アンギオ） | 血管撮影 / 血管造影 / アンギオ / 循環器X線 / 心血管X線 / バイプレーン |
| 外科用イメージ（可搬型Cアーム） | 外科用イメージ / Cアーム / 移動型汎用X線透視診断装置 |
| 回診用X線装置 | 回診用 / 回診車 / 移動型X線撮影装置 / ポータブル撮影 |

製品（購入）契約と保守（保守点検・メンテナンス・修理役務）契約の両方を対象とする。
名称に「保守」「点検」「メンテナンス」「修理」を含む行は保守契約として区分する。

## 手順

### 1. 病院サイトと随意契約ページを特定する

WebSearch で `〇〇赤十字病院 随意契約 公表` や `〇〇赤十字病院 入札` を検索。
日赤本社ページ https://www.jrc.or.jp/advertise/zuii/ には「各施設のホームページを参照」とある。
病院ごとにページ名が異なる（例: 「入札に関するお知らせ」「契約締結状況（随意契約の公表）」「調達情報」）。

- 徳島赤十字病院: https://www.tokushima-med.jrc.or.jp/medicalPersonnel/bidInformation/
  （「随意契約に関する公示」PDF: /file/attachment/11106.pdf ※2024年度分、69件）
- 秦野赤十字病院: https://hadano-med-jrc.jp/pages/135/

### 2. ページ・PDFを取得する（重要: フェッチ中継を使う）

**この実行環境（Claude Code on the Web のサンドボックス）は外部サイトへの直接アクセスが
遮断されている**（curl はプロキシが CONNECT 403、WebFetch も example.com 含め 403）。
JRC系サイトは加えて海外IP/botを遮断している。よって GitHub Actions をフェッチ中継として使う。

リポジトリに `fetch.py` と `.github/workflows/fetch.yml` を用意する（このリポジトリの
git 履歴 `git log --all --oneline -- fetch.py` から復元可能。ワークフローの
`branches:` は**現在の作業ブランチ名**に書き換えること）。

使い方（1バッチ = 1コミット）:

```bash
printf '<URL1>\n<URL2>\n' > request/urls.txt
echo <バッチ名> > request/batch.txt        # 例: h1, h2...
git add request && git commit -m "Fetch batch <バッチ名>" && git push
# Actions が走り、結果が results-<バッチ名> ブランチに push される（20〜60秒）
until git fetch -q origin results-<バッチ名> 2>/dev/null; do sleep 6; done
git checkout origin/results-<バッチ名> -- out/
cat out/<バッチ名>/INDEX.txt   # 000.html=生データ(PDFもここ), 000.txt=テキスト+リンク一覧
```

バッチの典型的な流れ:
1. トップページ・入札/調達ページを取得 → `out/*/NNN.txt` 末尾の `==== LINKS ====` から
   「随意契約」を含むリンク（PDF）を探す
2. 随意契約PDFを取得（`000.html` がPDF本体。`mv 000.html xxx.pdf`）
3. 過去年度分が必要なら Wayback Machine を中継経由で使う:
   - 履歴一覧: `https://web.archive.org/cdx/search/cdx?url=<ページURL>&output=json&limit=200`
   - スナップショット: `https://web.archive.org/web/<timestamp>/<ページURL>`
   - アーカイブ済みPDF: `https://web.archive.org/web/<timestamp>/<PDFのURL>`

### 3. PDFを解析する

`pip install openpyxl pypdf pdfplumber cffi`（cffi は cryptography の修復に必要）。

別紙様式第11 の列構成（日赤共通様式）:
`No / 物品等又は役務の名称 / 数量 / 随意契約担当部課の名称及び所在地 / 随意契約を締結した日 /
随意契約の相手方の氏名及び住所 / 随意契約に係る契約金額 / 随意契約によることとした理由 / 備考`

`work/parse_pdf.py` を使う（pdfplumber の `extract_tables()` でセル単位に取れる。
セル内改行は連結する）。出力は JSON。病院によっては Excel/HTML表で公表している場合も
あるので、その場合は形式に合わせて読み替える。

### 4. キーワードで対象行を抽出し Excel を生成する

`work/build_excel.py` を使う:

```bash
python3 work/build_excel.py work/contracts_*.json output/<病院名>_随意契約_X線関連.xlsx
```

出力Excelの列（ユーザー指定の7列＋補助2列）:
1. 物品などまたは役務の名称
2. 数量
3. 随意契約担当課の名称及び所在地
4. 随意契約を締結した日
5. 随意契約の相手方の氏名及び住所
6. 随意契約に係る契約金額（数値、カンマ書式）
7. URL（データの取得元PDF/ページのURL。Waybackから取った場合は元サイトのURLを記載し、
   備考にアーカイブURLを併記してもよい）
補助列: 区分（装置カテゴリ）、製品/保守

**注意**: キーワード判定は取りこぼしがあり得るため、抽出前に全行リスト
（No/名称/日付/金額）を目視確認し、X線関連の行を見落としていないか確認すること。
半角ｶﾅ（ﾚﾝﾄｹﾞﾝ, ｱﾝｷﾞｵ, Cｱｰﾑ等）は NFKC 正規化してから照合する。

### 5. 成果物のコミットと後片付け

- Excel と JSON を `output/` にコミットして push する。
- 一時的な `request/` の変更や `out/` の生データはコミットに含めたままでよいが、
  作業完了後に `results-*` ブランチは削除してよい
  （`git push origin --delete results-<バッチ名>`）。
- 該当契約が0件の年度もあり得る。その場合も「調査した年度・PDF・0件だった事実」を
  ユーザーへの報告に含めること。

## 実績（参考）

- 徳島赤十字病院 2024年度PDF（11106.pdf）: 全69件中、X線関連は
  「移動型汎用X線透視診断装置」×2（2024/9/26、8,800,000円 / 16,485,000円、(株)大一器械）
  のみ。一般撮影・血管撮影・回診用・保守は該当なし → 過去年度PDFを Wayback で遡って補完する。
