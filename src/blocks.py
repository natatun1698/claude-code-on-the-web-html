"""装置外形ブロック定義（v1 簡略版）。

フットプリント寸法はカタログ近似値。正確な外形が必要になったら、
見本図面からトレースした equipment_blocks.dxf に差し替える。
挿入点はフットプリント中心、単位はmm。
型式ラベルはブロックに含めない（回転しても水平を保つよう plandraw 側で描く）。
"""

# ブロック名 -> (幅 w, 奥行 d)  ※rotation=0 のとき w がX方向
FOOTPRINTS = {
    "ZS200_MAIN": (2700, 1250),
    "ZS200_CAB": (650, 500),
    "ZS200_LCC": (420, 320),
    "ZS200_RC": (1100, 600),
    "DR_EXAM_CAB": (600, 700),
    "DR_OPE_CAB": (530, 450),
    "HV_D150BC_40S": (750, 550),
    "SIDE_TABLE": (1200, 700),
    "SIDE_STATION_I3": (600, 700),
    "MONITOR_CART": (600, 550),
}

LABELS = {
    "ZS200_MAIN": "ZS-200",
    "ZS200_CAB": "ZS-200CAB",
    "ZS200_LCC": "LCC",
    "ZS200_RC": "ZS-200RC",
    "DR_EXAM_CAB": "DR-EXAM",
    "DR_OPE_CAB": "DR-OPE",
    "HV_D150BC_40S": "D150BC-40S",
    "SIDE_TABLE": "サイドテーブル",
    "SIDE_STATION_I3": "サイドステーション",
    "MONITOR_CART": "モニタ台車",
}


def _rect(blk, w, d, cx=0.0, cy=0.0):
    x, y = w / 2, d / 2
    blk.add_lwpolyline(
        [(cx - x, cy - y), (cx + x, cy - y), (cx + x, cy + y), (cx - x, cy + y)],
        close=True,
    )


def register_blocks(doc):
    for name, (w, d) in FOOTPRINTS.items():
        if name in doc.blocks:
            continue
        blk = doc.blocks.new(name=name)
        _rect(blk, w, d)
        if name == "ZS200_MAIN":
            # 撮影台天板と支持器・X線管球の簡略表現
            _rect(blk, 2100, 800)
            blk.add_circle((-750, 0), 200)
            blk.add_lwpolyline([(-1350, -300), (-1050, -300), (-1050, 300), (-1350, 300)], close=True)
        elif name == "ZS200_RC":
            # 操作卓＋モニタ2面＋椅子
            _rect(blk, 300, 80, cx=-250, cy=180)
            _rect(blk, 300, 80, cx=250, cy=180)
            blk.add_circle((0, -650), 190)
