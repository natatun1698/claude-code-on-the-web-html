# 実装方針: 手書き建築図 → レイアウト図（PDF + CAD）自動生成

## 全体フロー

```
[手書き建築図の写真]
        │  1. 前処理（OpenCV）
        ▼
[補正済み画像]
        │  2. 構造化抽出（Claude API vision + 幾何検証）
        ▼
[layout.json（可変部データ）] ←── 3. レビューUI（ブラウザ）で人が確認・修正
        │  4. 装置自動配置（ルールベース初期配置 + 手動調整）
        ▼
[完成 layout.json] + [fixed_master.json（固定部データ）]
        │  5. 図面生成（ezdxf）
        ▼
[DXF（CADデータ）] ──6. 同一DXFからレンダリング──▶ [A3横 PDF]
```

単一ソース原則: **DXFを唯一の図面ソース**とし、PDFはそのレンダリング結果とすることで
「PDFとCADの内容が食い違う」事故を構造的に防ぐ。

## 使用ライブラリ

| 工程 | ライブラリ | 役割 |
|------|-----------|------|
| 前処理 | OpenCV (opencv-python) | 射影補正（台形補正）、傾き補正、二値化、ノイズ除去 |
| 抽出 | anthropic SDK（Python）+ `claude-opus-4-8` | 手書き図から部屋寸法・壁・建具・ラベルを構造化JSON抽出（vision + structured outputs） |
| 幾何補助 | OpenCV（LSD/HoughLinesP）+ shapely | 壁線分検出でLLM出力のトポロジ検証、ポリゴン演算 |
| スキーマ | pydantic | layout.json のバリデーション（`client.messages.parse()` にそのまま渡せる） |
| CAD出力 | ezdxf | DXF生成（レイヤ・ブロック・寸法・表・表題欄）。AutoCAD/JW-CAD/BricsCAD で開ける R2010〜R2018 形式 |
| PDF出力 | ezdxf drawing add-on（matplotlib backend） | 同一DXFをA3横PDFにレンダリング。日本語は Noto Sans CJK JP を埋め込み |
| API/UI | FastAPI + 素のHTML/SVG（またはReact） | アップロード→抽出→レビュー→出力のWebフロー |

## 各工程の詳細

### 1. 前処理（OpenCV）
- 写真の4隅検出→`cv2.getPerspectiveTransform` で正対化
- グレースケール化・適応的二値化・小ノイズ除去
- 目的は「LLMに読みやすい画像を渡す」ことなので、線の完全なベクトル化はここではしない

### 2. 構造化抽出（Claude API）
- モデル: `claude-opus-4-8`（vision対応、adaptive thinking）。抽出精度が要件を満たさない場合のみ `claude-fable-5` を検討
- `client.messages.parse()` + pydanticモデルで **スキーマ保証されたJSON** を直接取得:

```python
import anthropic, base64
from pydantic import BaseModel

class Opening(BaseModel):
    kind: str          # "swing_door" | "sliding_door" | "window" | "hatch"
    wall_index: int    # 属する壁（外形ポリゴンの辺番号）
    offset_mm: int     # 辺始点からの距離
    width_mm: int
    swing: str | None  # "in_left" | "in_right" | "out_left" | "out_right"

class RoomExtract(BaseModel):
    room_name: str
    outline_mm: list[tuple[int, int]]   # 内法の頂点列（時計回り）
    wall_thickness_mm: int | None
    ceiling_height_mm: int | None
    openings: list[Opening]
    adjacent_labels: list[str]          # 操作室・更衣室・便所 など
    dimension_notes: list[str]          # 読み取った寸法値の生テキスト（検証用）
    handwritten_notes: list[str]        # 「ピット幅190mm」等の特記

client = anthropic.Anthropic()
img = base64.standard_b64encode(open("preprocessed.png", "rb").read()).decode()
resp = client.messages.parse(
    model="claude-opus-4-8",
    max_tokens=16000,
    thinking={"type": "adaptive"},
    messages=[{"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img}},
        {"type": "text", "text": EXTRACTION_PROMPT},  # 寸法はmm、内法基準、等の指示
    ]}],
    output_format=RoomExtract,
)
room = resp.parsed_output
```

- **幾何検証**: 「部分寸法の合計 = 全体寸法」「ポリゴンが閉じている」「建具が壁の範囲内」を
  shapelyでチェックし、不整合はレビューUIで赤表示。OpenCVの線分検出結果と外形の照合も補助に使う
- 手書き図の読み取りは100%にはならない前提で、**必ず人のレビュー工程（工程3）を挟む**のが設計の要

### 3. レビューUI
- ブラウザで元写真と抽出結果（SVG描画）をオーバーレイ表示
- 寸法値・建具位置・部屋名をフォーム/ドラッグで修正 → layout.json 確定

### 4. 装置自動配置
- ルールベースの初期配置: ZS-200本体は部屋中央長辺沿い・保守エリア確保、
  制御/収集キャビネットは壁際、遠隔操作卓は操作室の遮蔽窓前、高電圧装置は壁際 等
- 干渉チェック（装置外形+保守エリア vs 壁・建具開閉軌跡）
- レビューUI上でドラッグ調整可能にする

### 5. DXF生成（ezdxf）
- レイヤ構成: `WALL`（壁）/ `FITTING`（建具）/ `EQUIP`（装置ブロックINSERT）/ `BALLOON`（丸数字）/ `DIM`（寸法）/ `TEXT` / `TABLE`（構成表・環境条件）/ `FRAME`（枠・表題欄）
- 装置外形は `fixed_master.json` に対応するブロック定義ライブラリ（equipment_blocks.dxf）を一度整備して INSERT
- モデル空間に実寸（mm）で作図し、ペーパー空間（A3レイアウト）にビューポート（1/30 or 1/50 自動選択）+ 表・表題欄を配置
- 表題欄・構成表・環境条件表・注記は fixed_master.json + layout.json から文字列を流し込み
- 湿度チャート図は小さな固定ブロックとして用意
- JW-CAD向けには DXF (R12/2010) でそのまま受け渡し可能

### 6. PDF生成
- `ezdxf.addons.drawing`（matplotlib backend）でペーパー空間レイアウトをA3横PDFに描画
- 日本語フォント: Noto Sans CJK JP を matplotlib に登録して埋め込み
- 出力: `{図面番号}.pdf` + `{図面番号}.dxf` の2点セット

## リポジトリ構成（実装フェーズ）

```
templates/
  fixed_master.json        # 固定部マスタ（作成済み）
  layout_schema.json       # 可変部スキーマ（作成済み）
  equipment_blocks.dxf     # 装置外形ブロックライブラリ（要作成: 見本PDFからトレース）
src/
  preprocess.py            # OpenCV前処理
  extract.py               # Claude API抽出 + 幾何検証
  placement.py             # 装置自動配置
  render_dxf.py            # ezdxf図面生成
  render_pdf.py            # PDF出力
  server.py                # FastAPI（アップロード/レビュー/出力）
web/                       # レビューUI
```

## 段階的な進め方（推奨）

1. **M1**: fixed_master.json + layout.json（手入力）→ DXF/PDF 出力の版下再現。見本#1と目視比較して版下品質を確定
2. **M2**: 手書き写真 → Claude抽出 → レビューUI。抽出精度を実案件写真で評価
3. **M3**: 装置自動配置ルール + 干渉チェック
4. **M4**: 一気通貫のWebアプリ化・図番採番・改訂管理

版下（M1）を先に固めるのが重要。抽出精度の議論は出力が正しく描ける状態になってからの方が速い。
