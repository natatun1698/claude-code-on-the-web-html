# SONIALVISION G4 レイアウト図 自動生成

手書きの建築図（部屋寸法・壁・建具が書かれた写真）から、島津製作所標準テンプレートに沿った
レイアウト図（装置配置図・システム構成表・環境条件表・表題欄入り）を **PDF + DXF（CADデータ）** で生成する。

## 使い方（Claude Code）

1. このリポジトリを開いた Claude Code セッションに**手書き図面の写真を添付**して
   「レイアウト図を作って」と依頼する
2. `sonialvision-layout` スキル（`.claude/skills/sonialvision-layout/SKILL.md`）が起動し、
   写真の読み取り → `layout.json` 作成 → 確認 → 生成 まで自動で進む
3. `out/<図面番号>.pdf` と `out/<図面番号>.dxf` が納品される

## 手動実行

```bash
pip install -r requirements.txt
python3 src/generate.py templates/example_layout_td500-22047.json -o out/
```

## 構成

| パス | 内容 |
|------|------|
| `.claude/skills/sonialvision-layout/` | Claude Code スキル（写真→図面のワークフロー定義） |
| `templates/fixed_master.json` | 固定部マスタ（標準装置リスト・環境条件・定型注記・表題欄） |
| `templates/layout_schema.json` | 可変部データ（layout.json）のJSONスキーマ |
| `templates/example_layout_td500-22047.json` | 見本図面の書き起こしサンプル |
| `src/generate.py` | 生成CLI（検証→DXF→PDF/PNG） |
| `src/plandraw.py` | 平面図描画（壁・建具・寸法・バルーン） |
| `src/sheetdraw.py` | A3版下描画（表・注記・表題欄） |
| `src/blocks.py` | 装置外形ブロック定義（簡略版） |
| `docs/` | テンプレート解析・実装方針ドキュメント |

## 出力例

- DXF: モデル空間に実寸(mm)の平面図、ペーパー空間（Layout1）にA3横の完成シート。
  AutoCAD / JW-CAD（DXF読込）/ BricsCAD で編集可能
- PDF: 同一データからのA3横レンダリング（日本語フォント埋め込み）
