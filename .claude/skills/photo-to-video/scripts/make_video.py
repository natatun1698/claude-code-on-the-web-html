# -*- coding: utf-8 -*-
"""
写真から縦型/横型スライドショー動画を生成する汎用テンプレート。

使い方:
  1. このファイルを作業用スクラッチディレクトリにコピー
  2. 下の CONFIG セクション (PHOTOS_DIR, W/H, TITLE, SLIDES, END_*) を
     今回の題材に合わせて書き換える
  3. `python3 make_video.py` を実行
  4. work/ 以下の check フレームを ffmpeg -ss <t> -frames:v 1 で抜き出し、
     Read ツールで見た目を確認してから納品する

依存: ffmpeg (システムコマンド), Pillow, numpy, 日本語キャプションを
入れる場合は Noto Sans CJK / IPA ゴシックなどの CJK フォント。
setup() が無ければ自動インストールを試みる。
"""
import os
import shutil
import subprocess
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ============================================================ CONFIG
# ここから下を毎回の題材に合わせて書き換える

BASE = os.path.dirname(os.path.abspath(__file__))
PHOTOS_DIR = os.path.join(BASE, "photos")  # 展開済み写真の置き場
WORK = os.path.join(BASE, "work")
OUTPUT = os.path.join(BASE, "output.mp4")

# 縦型 (SNS向け) 1080x1920 / 横型 (通常) 1920x1080 に切り替え可能
W, H = 1080, 1920
FPS = 30
FADE = 0.8  # xfade のクロスフェード秒数

TITLE_LINES = ["隙間時間の", "積み重ね"]   # メインタイトル(改行ごとにリスト要素)
TITLE_SUB = "○○ 挑戦の記録"
TITLE_DATE_RANGE = "2025.10 - 2026.2.22"

END_DATE = "2026.2.22  13:00"
END_HEADLINE = "試験終了"
END_BODY = ["積み重ねた隙間時間は", "きっと裏切らない。"]
END_FOOTER = "おつかれさまでした!"

# (ファイル名, 表示日付, キャプション行のリスト, ズーム方向 "in"|"out")
SLIDES = [
    ("01.jpg", "2025年10月", ["出かけた先でも、", "参考書はいつもそばに"], "in"),
    ("02.jpg", "2025年12月", ["行列に並ぶ時間も、", "大切な勉強時間"], "out"),
]

SLIDE_DUR = 5.0        # 1枚あたりの表示秒数
TITLE_DUR = 4.0
END_DUR = 6.0

# 配色 (RGB)
BG_TOP, BG_BOTTOM = (16, 24, 48), (40, 22, 64)
ACCENT = (255, 200, 87)

# ============================================================ /CONFIG

os.makedirs(WORK, exist_ok=True)


def find_font(bold=False):
    candidates_bold = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
        "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    ]
    candidates_reg = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
        "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf",
    ]
    for p in (candidates_bold if bold else candidates_reg):
        if os.path.exists(p):
            return p
    raise FileNotFoundError(
        "CJK font not found. Run: sudo apt-get install -y fonts-noto-cjk"
    )


def setup():
    """ffmpeg / Pillow / numpy / CJK フォントの有無を確認し、無ければ導入する。"""
    if shutil.which("ffmpeg") is None:
        subprocess.run(["sudo", "apt-get", "update"], check=False)
        subprocess.run(["sudo", "apt-get", "install", "-y", "ffmpeg"], check=True)
    try:
        find_font()
    except FileNotFoundError:
        subprocess.run(
            ["sudo", "apt-get", "install", "-y", "fonts-noto-cjk"], check=True
        )


FONT_BOLD = None
FONT_REG = None


def _fonts():
    global FONT_BOLD, FONT_REG
    if FONT_BOLD is None:
        FONT_BOLD = find_font(bold=True)
        FONT_REG = find_font(bold=False)
    return FONT_BOLD, FONT_REG


# ---------------------------------------------------------------- cards


def vertical_gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return img


def draw_center(draw, y, text, font, fill):
    x = (W - draw.textlength(text, font=font)) / 2
    draw.text((x, y), text, font=font, fill=fill)
    return y


def sprinkle_stars(draw, seed, count=140):
    rng = np.random.default_rng(seed)
    for _ in range(count):
        x, y = rng.integers(0, W), rng.integers(0, H)
        r = float(rng.uniform(0.7, 2.2))
        a = int(rng.integers(40, 140))
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, a))


def make_title_card(path):
    font_bold, font_reg = _fonts()
    img = vertical_gradient((W, H), BG_TOP, BG_BOTTOM)
    d = ImageDraw.Draw(img, "RGBA")
    sprinkle_stars(d, seed=7)
    f_big = ImageFont.truetype(font_bold, int(H * 0.05))
    f_mid = ImageFont.truetype(font_reg, int(H * 0.024))
    f_small = ImageFont.truetype(font_reg, int(H * 0.021))
    cy = int(H * 0.36)
    d.line([(W / 2 - 90, cy), (W / 2 + 90, cy)], fill=ACCENT, width=5)
    y = cy + 70
    for line in TITLE_LINES:
        draw_center(d, y, line, f_big, (255, 255, 255))
        y += int(H * 0.065)
    y += 30
    draw_center(d, y, TITLE_SUB, f_mid, ACCENT)
    draw_center(d, y + int(H * 0.047), TITLE_DATE_RANGE, f_small, (200, 205, 220))
    img.save(path)


def make_end_card(path):
    font_bold, font_reg = _fonts()
    img = vertical_gradient((W, H), (BG_TOP[0] + 10, BG_TOP[1] + 18, BG_TOP[2] + 26),
                             (12, 20, 40))
    d = ImageDraw.Draw(img, "RGBA")
    sprinkle_stars(d, seed=11)
    f_date = ImageFont.truetype(font_reg, int(H * 0.023))
    f_big = ImageFont.truetype(font_bold, int(H * 0.04))
    f_mid = ImageFont.truetype(font_reg, int(H * 0.024))
    f_footer = ImageFont.truetype(font_bold, int(H * 0.031))
    y = int(H * 0.36)
    draw_center(d, y, END_DATE, f_date, ACCENT)
    y += int(H * 0.047)
    draw_center(d, y, END_HEADLINE, f_big, (255, 255, 255))
    y += int(H * 0.078)
    d.line([(W / 2 - 90, y), (W / 2 + 90, y)], fill=ACCENT, width=5)
    y += 40
    for line in END_BODY:
        draw_center(d, y, line, f_mid, (230, 234, 245))
        y += int(H * 0.041)
    y += int(H * 0.06)
    draw_center(d, y, END_FOOTER, f_footer, ACCENT)
    img.save(path)


# ------------------------------------------------------------- captions


def make_caption(path, date_text, message_lines):
    """透過PNG: 下部に角丸ボックス + 日付 + メッセージ行。"""
    font_bold, _ = _fonts()
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_date = ImageFont.truetype(font_bold, int(H * 0.0225))
    f_msg = ImageFont.truetype(font_bold, int(H * 0.027))
    pad_x, line_h = 50, int(H * 0.0385)
    box_w = max(
        [d.textlength(date_text, font=f_date)]
        + [d.textlength(t, font=f_msg) for t in message_lines]
    ) + pad_x * 2
    box_w = min(max(box_w, W * 0.52), W - 60)
    box_h = 46 + 64 + len(message_lines) * line_h + 30
    x0 = (W - box_w) / 2
    y0 = H - 210 - box_h
    d.rounded_rectangle([x0, y0, x0 + box_w, y0 + box_h], radius=34,
                         fill=(10, 12, 24, 165))
    d.text((x0 + pad_x, y0 + 36), date_text, font=f_date, fill=(*ACCENT, 255))
    y = y0 + 36 + 64
    for t in message_lines:
        d.text((x0 + pad_x, y), t, font=f_msg, fill=(255, 255, 255, 255))
        y += line_h
    img.save(path)


# ------------------------------------------------------------- segments


def make_segment(idx, image, caption, dur, zoom_mode):
    """1枚の写真/カード → Ken Burns エフェクト付き mp4 セグメント。"""
    out = os.path.join(WORK, f"seg{idx:02d}.mp4")
    frames = int(dur * FPS)
    if zoom_mode == "in":
        z = f"1+0.11*on/{frames - 1}"
    elif zoom_mode == "out":
        z = f"1.11-0.11*on/{frames - 1}"
    else:  # card: 控えめなズーム
        z = f"1+0.04*on/{frames - 1}"
    vf = (
        f"scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,"
        f"crop={W * 2}:{H * 2},"
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2'"
        f":d={frames}:s={W}x{H}:fps={FPS}"
    )
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", image]
    if caption:
        cmd += ["-i", caption]
        vf_full = f"[0:v]{vf}[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
        cmd += ["-filter_complex", vf_full, "-map", "[v]"]
    else:
        cmd += ["-vf", vf + ",format=yuv420p"]
    cmd += ["-t", f"{dur}", "-r", str(FPS), "-c:v", "libx264", "-preset", "medium",
            "-crf", "19", out]
    subprocess.run(cmd, check=True)
    return out, dur


# ------------------------------------------------------------------ bgm


def make_bgm(path, total_dur, bpm=76,
             chords=(("C3", "G3", "E4", "G4", "C5", "G4", "E4", "G3"),
                     ("A2", "E3", "C4", "E4", "A4", "E4", "C4", "E3"),
                     ("F2", "C3", "A3", "C4", "F4", "C4", "A3", "C3"),
                     ("G2", "D3", "B3", "D4", "G4", "D4", "B3", "D3"))):
    """簡易ピアノ風アルペジオBGMをノート波形合成で生成 (外部素材不要)。"""
    sr = 44100
    step = 60 / bpm / 2  # 8分音符

    def note_freq(name):
        names = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6,
                 "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
        pitch, octv = name[:-1], int(name[-1])
        semis = names[pitch] + (octv - 4) * 12 - 9  # A4 基準
        return 440.0 * 2 ** (semis / 12)

    seq = []
    t, ci = 0.0, 0
    while t < total_dur + 2:
        for note in chords[ci % len(chords)]:
            seq.append((t, note_freq(note)))
            t += step
        ci += 1

    total = int((total_dur + 3) * sr)
    audio = np.zeros(total, dtype=np.float64)
    dur_n = step * 3.2
    tt = np.arange(int(dur_n * sr)) / sr
    for start, freq in seq:
        env = np.exp(-tt * 3.0) * np.minimum(tt / 0.012, 1.0)
        tone = (np.sin(2 * np.pi * freq * tt) * 0.72
                + np.sin(2 * np.pi * freq * 2 * tt) * 0.18
                + np.sin(2 * np.pi * freq * 3 * tt) * 0.06) * env
        i0 = int(start * sr)
        i1 = min(i0 + len(tone), total)
        if i0 >= total:
            break
        audio[i0:i1] += tone[: i1 - i0]
    audio = audio[: int(total_dur * sr)]
    audio *= 0.16 / max(1e-9, np.abs(audio).max())
    fade = min(int(3.0 * sr), len(audio) // 2)
    if fade > 0:
        audio[-fade:] *= np.linspace(1, 0, fade)
    fade_in = min(int(1.0 * sr), len(audio) // 2)
    if fade_in > 0:
        audio[:fade_in] *= np.linspace(0, 1, fade_in)
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


# ----------------------------------------------------------------- main


def main():
    setup()

    title = os.path.join(WORK, "card_title.png")
    end = os.path.join(WORK, "card_end.png")
    make_title_card(title)
    make_end_card(end)

    segments = [make_segment(0, title, None, TITLE_DUR, "card")]
    for i, (img, date, msg, zm) in enumerate(SLIDES, start=1):
        cap = os.path.join(WORK, f"cap{i:02d}.png")
        make_caption(cap, date, msg)
        segments.append(
            make_segment(i, os.path.join(PHOTOS_DIR, img), cap, SLIDE_DUR, zm)
        )
    last_idx = len(SLIDES) + 1
    segments.append(make_segment(last_idx, end, None, END_DUR, "card"))

    durs = [d for _, d in segments]
    total_dur = sum(durs) - FADE * (len(durs) - 1)
    print("total video duration:", total_dur)

    bgm = os.path.join(WORK, "bgm.wav")
    make_bgm(bgm, total_dur)

    inputs = []
    for f, _ in segments:
        inputs += ["-i", f]
    inputs += ["-i", bgm]

    fc = []
    prev = "[0:v]"
    offset = 0.0
    for i in range(1, len(segments)):
        offset += durs[i - 1] - FADE
        out_label = f"[vx{i}]" if i < len(segments) - 1 else "[vout]"
        fc.append(
            f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:"
            f"offset={offset:.3f}{out_label}"
        )
        prev = out_label

    cmd = (
        ["ffmpeg", "-y", "-loglevel", "error"]
        + inputs
        + [
            "-filter_complex", ";".join(fc),
            "-map", "[vout]", "-map", f"{len(segments)}:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k",
            "-shortest", "-movflags", "+faststart",
            OUTPUT,
        ]
    )
    subprocess.run(cmd, check=True)
    print("done:", OUTPUT)


if __name__ == "__main__":
    main()
