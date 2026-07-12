# 都節音階（みやこぶし）ベースの和モダン・アンビエントBGMを合成して media/bgm.wav に出力する
import math, struct, wave, os

SR = 22050
DUR = 64.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N

D3, D4 = 146.83, 293.66
SCALE = [293.66, 311.13, 392.00, 440.00, 466.16, 587.33, 622.25]  # D 都節音階

def add_pad(buf, t0, dur, freqs, amp, pan):
    a_len, r_len = int(1.8 * SR), int(2.2 * SR)
    s0, s1 = int(t0 * SR), min(int((t0 + dur) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        k = i - s0
        env = min(1.0, k / a_len) * min(1.0, (s1 - i) / r_len)
        v = 0.0
        for f in freqs:
            v += math.sin(2 * math.pi * f * t) + 0.35 * math.sin(2 * math.pi * f * 1.003 * t)
        v *= amp * env * (0.9 + 0.1 * math.sin(2 * math.pi * 0.25 * t))
        buf[i] += v

def pluck(t0, f, amp, pan):
    dur = 1.8
    s0, s1 = int(t0 * SR), min(int((t0 + 1.8) * SR), N)
    for i in range(s0, s1):
        t = (i - s0) / SR
        env = math.exp(-3.2 * t) * min(1.0, t * 200)
        v = (math.sin(2 * math.pi * f * t) + 0.5 * math.sin(4 * math.pi * f * t)
             + 0.22 * math.sin(6 * math.pi * f * t)) * amp * env
        L[i] += v * (1 - pan)
        R[i] += v * pan

# ---- パッド：8秒×8コード（D中心のモーダル進行） ----
prog = [
    [D3, D3 * 1.5, D4],            # D5
    [D3 * 4 / 3, D3 * 2, 392.0],   # G
    [155.56, 233.08, 311.13],      # Eb(ゆらぎ)
    [D3, D3 * 1.5, D4],
    [116.54, 174.92, 233.08],      # Bb
    [D3 * 4 / 3, D3 * 2, 392.0],
    [D3, D3 * 1.5, D4],
    [D3, D3 * 1.5, D4 * 1.5],
]
for ci, ch in enumerate(prog):
    add_pad(L, ci * 8.0, 9.0, ch, 0.055, 0.4)
    add_pad(R, ci * 8.0 + 0.02, 9.0, [f * 0.999 for f in ch], 0.055, 0.6)

# ---- 琴風プラック：決定論的なフレーズ ----
seq = [0, 2, 3, 5, 4, 3, 2, 0, 1, 0, 2, 4, 5, 6, 5, 3,
       2, 3, 4, 2, 0, 2, 3, 5, 6, 5, 4, 3, 2, 1, 0, 2]
beat = 1.7
for k, idx in enumerate(seq):
    t0 = 3.0 + k * beat
    if t0 > DUR - 3:
        break
    f = SCALE[idx % len(SCALE)]
    if k % 7 == 3:
        f /= 2
    pluck(t0, f, 0.16 if k % 4 else 0.20, 0.35 + 0.3 * ((k * 7) % 5) / 4)
    if k % 4 == 0:
        pluck(t0 + beat * 0.5, SCALE[(idx + 2) % len(SCALE)], 0.10, 0.65)

# ---- エコー、フェード、正規化 ----
dly = int(0.42 * SR)
for buf in (L, R):
    for i in range(dly, N):
        buf[i] += 0.32 * buf[i - dly]
fin, fout = int(2.5 * SR), int(4.5 * SR)
for i in range(N):
    g = min(1.0, i / fin) * min(1.0, (N - i) / fout)
    L[i] *= g
    R[i] *= g
peak = max(max(map(abs, L)), max(map(abs, R))) or 1.0
sc = 0.85 / peak

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bgm.wav")
with wave.open(out, "w") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    frames = bytearray()
    for i in range(N):
        frames += struct.pack("<hh", int(L[i] * sc * 32767), int(R[i] * sc * 32767))
    w.writeframes(bytes(frames))
print("wrote", out, f"{DUR}s")
