"""A3横シート（ペーパー空間・mm）の版下描画。

固定部（タイトル・システム構成表・環境条件・注記・施工範囲・免責・表題欄）を
fixed_master.json + layout.json の値で描く。座標系は左下原点、単位mm。
"""

from ezdxf.enums import TextEntityAlignment

LAYER_FRAME = "FRAME"
LAYER_TABLE = "TABLE"
LAYER_SHEET_TEXT = "SHEET_TEXT"

# 右カラム（表・注記）の左右端
RX0, RX1 = 258.0, 413.0
# 平面図ビューポート領域
PLAN_AREA = (10.0, 44.0, 252.0, 278.0)  # x0, y0, x1, y1


def _text(psp, s, pos, h=3.0, align=TextEntityAlignment.LEFT, layer=LAYER_SHEET_TEXT):
    t = psp.add_text(s, dxfattribs={"style": "JP", "height": h, "layer": layer})
    t.set_placement(pos, align=align)
    return t


def _rect(psp, x0, y0, x1, y1, layer=LAYER_TABLE):
    psp.add_lwpolyline([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True,
                       dxfattribs={"layer": layer})


def wrap_jp(s, width):
    """全角文字ベースの単純折り返し（半角は0.5文字換算）。"""
    lines, cur, cur_w = [], "", 0.0
    for ch in s:
        w = 0.5 if ord(ch) < 0x100 else 1.0
        if cur_w + w > width:
            lines.append(cur)
            cur, cur_w = "", 0.0
        cur += ch
        cur_w += w
    if cur:
        lines.append(cur)
    return lines


# ---------------------------------------------------------------- parts

def draw_frame_and_logo(psp, master):
    _rect(psp, 5, 5, 415, 292, layer=LAYER_FRAME)
    # SHIMADZUロゴ（テキスト表現＋丸十字マーク）
    psp.add_circle((13, 285.5), 3, dxfattribs={"layer": LAYER_FRAME})
    psp.add_line((10, 285.5), (16, 285.5), dxfattribs={"layer": LAYER_FRAME})
    psp.add_line((13, 282.5), (13, 288.5), dxfattribs={"layer": LAYER_FRAME})
    _text(psp, master["sheet"]["logo_top_left"], (18, 283.6), h=5.2)


def draw_title(psp, master):
    cx = (RX0 + RX1) / 2
    _text(psp, master["title"]["line1"], (cx, 285), h=4.5, align=TextEntityAlignment.MIDDLE_CENTER)
    _text(psp, master["title"]["line2"], (cx, 277), h=6.5, align=TextEntityAlignment.MIDDLE_CENTER)


def build_system_rows(master, layout):
    rows = [dict(r) for r in master["system_table"]["standard_rows"]]
    next_no = max(r["no"] for r in rows if r["no"]) + 1
    opt_master = {r["key"]: r for r in master["system_table"]["optional_rows"]}
    for key in layout.get("optional_equipment", []):
        r = dict(opt_master[key])
        r["no"] = next_no
        next_no += 1
        rows.append(r)
    return rows


def draw_system_table(psp, master, rows, y_top):
    _text(psp, master["system_table"]["title"], (RX0, y_top + 1.5), h=3.2)
    col_w = [10, 66, 55, 24]  # No. / 装置名 / 型式 / 質量
    xs = [RX0]
    for w in col_w:
        xs.append(xs[-1] + w)
    row_h = 5.4
    n = len(rows) + 1
    y0 = y_top - n * row_h
    _rect(psp, xs[0], y0, xs[-1], y_top)
    for x in xs[1:-1]:
        psp.add_line((x, y0), (x, y_top), dxfattribs={"layer": LAYER_TABLE})
    for i in range(1, n):
        y = y_top - i * row_h
        psp.add_line((xs[0], y), (xs[-1], y), dxfattribs={"layer": LAYER_TABLE})

    headers = master["system_table"]["columns"]
    for j, htxt in enumerate(headers):
        _text(psp, htxt, ((xs[j] + xs[j + 1]) / 2, y_top - row_h / 2), h=2.4, align=TextEntityAlignment.MIDDLE_CENTER)
    for i, r in enumerate(rows):
        cy = y_top - (i + 1.5) * row_h
        if r.get("no"):
            _text(psp, str(r["no"]), ((xs[0] + xs[1]) / 2, cy), h=2.4, align=TextEntityAlignment.MIDDLE_CENTER)
        _text(psp, r["name"], (xs[1] + 1.5, cy), h=2.3, align=TextEntityAlignment.MIDDLE_LEFT)
        if r.get("model"):
            _text(psp, r["model"], (xs[2] + 1.5, cy), h=2.3, align=TextEntityAlignment.MIDDLE_LEFT)
        if r.get("mass_kg"):
            _text(psp, r["mass_kg"], (xs[4 - 1] + col_w[3] - 1.5, cy), h=2.4, align=TextEntityAlignment.MIDDLE_RIGHT)
    return y0


def draw_env_table(psp, master, exam_room_name, y_top):
    _text(psp, master["environment_table"]["title"], (RX0, y_top + 1.5), h=3.2)
    col_w = [30, 44, 52, 29]
    xs = [RX0]
    for w in col_w:
        xs.append(xs[-1] + w)
    head_h, exam_h, ctrl_h = 6.0, 19.0, 8.0
    y1 = y_top - head_h
    y2 = y1 - exam_h
    y0 = y2 - ctrl_h
    _rect(psp, xs[0], y0, xs[-1], y_top)
    for x in xs[1:-1]:
        psp.add_line((x, y0), (x, y_top), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((xs[0], y1), (xs[-1], y1), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((xs[0], y2), (xs[-1], y2), dxfattribs={"layer": LAYER_TABLE})

    heads = master["environment_table"]["columns"]
    for j, htxt in enumerate(heads[:3]):
        _text(psp, htxt, ((xs[j] + xs[j + 1]) / 2, y_top - head_h / 2), h=2.4, align=TextEntityAlignment.MIDDLE_CENTER)
    _text(psp, "発熱量", ((xs[3] + xs[4]) / 2, y_top - head_h / 2 + 1.2), h=2.2, align=TextEntityAlignment.MIDDLE_CENTER)
    _text(psp, "(kcal/h)", ((xs[3] + xs[4]) / 2, y_top - head_h / 2 - 1.6), h=1.8, align=TextEntityAlignment.MIDDLE_CENTER)

    exam, ctrl = master["environment_table"]["rows"]
    # 検査室行
    cy = (y1 + y2) / 2
    for k, line in enumerate(wrap_jp(exam_room_name, 12)):
        _text(psp, line, ((xs[0] + xs[1]) / 2, cy + 1.6 - k * 3.2), h=2.2, align=TextEntityAlignment.MIDDLE_CENTER)
    for k, line in enumerate(wrap_jp(exam["temperature_humidity"], 17)):
        _text(psp, line, (xs[1] + 1.5, y1 - 3.0 - k * 3.4), h=2.1, align=TextEntityAlignment.MIDDLE_LEFT)
    _draw_humidity_chart(psp, exam["chart_spec"], xs[2] + 6, y2 + 2.5, 40, exam_h - 5)
    _text(psp, exam["heat_kcal_h"], (xs[4] - 1.5, cy), h=2.6, align=TextEntityAlignment.MIDDLE_RIGHT)
    # 操作室行
    cy = (y2 + y0) / 2
    _text(psp, ctrl["room_name"], ((xs[0] + xs[1]) / 2, cy), h=2.4, align=TextEntityAlignment.MIDDLE_CENTER)
    _text(psp, ctrl["temperature"], ((xs[1] + xs[2]) / 2, cy), h=2.4, align=TextEntityAlignment.MIDDLE_CENTER)
    for k, line in enumerate(wrap_jp(ctrl["humidity"], 20)):
        _text(psp, line, ((xs[2] + xs[3]) / 2, cy + 1.6 - k * 3.2), h=2.1, align=TextEntityAlignment.MIDDLE_CENTER)
    _text(psp, ctrl["heat_kcal_h"], (xs[4] - 1.5, cy), h=2.6, align=TextEntityAlignment.MIDDLE_RIGHT)
    return y0


def _draw_humidity_chart(psp, spec, x, y, w, h):
    """温湿度許容範囲チャート（斜線領域の簡略表現）。x,y=左下、w,h=描画枠。"""
    ax_x0, ax_y0 = x + 6, y + 3
    ax_w, ax_h = w - 10, h - 5
    psp.add_line((ax_x0, ax_y0), (ax_x0 + ax_w, ax_y0), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((ax_x0, ax_y0), (ax_x0, ax_y0 + ax_h), dxfattribs={"layer": LAYER_TABLE})

    t0, t1 = spec["temp_axis_c"]
    h0, h1 = spec["humidity_axis_pct"]

    def pt(temp, hum):
        return (ax_x0 + (temp - t0) / (t1 - t0) * ax_w,
                ax_y0 + (hum - 0) / 80.0 * ax_h)

    # 許容領域: (10,15)-(30,15)-(30,55)-(10,75)
    region = [pt(t0, h0), pt(t1, h0), pt(t1, 55), pt(t0, h1)]
    psp.add_lwpolyline(region, close=True, dxfattribs={"layer": LAYER_TABLE})
    # ハッチング（45°斜線）
    import math
    x_min = min(p[0] for p in region)
    x_max = max(p[0] for p in region)
    y_min = min(p[1] for p in region)
    y_max = max(p[1] for p in region)
    step = 1.6
    c = x_min + y_min
    while c < x_max + y_max:
        seg = _clip_line_to_poly(c, region, x_min, x_max, y_min, y_max)
        if seg:
            psp.add_line(*seg, dxfattribs={"layer": LAYER_TABLE})
        c += step
    _text(psp, str(t0), (pt(t0, 0)[0], ax_y0 - 1.2), h=1.5, align=TextEntityAlignment.TOP_CENTER)
    _text(psp, str(t1), (pt(t1, 0)[0], ax_y0 - 1.2), h=1.5, align=TextEntityAlignment.TOP_CENTER)
    _text(psp, str(h0), (ax_x0 - 0.8, pt(0, h0)[1]), h=1.5, align=TextEntityAlignment.MIDDLE_RIGHT)
    _text(psp, str(h1), (ax_x0 - 0.8, pt(0, h1)[1]), h=1.5, align=TextEntityAlignment.MIDDLE_RIGHT)
    _text(psp, "周囲温度(℃)", (ax_x0 + ax_w / 2, ax_y0 - 3.0), h=1.5, align=TextEntityAlignment.TOP_CENTER)


def _clip_line_to_poly(c, poly, x_min, x_max, y_min, y_max):
    """直線 x+y=c を凸多角形でクリップ（簡易: 辺との交点2点）。"""
    pts = []
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        f1, f2 = x1 + y1 - c, x2 + y2 - c
        if f1 == f2:
            continue
        t = f1 / (f1 - f2)
        if 0 <= t <= 1:
            pts.append((x1 + t * (x2 - x1), y1 + t * (y2 - y1)))
    if len(pts) >= 2:
        pts.sort()
        return pts[0], pts[-1]
    return None


def draw_notes(psp, master, layout, exam_room_name, y_top):
    y = y_top
    for note in master["notes"]:
        note = note.replace("{{exam_room_name}}", exam_room_name)
        head, body = note[:3], note[3:]
        lines = wrap_jp(body, 42)
        _text(psp, head + lines[0], (RX0, y), h=2.2)
        for line in lines[1:]:
            y -= 3.6
            _text(psp, "　　　" + line, (RX0, y), h=2.2)
        y -= 3.9
    y -= 1.5
    for note in layout["project"].get("special_notes", []):
        for k, line in enumerate(wrap_jp(note, 44)):
            _text(psp, line if k == 0 else "　" + line, (RX0, y), h=2.2)
            y -= 3.6
    return y


def draw_scope(psp, master, x0=7.0, y0=7.0, x1=150.0, y1=37.0):
    scope = master["scope_of_work"]
    _rect(psp, x0, y0, x1, y1)
    _text(psp, scope["title"], (x0 + 2, y1 - 4.5), h=2.6)
    y = y1 - 9.5
    for item in scope["items"]:
        for k, line in enumerate(wrap_jp(item, 33)):
            _text(psp, line if k == 0 else "　　" + line, (x0 + 4, y), h=2.2)
            y -= 3.6
    for k, line in enumerate(wrap_jp(scope["footer"], 35)):
        _text(psp, line, (x0 + 2, y), h=2.2)
        y -= 3.6


def draw_revision_history(psp, layout, x0=152.0, y0=7.0, x1=253.0, y1=37.0):
    _rect(psp, x0, y0, x1, y1)
    _text(psp, "改訂履歴", (x0 + 2, y1 - 4.0), h=2.4)
    rows = layout["project"].get("revision_history", [])
    ry = y1 - 6.5
    for i in range(5):
        psp.add_line((x0, ry), (x1, ry), dxfattribs={"layer": LAYER_TABLE})
        if i < len(rows):
            r = rows[i]
            _text(psp, f"{r.get('rev','')}:{r.get('date','')} {r.get('note','')}",
                  (x0 + 2, ry - 4.0), h=2.0)
        ry -= 5.6


def draw_disclaimer(psp, master, layout, x0=255.0, y0=38.5, x1=413.0, y1=51.0):
    kind = layout["project"].get("disclaimer_kind", "plan")
    _rect(psp, x0, y0, x1, y1)
    y = y1 - 4.5
    for line in wrap_jp(master["disclaimer"][kind], 47):
        _text(psp, line, (x0 + 2.5, y), h=2.3)
        y -= 4.0


def draw_title_block(psp, master, layout, scale_str, x0=255.0, y0=7.0, x1=413.0, y1=37.0):
    p = layout["project"]
    row_h = (y1 - y0) / 3
    ya = y1 - row_h      # 上段下端
    yb = y1 - 2 * row_h  # 中段下端
    _rect(psp, x0, y0, x1, y1)
    psp.add_line((x0, ya), (x1, ya), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((x0, yb), (x1, yb), dxfattribs={"layer": LAYER_TABLE})

    def cell(x_left, x_right, y_bot, y_top_, label, value, value_h=3.0):
        _text(psp, label, (x_left + 1.2, y_top_ - 2.6), h=1.7)
        if value:
            _text(psp, value, ((x_left + x_right) / 2, y_bot + (y_top_ - y_bot) * 0.38),
                  h=value_h, align=TextEntityAlignment.MIDDLE_CENTER)

    # 上段: 作成日 | 営業担当 | 顧客名
    xa = [x0, x0 + 30, x0 + 55, x1]
    psp.add_line((xa[1], ya), (xa[1], y1), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((xa[2], ya), (xa[2], y1), dxfattribs={"layer": LAYER_TABLE})
    cell(xa[0], xa[1], ya, y1, "作成日", p.get("created_date", ""), value_h=2.6)
    cell(xa[1], xa[2], ya, y1, "営業担当", p.get("sales_rep", ""), value_h=2.6)
    cell(xa[2], xa[3], ya, y1, "顧客名",
         f"{p['customer_name']}　{master['title_block']['customer_suffix']}", value_h=3.0)

    # 中段: 作図 | 検討 | 承認 | 図面名称
    xb = [x0, x0 + 25, x0 + 50, x0 + 75, x1]
    for x in xb[1:-1]:
        psp.add_line((x, yb), (x, ya), dxfattribs={"layer": LAYER_TABLE})
    cell(xb[0], xb[1], yb, ya, "作図", p.get("drafter", ""), value_h=2.6)
    cell(xb[1], xb[2], yb, ya, "検討", p.get("checker", ""), value_h=2.6)
    cell(xb[2], xb[3], yb, ya, "承認", p.get("approver", ""), value_h=2.6)
    cell(xb[3], xb[4], yb, ya, "図面名称", p["drawing_title"], value_h=3.0)

    # 下段: 図面番号 | 改定 | SHEET | 縮尺 | 社名
    xc = [x0, x0 + 38, x0 + 50, x0 + 64, x0 + 78, x1]
    for x in xc[1:-1]:
        psp.add_line((x, y0), (x, yb), dxfattribs={"layer": LAYER_TABLE})
    cell(xc[0], xc[1], y0, yb, "図面番号", p["drawing_number"], value_h=2.6)
    cell(xc[1], xc[2], y0, yb, "改定", p.get("revision", "A"), value_h=2.6)
    cell(xc[2], xc[3], y0, yb, "SHEET", p.get("sheet", "1/1"), value_h=2.6)
    cell(xc[3], xc[4], y0, yb, "縮尺", scale_str, value_h=2.6)
    # 社名（丸十字マーク付き）
    mx = xc[4] + 6
    my = (y0 + yb) / 2
    psp.add_circle((mx, my), 2.2, dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((mx - 2.2, my), (mx + 2.2, my), dxfattribs={"layer": LAYER_TABLE})
    psp.add_line((mx, my - 2.2), (mx, my + 2.2), dxfattribs={"layer": LAYER_TABLE})
    _text(psp, master["title_block"]["company"], (mx + 4.5, my), h=3.6, align=TextEntityAlignment.MIDDLE_LEFT)


def draw_form_number(psp, master, variant="様式3A"):
    _text(psp, f"（{master['sheet']['form_number']} {variant}）", (413, 2.2), h=2.2, align=TextEntityAlignment.BOTTOM_RIGHT)
