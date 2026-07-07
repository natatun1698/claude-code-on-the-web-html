# -*- coding: utf-8 -*-
"""E資格チャレンジ記録スライドショー生成スクリプト"""
import os
import subprocess
import math
import wave
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(BASE, "photos")
WORK = os.path.join(BASE, "work")
os.makedirs(WORK, exist_ok=True)

W, H = 1080, 1920
FPS = 30
FADE = 0.8  # xfade duration

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"

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


def make_title_card(path):
    img = vertical_gradient((W, H), (16, 24, 48), (40, 22, 64))
    d = ImageDraw.Draw(img, "RGBA")
    # 星のような粒
    rng = np.random.default_rng(7)
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, H)
        r = float(rng.uniform(0.7, 2.2))
        a = int(rng.integers(40, 140))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, a))
    f_big = ImageFont.truetype(FONT_BOLD, 96)
    f_mid = ImageFont.truetype(FONT_REG, 46)
    f_small = ImageFont.truetype(FONT_REG, 40)
    accent = (255, 200, 87)
    d.line([(W / 2 - 90, 690), (W / 2 + 90, 690)], fill=accent, width=5)
    draw_center(d, 760, "隙間時間の", f_big, (255, 255, 255))
    draw_center(d, 890, "積み重ね", f_big, (255, 255, 255))
    draw_center(d, 1090, "E資格 挑戦の記録", f_mid, accent)
    draw_center(d, 1180, "2025.10 - 2026.2.22", f_small, (200, 205, 220))
    img.save(path)


def make_end_card(path):
    img = vertical_gradient((W, H), (26, 42, 74), (12, 20, 40))
    d = ImageDraw.Draw(img, "RGBA")
    rng = np.random.default_rng(11)
    for _ in range(140):
        x, y = rng.integers(0, W), rng.integers(0, H)
        r = float(rng.uniform(0.7, 2.2))
        a = int(rng.integers(40, 140))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 240, a))
    f_date = ImageFont.truetype(FONT_REG, 44)
    f_big = ImageFont.truetype(FONT_BOLD, 78)
    f_mid = ImageFont.truetype(FONT_REG, 46)
    accent = (255, 200, 87)
    draw_center(d, 700, "2026.2.22  13:00", f_date, accent)
    draw_center(d, 790, "試験終了", f_big, (255, 255, 255))
    d.line([(W / 2 - 90, 940), (W / 2 + 90, 940)], fill=accent, width=5)
    draw_center(d, 1010, "積み重ねた隙間時間は", f_mid, (230, 234, 245))
    draw_center(d, 1090, "きっと裏切らない。", f_mid, (230, 234, 245))
    draw_center(d, 1230, "おつかれさまでした!", ImageFont.truetype(FONT_BOLD, 60), accent)
    img.save(path)


# ------------------------------------------------------------- captions


def make_caption(path, date_text, message_lines):
    """1080x1920 透過PNG: 下部に角丸ボックス+日付+メッセージ"""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_date = ImageFont.truetype(FONT_BOLD, 44)
    f_msg = ImageFont.truetype(FONT_BOLD, 52)
    pad_x, line_h = 50, 74
    box_w = max(
        [d.textlength(date_text, font=f_date)]
        + [d.textlength(t, font=f_msg) for t in message_lines]
    ) + pad_x * 2
    box_w = min(max(box_w, 560), W - 60)
    box_h = 46 + 64 + len(message_lines) * line_h + 30
    x0 = (W - box_w) / 2
    y0 = H - 210 - box_h
    d.rounded_rectangle(
        [x0, y0, x0 + box_w, y0 + box_h], radius=34, fill=(10, 12, 24, 165)
    )
    accent = (255, 200, 87, 255)
    d.text((x0 + pad_x, y0 + 36), date_text, font=f_date, fill=accent)
    y = y0 + 36 + 64
    for t in message_lines:
        d.text((x0 + pad_x, y), t, font=f_msg, fill=(255, 255, 255, 255))
        y += line_h
    img.save(path)


# ------------------------------------------------------------- segments


def make_segment(idx, image, caption, dur, zoom_mode):
    """1枚の写真 → Ken Burns 付き mp4 セグメント"""
    out = os.path.join(WORK, f"seg{idx:02d}.mp4")
    frames = int(dur * FPS)
    if zoom_mode == "in":
        z = f"1+0.11*on/{frames - 1}"
    elif zoom_mode == "out":
        z = f"1.11-0.11*on/{frames - 1}"
    else:  # 静かなズームイン(カード用)
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


def make_bgm(path, total_dur):
    sr = 44100
    bpm = 76
    step = 60 / bpm / 2  # 8分音符
    # コード進行 (周波数: A3=220)
    def n(name):
        names = {"C": 0, "C#": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6,
                 "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
        pitch, octv = name[:-1], int(name[-1])
        semis = names[pitch] + (octv - 4) * 12 - 9  # A4 基準
        return 440.0 * 2 ** (semis / 12)

    chords = [
        ["C3", "G3", "E4", "G4", "C5", "G4", "E4", "G3"],
        ["A2", "E3", "C4", "E4", "A4", "E4", "C4", "E3"],
        ["F2", "C3", "A3", "C4", "F4", "C4", "A3", "C3"],
        ["G2", "D3", "B3", "D4", "G4", "D4", "B3", "D3"],
    ]
    seq = []
    t = 0.0
    ci = 0
    while t < total_dur + 2:
        for note in chords[ci % len(chords)]:
            seq.append((t, n(note)))
            t += step
        ci += 1
    total = int((total_dur + 3) * sr)
    audio = np.zeros(total, dtype=np.float64)
    dur_n = step * 3.2  # 余韻
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
    # 正規化 + フェード
    audio *= 0.16 / max(1e-9, np.abs(audio).max())
    fade = int(3.0 * sr)
    audio[-fade:] *= np.linspace(1, 0, fade)
    fade_in = int(1.0 * sr)
    audio[:fade_in] *= np.linspace(0, 1, fade_in)
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(path, "w") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


# ----------------------------------------------------------------- main

title = os.path.join(WORK, "card_title.png")
end = os.path.join(WORK, "card_end.png")
make_title_card(title)
make_end_card(end)

slides = [
    ("01_2025-10.jpg", "2025年10月", ["出かけた先でも、", "参考書はいつもそばに"], "in"),
    ("02_2025-12.jpg", "2025年12月", ["行列に並ぶ時間も、", "大切な勉強時間"], "out"),
    ("03_2026-01-01.jpg", "2026年1月1日", ["元日の朝も、", "カフェで一問から"], "in"),
    ("04_2026-02-01.jpg", "2026年2月1日", ["雪の日は図書館へ"], "out"),
    ("05_2026-02-02.jpg", "2026年2月2日", ["朝6時35分。", "学習率は93.3%まで来た"], "in"),
    ("06_2026-02-10.jpg", "2026年2月10日", ["料理の合間も、", "プリントを片手に"], "out"),
    ("07_2026-02-22_07.jpg", "2026年2月22日 朝7時", ["試験当日の朝。", "やれることは全部やった"], "in"),
    ("08_2026-02-22_13.jpg", "2026年2月22日 13時", ["試験終了!", "全力を出し切った"], "out"),
]

segments = []
segments.append(make_segment(0, title, None, 4.0, "card"))
for i, (img, date, msg, zm) in enumerate(slides, start=1):
    cap = os.path.join(WORK, f"cap{i:02d}.png")
    make_caption(cap, date, msg)
    segments.append(make_segment(i, os.path.join(PHOTOS, img), cap, 5.0, zm))
segments.append(make_segment(9, end, None, 6.0, "card"))

# xfade 連結
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
        f"{prev}[{i}:v]xfade=transition=fade:duration={FADE}:offset={offset:.3f}{out_label}"
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
        os.path.join(BASE, "E資格挑戦の記録.mp4"),
    ]
)
subprocess.run(cmd, check=True)
print("done")
