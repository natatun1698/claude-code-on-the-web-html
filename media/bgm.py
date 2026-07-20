# うきうきする明るいBGM（Cメジャー・ペンタトニック、跳ねるスウィング）を合成して media/bgm.wav に出力する
import math, random, struct, wave, os

SR = 22050
DUR = 64.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
rng = random.Random(7)

# C メジャー・ペンタトニック（明るく弾む）
PENTA = [261.63, 293.66, 329.63, 392.00, 440.00]
BASS_ROOT = {0: 130.81, 1: 174.61, 2: 196.00, 3: 220.00}  # C F G Am
CHORD = {
    0: [130.81, 164.81, 196.00],   # C
    1: [174.61, 220.00, 261.63],   # F
    2: [196.00, 246.94, 293.66],   # G
    3: [220.00, 261.63, 329.63],   # Am
}

BPM = 122.0
BEAT = 60.0 / BPM          # 四分音符
EIGHTH = BEAT / 2
SWING = 0.16 * EIGHTH      # 裏拍を少し遅らせて弾む感じに

def mix(buf, i, v, pan):
    if 0 <= i < N:
        buf[i] += v


def pluck(t0, f, amp, pan, decay=6.0, dur=0.5, harm=(1.0, 0.55, 0.28)):
    s0 = int(t0 * SR)
    s1 = min(int((t0 + dur) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        env = math.exp(-decay * t) * min(1.0, t * 400)
        v = 0.0
        for hn, hamp in enumerate(harm, start=1):
            v += hamp * math.sin(2 * math.pi * f * hn * t)
        v *= amp * env
        mix(L, i, v * (1 - pan), pan)
        mix(R, i, v * pan, pan)


def bass_note(t0, f, amp, dur=0.34):
    s0 = int(t0 * SR)
    s1 = min(int((t0 + dur) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        env = math.exp(-9.0 * t) * min(1.0, t * 300)
        v = (math.sin(2 * math.pi * f * t) + 0.4 * math.sin(2 * math.pi * f * 2 * t)) * amp * env
        L[i] += v * 0.52
        R[i] += v * 0.48


def shaker(t0, amp, pan, bright=True):
    s0 = int(t0 * SR)
    s1 = min(int((t0 + 0.06) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        env = math.exp(-70.0 * t)
        n = (rng.random() * 2 - 1)
        v = n * amp * env
        L[i] += v * (1 - pan)
        R[i] += v * pan


def pad_chord(t0, dur, freqs, amp):
    a_len = int(0.25 * SR)
    s0, s1 = int(t0 * SR), min(int((t0 + dur) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        k = i - s0
        env = min(1.0, k / a_len) * min(1.0, (s1 - i) / int(0.35 * SR))
        v = sum(math.sin(2 * math.pi * f * t) for f in freqs) * amp * env
        L[i] += v * 0.5
        R[i] += v * 0.5


bars = int(DUR / (BEAT * 4))
prog_cycle = [0, 1, 3, 2]  # C - F - Am - G（王道進行、明るく前向き）

melody_pat = [0, 2, 4, 2, 3, 2, 1, 0, 2, 4, 4, 3, 2, 1, 2, 0]

for bar in range(bars):
    chord_idx = prog_cycle[bar % 4]
    root = BASS_ROOT[chord_idx]
    bar_t0 = bar * BEAT * 4

    if bar_t0 < DUR - 3:
        pad_chord(bar_t0, BEAT * 4 + 0.4, CHORD[chord_idx], 0.028)

    for beat_i in range(4):
        bt = bar_t0 + beat_i * BEAT
        if bt > DUR - 2:
            continue
        bass_note(bt, root if beat_i in (0, 2) else root * 1.5, 0.13)

    for e in range(8):
        et = bar_t0 + e * EIGHTH + (SWING if e % 2 else 0)
        if et > DUR - 1.5:
            continue
        shaker(et, 0.05 if e % 2 == 0 else 0.032, 0.4 + 0.2 * (e % 3))

    if bar_t0 > DUR - 2.2:
        continue
    for e in range(8):
        mt = bar_t0 + e * EIGHTH + (SWING if e % 2 else 0)
        if mt > DUR - 2:
            continue
        deg = melody_pat[(bar * 8 + e) % len(melody_pat)]
        oct_up = 2 if (bar + e) % 5 == 0 else 1
        f = PENTA[deg % 5] * oct_up
        amp = 0.11 if e % 2 == 0 else 0.075
        pan = 0.42 + 0.16 * math.sin(bar * 0.7 + e)
        pluck(mt, f, amp, pan, decay=7.5, dur=EIGHTH * 1.9, harm=(1.0, 0.4, 0.18))

# ---- 明るい残響、フェード、正規化 ----
dly = int(EIGHTH * SR * 1.5)
for buf in (L, R):
    for i in range(dly, N):
        buf[i] += 0.16 * buf[i - dly]

fin, fout = int(0.6 * SR), int(3.0 * SR)
for i in range(N):
    g = min(1.0, i / fin) * min(1.0, (N - i) / fout)
    L[i] *= g
    R[i] *= g

peak = max(max(map(abs, L)), max(map(abs, R))) or 1.0
sc = 0.88 / peak

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bgm.wav")
with wave.open(out, "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        frames += struct.pack("<hh", int(max(-1, min(1, L[i] * sc)) * 32767),
                               int(max(-1, min(1, R[i] * sc)) * 32767))
    w.writeframes(bytes(frames))
print("wrote", out, f"{DUR}s  BPM={BPM}")
