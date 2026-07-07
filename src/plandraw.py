"""平面図（モデル空間・実寸mm）の描画。

部屋の壁（内外二重線・開口部で分割・出隅マイター）、建具、付帯設備、
部屋ラベル、寸法線、装置バルーンを描く。
"""

import math

from ezdxf.enums import TextEntityAlignment

from blocks import FOOTPRINTS, LABELS

LAYER_WALL = "WALL"
LAYER_FITTING = "FITTING"
LAYER_EQUIP = "EQUIP"
LAYER_BALLOON = "BALLOON"
LAYER_DIM = "DIM"
LAYER_TEXT = "PLAN_TEXT"


# ---------------------------------------------------------------- geometry

def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _mul(a, s):
    return (a[0] * s, a[1] * s)


def _norm(v):
    l = math.hypot(*v)
    return (v[0] / l, v[1] / l)


def _signed_area(pts):
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return s / 2.0


def ensure_ccw(pts):
    return list(pts) if _signed_area(pts) > 0 else list(reversed(pts))


def _line_intersect(p1, d1, p2, d2):
    """直線 p1+t*d1 と p2+s*d2 の交点。平行なら None。"""
    cross = d1[0] * d2[1] - d1[1] * d2[0]
    if abs(cross) < 1e-9:
        return None
    t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / cross
    return _add(p1, _mul(d1, t))


def _outward(pts, i):
    """CCWポリゴンの辺i（pts[i]→pts[i+1]）の外向き法線。"""
    u = _norm(_sub(pts[(i + 1) % len(pts)], pts[i]))
    return (u[1], -u[0])


def _outer_corners(pts, t):
    """壁厚tぶん外側にオフセットした出隅（マイター）点列。"""
    n = len(pts)
    corners = []
    for i in range(n):
        n_prev = _outward(pts, (i - 1) % n)
        n_this = _outward(pts, i)
        a_prev = _add(pts[(i - 1) % n], _mul(n_prev, t))
        u_prev = _norm(_sub(pts[i], pts[(i - 1) % n]))
        a_this = _add(pts[i], _mul(n_this, t))
        u_this = _norm(_sub(pts[(i + 1) % n], pts[i]))
        p = _line_intersect(a_prev, u_prev, a_this, u_this)
        corners.append(p if p else _add(pts[i], _mul(n_this, t)))
    return corners


# ---------------------------------------------------------------- walls

def draw_room_walls(msp, room):
    pts = ensure_ccw([tuple(p) for p in room["outline_mm"]])
    t = room.get("wall_thickness_mm") or 150
    outer = _outer_corners(pts, t)
    n = len(pts)
    openings_by_edge = {}
    for op in room.get("openings", []):
        openings_by_edge.setdefault(op["wall_index"], []).append(op)

    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        length = math.hypot(*_sub(b, a))
        u = _norm(_sub(b, a))
        nv = _outward(pts, i)

        # 開口部で壁を分割
        spans = sorted(
            (max(0.0, op["offset_mm"]), min(length, op["offset_mm"] + op["width_mm"]))
            for op in openings_by_edge.get(i, [])
        )
        walls, cur = [], 0.0
        for s0, s1 in spans:
            if s0 > cur:
                walls.append((cur, s0))
            cur = max(cur, s1)
        if cur < length:
            walls.append((cur, length))

        for w0, w1 in walls:
            ip = _add(a, _mul(u, w0))
            iq = _add(a, _mul(u, w1))
            op_ = outer[i] if w0 <= 1e-6 else _add(ip, _mul(nv, t))
            oq = outer[(i + 1) % n] if w1 >= length - 1e-6 else _add(iq, _mul(nv, t))
            msp.add_line(ip, iq, dxfattribs={"layer": LAYER_WALL})
            msp.add_line(op_, oq, dxfattribs={"layer": LAYER_WALL})
            if w0 > 1e-6:  # 開口部端の小口
                msp.add_line(ip, _add(ip, _mul(nv, t)), dxfattribs={"layer": LAYER_WALL})
            if w1 < length - 1e-6:
                msp.add_line(iq, _add(iq, _mul(nv, t)), dxfattribs={"layer": LAYER_WALL})

        for op in openings_by_edge.get(i, []):
            _draw_opening(msp, op, a, u, nv, t)


def _draw_opening(msp, op, a, u, nv, t):
    o, w = op["offset_mm"], op["width_mm"]
    p0 = _add(a, _mul(u, o))          # 開口始端（内法線上）
    p1 = _add(a, _mul(u, o + w))      # 開口終端
    kind = op["kind"]
    attrs = {"layer": LAYER_FITTING}

    if kind in ("swing_door", "double_swing_door"):
        swing = op.get("swing", "in_left")
        inward = _mul(nv, -1) if swing.startswith("in") else nv
        leaves = [(p0, p1, w)] if kind == "swing_door" else [(p0, _add(a, _mul(u, o + w / 2)), w / 2),
                                                             (p1, _add(a, _mul(u, o + w / 2)), w / 2)]
        if kind == "swing_door" and swing.endswith("_right"):
            leaves = [(p1, p0, w)]
        for hinge, free, leaf in leaves:
            tip = _add(hinge, _mul(inward, leaf))
            msp.add_line(hinge, tip, dxfattribs=attrs)
            ang_free = math.degrees(math.atan2(free[1] - hinge[1], free[0] - hinge[0]))
            ang_tip = math.degrees(math.atan2(tip[1] - hinge[1], tip[0] - hinge[0]))
            start, end = sorted((ang_free, ang_tip))
            # 90度以内になる側に弧を描く
            if end - start > 180:
                start, end = end, start + 360
            msp.add_arc(hinge, leaf, start, end, dxfattribs=attrs)
    elif kind == "sliding_door":
        inset = _mul(nv, -60)
        msp.add_line(_add(p0, inset), _add(p1, inset), dxfattribs=attrs)
        mid = _add(_add(a, _mul(u, o + w / 2)), _mul(nv, t / 2))
        msp.add_line(_add(p0, _mul(nv, t / 2)), mid, dxfattribs=attrs)
    elif kind == "shield_window":
        for f in (0.35, 0.65):
            msp.add_line(_add(p0, _mul(nv, t * f)), _add(p1, _mul(nv, t * f)), dxfattribs=attrs)
    else:  # opening / hatch
        mid_a = _add(p0, _mul(nv, t / 2))
        mid_b = _add(p1, _mul(nv, t / 2))
        msp.add_line(mid_a, mid_b, dxfattribs={"layer": LAYER_FITTING, "linetype": "DASHED"})


# ---------------------------------------------------------------- annotation

def _centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def draw_room_annotation(msp, room, denom):
    pts = [tuple(p) for p in room["outline_mm"]]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    # 既定位置は左下寄り（装置は部屋中央〜壁際に置かれることが多いため）
    default_pos = (min(xs) + 0.24 * (max(xs) - min(xs)),
                   min(ys) + 0.26 * (max(ys) - min(ys)))
    name_pos = room.get("name_position_mm") or default_pos
    text = msp.add_text(room["name"], dxfattribs={"style": "JP", "height": 3.0 * denom, "layer": LAYER_TEXT})
    text.set_placement(name_pos, align=TextEntityAlignment.MIDDLE_CENTER)
    if room.get("ceiling_height_mm"):
        ch = msp.add_text(f"CH={room['ceiling_height_mm']:,}mm",
                          dxfattribs={"style": "JP", "height": 2.0 * denom, "layer": LAYER_TEXT})
        ch.set_placement((name_pos[0], name_pos[1] - 4.0 * denom), align=TextEntityAlignment.MIDDLE_CENTER)

    for label in room.get("adjacent_labels", []):
        t = msp.add_text(label["text"], dxfattribs={"style": "JP", "height": 2.5 * denom, "layer": LAYER_TEXT})
        t.set_placement(tuple(label["position_mm"]), align=TextEntityAlignment.MIDDLE_CENTER)

    for fx in room.get("fixtures", []):
        x, y = fx["position_mm"]
        msp.add_lwpolyline([(x - 200, y - 75), (x + 200, y - 75), (x + 200, y + 75), (x - 200, y + 75)],
                           close=True, dxfattribs={"layer": LAYER_FITTING})
        t = msp.add_text(fx.get("label") or fx.get("kind", ""),
                         dxfattribs={"style": "JP", "height": 1.8 * denom, "layer": LAYER_TEXT})
        t.set_placement((x, y + 75 + 1.2 * denom), align=TextEntityAlignment.BOTTOM_CENTER)


def draw_room_dimensions(msp, room, denom):
    pts = [tuple(p) for p in room["outline_mm"]]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    off = 1400
    dim_attr = {"dimstyle": "PLAN"}

    dim = msp.add_linear_dim(base=(x0, y1 + off), p1=(x0, y1), p2=(x1, y1),
                             text=f"{x1 - x0:,.0f}", dxfattribs={"layer": LAYER_DIM}, **dim_attr)
    dim.render()
    dim = msp.add_linear_dim(base=(x0 - off, y0), p1=(x0, y0), p2=(x0, y1), angle=90,
                             text=f"{y1 - y0:,.0f}", dxfattribs={"layer": LAYER_DIM}, **dim_attr)
    dim.render()

    for ed in room.get("extra_dimensions", []):
        p1, p2 = tuple(ed["from_mm"]), tuple(ed["to_mm"])
        horizontal = abs(p2[1] - p1[1]) <= abs(p2[0] - p1[0])
        if horizontal:
            base = (p1[0], max(p1[1], p2[1]) + off * 0.6)
            angle = 0
        else:
            base = (min(p1[0], p2[0]) - off * 0.6, p1[1])
            angle = 90
        label = ed.get("label") or f"{math.hypot(p2[0]-p1[0], p2[1]-p1[1]):,.0f}"
        dim = msp.add_linear_dim(base=base, p1=p1, p2=p2, angle=angle, text=label,
                                 dxfattribs={"layer": LAYER_DIM}, **dim_attr)
        dim.render()


# ---------------------------------------------------------------- equipment

def draw_equipment(msp, placement, denom, rooms):
    centroids = {r["role"]: _centroid([tuple(p) for p in r["outline_mm"]]) for r in rooms}
    for item in placement:
        pos = tuple(item["position_mm"])
        rot = item.get("rotation_deg", 0)
        msp.add_blockref(item["block"], pos, dxfattribs={"rotation": rot, "layer": LAYER_EQUIP})
        # 型式ラベル（回転しても水平を保つため後描き）
        label = LABELS.get(item["block"], "")
        if label:
            dy = -320 if item["block"] == "ZS200_MAIN" else 0
            t = msp.add_text(label, dxfattribs={"style": "JP", "height": 1.4 * denom, "layer": LAYER_EQUIP})
            t.set_placement((pos[0], pos[1] + dy), align=TextEntityAlignment.MIDDLE_CENTER)
        centroid = centroids.get(item.get("room_role"), centroids.get("exam_room", pos))
        _draw_balloon(msp, item, pos, rot, denom, centroid)


def _draw_balloon(msp, item, pos, rot, denom, centroid):
    w, d = FOOTPRINTS.get(item["block"], (600, 600))
    rad = math.radians(rot)
    ext_x = abs(w / 2 * math.cos(rad)) + abs(d / 2 * math.sin(rad))
    ext_y = abs(w / 2 * math.sin(rad)) + abs(d / 2 * math.cos(rad))
    if item.get("balloon_offset_mm"):
        bp = _add(pos, tuple(item["balloon_offset_mm"]))
    else:
        # 部屋中心側の上方に置く（壁の外に飛び出しにくい向き）
        sx = 1 if centroid[0] >= pos[0] else -1
        sy = 1 if centroid[1] >= pos[1] else -1
        bp = (pos[0] + sx * (ext_x + 2.4 * denom), pos[1] + sy * (ext_y + 2.4 * denom))
    r = 1.9 * denom
    msp.add_circle(bp, r, dxfattribs={"layer": LAYER_BALLOON})
    t = msp.add_text(str(item["no"]), dxfattribs={"style": "JP", "height": 2.1 * denom, "layer": LAYER_BALLOON})
    t.set_placement(bp, align=TextEntityAlignment.MIDDLE_CENTER)


# ---------------------------------------------------------------- bbox

def plan_bbox(layout):
    xs, ys = [], []
    for room in layout["rooms"]:
        t = room.get("wall_thickness_mm") or 150
        for x, y in room["outline_mm"]:
            xs += [x - t, x + t]
            ys += [y - t, y + t]
    return min(xs), min(ys), max(xs), max(ys)
