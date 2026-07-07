#!/usr/bin/env python3
"""レイアウト図生成 CLI。

    python3 src/generate.py <layout.json> [-o outdir] [--master templates/fixed_master.json]

layout.json（可変部）と fixed_master.json（固定部）から
{図面番号}.dxf / .pdf / .png（プレビュー）を生成する。
"""

import argparse
import json
import math
import sys
from pathlib import Path

import ezdxf
from ezdxf.addons.drawing import Frontend, RenderContext
from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

sys.path.insert(0, str(Path(__file__).parent))

import blocks  # noqa: E402
import plandraw  # noqa: E402
import sheetdraw  # noqa: E402

JP_FONT_CANDIDATES = ["ipag.ttf", "NotoSansCJKjp-Regular.otf", "NotoSansCJK-Regular.ttc", "msgothic.ttc"]


# ---------------------------------------------------------------- validation

def validate(layout, master):
    errors, warnings = [], []
    rooms = layout.get("rooms", [])
    if not any(r.get("role") == "exam_room" for r in rooms):
        errors.append("rooms に role=exam_room がありません")
    for r in rooms:
        pts = r.get("outline_mm", [])
        if len(pts) < 4:
            errors.append(f"部屋 {r.get('name')}: outline_mm の頂点が4点未満です")
            continue
        n = len(pts)
        for op in r.get("openings", []):
            i = op["wall_index"]
            if not (0 <= i < n):
                errors.append(f"部屋 {r.get('name')}: wall_index {i} が範囲外です")
                continue
            a, b = pts[i], pts[(i + 1) % n]
            edge_len = math.hypot(b[0] - a[0], b[1] - a[1])
            if op["offset_mm"] + op["width_mm"] > edge_len + 1:
                errors.append(
                    f"部屋 {r.get('name')}: 辺{i}(長さ{edge_len:.0f})に開口 "
                    f"offset={op['offset_mm']}+width={op['width_mm']} が収まりません")

    rows = sheetdraw.build_system_rows(master, layout)
    table_nos = {r["no"] for r in rows if r.get("no")}
    for item in layout.get("equipment_placement", []):
        if item["no"] not in table_nos:
            warnings.append(f"バルーンNo.{item['no']} がシステム構成表にありません")
        if item["block"] not in blocks.FOOTPRINTS:
            errors.append(f"未定義のブロック名: {item['block']}（使用可能: {', '.join(blocks.FOOTPRINTS)}）")
    placed = {i["no"] for i in layout.get("equipment_placement", [])}
    unplaced = sorted(no for no in table_nos if no not in placed)
    if unplaced:
        warnings.append(f"構成表No. {unplaced} は平面図に未配置です（モニター類は未記載が通例）")
    return errors, warnings


# ---------------------------------------------------------------- scale

def choose_scale(layout, master):
    if layout["project"].get("scale"):
        return int(layout["project"]["scale"].split("/")[1])
    x0, y0, x1, y1 = plandraw.plan_bbox(layout)
    margin = 2600  # 寸法線・バルーンぶんの余白
    need_w, need_h = (x1 - x0) + 2 * margin, (y1 - y0) + 2 * margin
    px0, py0, px1, py1 = sheetdraw.PLAN_AREA
    area_w, area_h = px1 - px0, py1 - py0
    for denom_str in master["drawing_conventions"]["allowed_scales"]:
        denom = int(denom_str.split("/")[1])
        if need_w / denom <= area_w and need_h / denom <= area_h:
            return denom
    for denom in (75, 100, 150, 200):
        if need_w / denom <= area_w and need_h / denom <= area_h:
            return denom
    return 200


# ---------------------------------------------------------------- build

def pick_jp_font():
    from ezdxf.fonts import fonts
    for name in JP_FONT_CANDIDATES:
        if fonts.font_manager.has_font(name):
            return name
    return "ipag.ttf"


def build_document(layout, master):
    doc = ezdxf.new("R2010", setup=True)
    font = pick_jp_font()
    doc.styles.add("JP", font=font)
    for layer in ("WALL", "FITTING", "EQUIP", "BALLOON", "DIM", "PLAN_TEXT",
                  "FRAME", "TABLE", "SHEET_TEXT"):
        doc.layers.add(layer)

    denom = choose_scale(layout, master)
    doc.dimstyles.new("PLAN", dxfattribs={
        "dimtxt": 2.6, "dimasz": 1.4, "dimexe": 1.0, "dimexo": 1.0,
        "dimgap": 0.7, "dimtad": 1, "dimscale": denom, "dimtxsty": "JP",
        "dimblk": "ARCHTICK", "dimclrt": 0, "dimdec": 0,
    })

    blocks.register_blocks(doc)
    msp = doc.modelspace()

    exam_room = next(r for r in layout["rooms"] if r["role"] == "exam_room")
    for room in layout["rooms"]:
        plandraw.draw_room_walls(msp, room)
        plandraw.draw_room_annotation(msp, room, denom)
    plandraw.draw_room_dimensions(msp, exam_room, denom)
    plandraw.draw_equipment(msp, layout.get("equipment_placement", []), denom, layout["rooms"])

    # --- ペーパー空間（A3横シート）---
    psp = doc.layout("Layout1")
    psp.page_setup(size=(420, 297), margins=(0, 0, 0, 0))

    sheetdraw.draw_frame_and_logo(psp, master)
    sheetdraw.draw_title(psp, master)
    rows = sheetdraw.build_system_rows(master, layout)
    y = sheetdraw.draw_system_table(psp, master, rows, y_top=268)
    y = sheetdraw.draw_env_table(psp, master, exam_room["name"], y_top=y - 8)
    sheetdraw.draw_notes(psp, master, layout, exam_room["name"], y_top=y - 5)
    sheetdraw.draw_scope(psp, master)
    sheetdraw.draw_revision_history(psp, layout)
    sheetdraw.draw_disclaimer(psp, master, layout)
    scale_str = f"1/{denom}"
    sheetdraw.draw_title_block(psp, master, layout, scale_str)
    variant = "様式4A" if layout["project"].get("revision_history") else "様式3A"
    sheetdraw.draw_form_number(psp, master, variant)

    # 平面図ビューポート
    x0, y0, x1, y1 = plandraw.plan_bbox(layout)
    px0, py0, px1, py1 = sheetdraw.PLAN_AREA
    vp_w, vp_h = px1 - px0, py1 - py0
    psp.add_viewport(
        center=((px0 + px1) / 2, (py0 + py1) / 2),
        size=(vp_w, vp_h),
        view_center_point=((x0 + x1) / 2, (y0 + y1) / 2 - 0.5 * denom),
        view_height=vp_h * denom,
    )
    return doc, denom


# ---------------------------------------------------------------- render

def render_pdf_png(doc, pdf_path, png_path):
    psp = doc.layout("Layout1")
    fig = plt.figure(figsize=(420 / 25.4, 297 / 25.4))
    ax = fig.add_axes([0, 0, 1, 1])
    ctx = RenderContext(doc)
    backend = MatplotlibBackend(ax)
    Frontend(ctx, backend).draw_layout(psp, finalize=True)
    # A3横の用紙座標に固定（draw_layoutがfigsize/軸範囲を変えるため復元する）
    ax.set_xlim(0, 420)
    ax.set_ylim(0, 297)
    ax.set_aspect("equal")
    ax.set_axis_off()
    fig.set_size_inches(420 / 25.4, 297 / 25.4, forward=True)
    fig.savefig(pdf_path, dpi=300)
    fig.savefig(png_path, dpi=150)
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser(description="SONIALVISION G4 レイアウト図生成")
    ap.add_argument("layout", help="layout.json（可変部データ）")
    ap.add_argument("-o", "--outdir", default="out", help="出力ディレクトリ（既定: out）")
    ap.add_argument("--master", default=str(Path(__file__).parent.parent / "templates" / "fixed_master.json"))
    ap.add_argument("--check", action="store_true", help="検証のみ実行")
    args = ap.parse_args()

    layout = json.loads(Path(args.layout).read_text(encoding="utf-8"))
    master = json.loads(Path(args.master).read_text(encoding="utf-8"))

    errors, warnings = validate(layout, master)
    for w in warnings:
        print(f"[警告] {w}")
    if errors:
        for e in errors:
            print(f"[エラー] {e}")
        sys.exit(1)
    if args.check:
        print("検証OK")
        return

    doc, denom = build_document(layout, master)

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    stem = layout["project"]["drawing_number"].replace("/", "-")
    dxf_path = outdir / f"{stem}.dxf"
    pdf_path = outdir / f"{stem}.pdf"
    png_path = outdir / f"{stem}.png"

    doc.saveas(dxf_path)
    render_pdf_png(doc, pdf_path, png_path)
    print(f"縮尺: 1/{denom}")
    print(f"出力: {dxf_path}")
    print(f"出力: {pdf_path}")
    print(f"出力: {png_path} (プレビュー)")


if __name__ == "__main__":
    main()
