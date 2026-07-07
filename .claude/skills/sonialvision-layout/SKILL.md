---
name: sonialvision-layout
description: 手書きの建築図・間取り図の写真から、SONIALVISION G4 のレイアウト図（装置配置図・システム構成表・環境条件表・表題欄入り）をPDFとDXF（CADデータ）で自動生成する。手書き図面や部屋寸法の写真がアップロードされたとき、「レイアウト図」「配置図」「装置配置」の作成を頼まれたときに使う。
---

# SONIALVISION G4 レイアウト図生成

手書き建築図の写真 → `layout.json`（可変部データ）→ `src/generate.py` → **PDF + DXF + PNGプレビュー** を生成するワークフロー。
固定部（標準装置リスト・環境条件・定型注記・表題欄書式）は `templates/fixed_master.json` にあり、変更不要。

## 手順

### 1. 写真を読む
アップロードされた手書き図面の写真を Read で読み、以下を読み取る:
- 部屋の外形と寸法（**書かれている寸法数字を最優先**。目測でスケールを補完しない）
- 壁厚（不明なら150mm）、天井高（CH表記）
- 建具: ドア位置・幅・開き勝手、引戸、遮蔽窓、点検口
- 部屋名（検査室・操作室）、隣接室ラベル（更衣室・便所等）、分電盤・流し等の設備
- 手書きの特記（例:「ピット幅190mm」）→ `project.special_notes` へ

### 2. layout.json を作る
スキーマは `templates/layout_schema.json`、記入例は `templates/example_layout_td500-22047.json`。

重要ルール:
- 単位はmm、部屋外形は**内法**の頂点列（`outline_mm`）。座標系は自由（検査室左下を原点にすると楽）
- `role: "exam_room"`（検査室）は必須。操作室があれば `role: "control_room"`
- 検査室の `name` は環境条件表・注記3/4にも自動で差し込まれる
- **部分寸法の合計が全体寸法と合うか検算する。** 合わない・読めない場合は推測せずユーザーに確認する
- 表題欄情報（顧客名・図面名称・図面番号・作成日・担当者）が写真から分からなければ AskUserQuestion で確認。
  図面番号が未定なら `DRAFT-<日付>` とする
- `openings.wall_index` は外形頂点列の辺番号（頂点iから頂点i+1の辺が i）。`offset_mm` は辺の始点から

### 3. 装置を配置する
ユーザー指定がなければ以下の初期配置ルールで `equipment_placement` を作る:
- **ZS200_MAIN**（①透視撮影台 2700×1250）: 検査室中央やや奥。周囲に保守スペースを確保（長辺側600mm以上）
- **ZS200_CAB**（②）・**HV_D150BC_40S**（⑫）・**DR_EXAM_CAB**（⑤）: 検査室の壁際に沿わせる（rotation 90で縦置き可）
- **ZS200_LCC**（③）: 撮影台の近く
- **ZS200_RC**(④)・**DR_OPE_CAB**（⑨）: 操作室内。RCは遮蔽窓の前、椅子（フットプリント下側+650mm）が壁に当たらない位置
- モニター類（⑥⑦⑧⑩⑪）は平面図に描かないのが通例（警告が出るが正常）
- ドアの開閉軌跡（幅ぶんの1/4円）と装置を干渉させない

使用可能ブロック名: `ZS200_MAIN, ZS200_CAB, ZS200_LCC, ZS200_RC, DR_EXAM_CAB, DR_OPE_CAB, HV_D150BC_40S, SIDE_TABLE, SIDE_STATION_I3, MONITOR_CART`
（挿入点はフットプリント中心。寸法は `src/blocks.py` の FOOTPRINTS 参照）

オプション装置（サイドテーブル等）が必要なら `optional_equipment` にキーを列挙すると構成表にNo.13以降で自動追記される（キーは `fixed_master.json` の `optional_rows` 参照）。

### 4. 生成する
```bash
pip install -r requirements.txt   # 初回のみ（ezdxf, matplotlib）
python3 src/generate.py <layout.json> -o out/
```
エラー（開口が辺に収まらない等）が出たら layout.json を直して再実行。

### 5. プレビューを自己チェックする
生成された `out/*.png` を Read で見て確認する:
- 装置が壁・ドア開閉軌跡と干渉していないか
- バルーン番号・ラベル・部屋名が重なっていないか（`balloon_offset_mm` や `name_position_mm` で調整可）
- 寸法値が手書き図と一致しているか
問題があれば layout.json を修正して再生成（2〜3回まで）。

### 6. 納品する
`out/<図面番号>.pdf` と `out/<図面番号>.dxf` をユーザーに送る（PNGはプレビュー用）。
読み取りに自信がない箇所・仮置きした値（図面番号・担当者・装置位置）を必ず一覧で報告する。

## 注意
- この図面は「配置案図」であり、最終的な建築検討は別途打合せが必要（免責文言が自動で入る）
- 装置外形は簡略版。正確な外形が必要になったら `src/blocks.py` を実測値に差し替える
- 縮尺は部屋サイズから 1/30 → 1/50 の順で自動選択（`project.scale` で固定も可）
