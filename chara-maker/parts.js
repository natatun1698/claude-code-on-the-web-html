/* そっくりメーカー パーツ定義 & SVG描画エンジン
   各カテゴリのバリエーションは「形 × サイズ/色」の掛け合わせで
   パラメトリックに生成し、50種類以上を保証する。 */
"use strict";

// ---------- 色ユーティリティ ----------
function hsl(h, s, l) { return `hsl(${h},${s}%,${l}%)`; }
function shade(hslStr, dl) {
  const m = hslStr.match(/hsl\((-?[\d.]+),([\d.]+)%,([\d.]+)%\)/);
  if (!m) return hslStr;
  return hsl(+m[1], +m[2], Math.max(0, Math.min(100, +m[3] + dl)));
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// ---------- 肌色 56色 (7アンダートーン × 8明度) ----------
const SKIN_COLORS = [];
[
  { h: 27, s: 55 }, { h: 22, s: 60 }, { h: 32, s: 48 }, { h: 18, s: 45 },
  { h: 36, s: 40 }, { h: 14, s: 52 }, { h: 24, s: 35 },
].forEach(t => {
  [92, 86, 79, 72, 64, 55, 45, 34].forEach(l => SKIN_COLORS.push({ h: t.h, s: t.s, l }));
});

// ---------- 髪色 56色 ----------
const HAIR_COLORS = [];
[
  { h: 0, s: 0 },    // 黒〜グレー
  { h: 25, s: 45 },  // 茶
  { h: 32, s: 65 },  // 明るい茶
  { h: 45, s: 70 },  // 金
  { h: 15, s: 75 },  // 赤茶
  { h: 350, s: 55 }, // ピンク系
  { h: 210, s: 45 }, // 青系
  { h: 130, s: 35 }, // 緑系
].forEach(t => {
  [10, 20, 30, 42, 55, 68, 80].forEach(l => HAIR_COLORS.push({ h: t.h, s: t.s, l }));
});

// ---------- 瞳の色 56色 ----------
const EYE_COLORS = [];
[
  { h: 20, s: 30 }, { h: 25, s: 60 }, { h: 210, s: 60 }, { h: 130, s: 45 },
  { h: 275, s: 50 }, { h: 0, s: 0 }, { h: 40, s: 70 },
].forEach(t => {
  [12, 22, 32, 42, 52, 62, 72, 82].forEach(l => EYE_COLORS.push({ h: t.h, s: t.s, l }));
});

// ---------- 服の色 ----------
const OUTFIT_COLORS = [
  { h: 220, s: 30, l: 25 }, { h: 0, s: 0, l: 92 }, { h: 8, s: 65, l: 55 },
  { h: 210, s: 60, l: 55 }, { h: 140, s: 40, l: 45 }, { h: 45, s: 80, l: 60 },
];

// ---------- 輪郭 60種 (あご5 × 幅4 × あご長3) ----------
const JAW_TYPES = [
  { name: "丸", jw: 0.62, round: 1.0 },
  { name: "卵", jw: 0.50, round: 0.85 },
  { name: "面長", jw: 0.44, round: 0.8 },
  { name: "しっかり", jw: 0.74, round: 0.6 },
  { name: "シャープ", jw: 0.34, round: 0.7 },
];
const FACE_SHAPES = [];
JAW_TYPES.forEach((j, ji) => {
  [0.88, 0.97, 1.06, 1.15].forEach(wf => {
    [0, 1, 2].forEach(ch => FACE_SHAPES.push({ jaw: ji, wf, chin: ch }));
  });
});

// ---------- 髪型 60種 (前髪6 × 後ろ髪5 × ボリューム2) ----------
const BANGS = ["ぱっつん", "ななめ", "センター分け", "うすめ", "短め", "なし"];
const BACKS = ["ショート", "ボブ", "ミディアム", "ロング", "結び"];
const HAIR_STYLES = [];
BANGS.forEach((b, bi) => BACKS.forEach((bk, ki) => [0, 1].forEach(v =>
  HAIR_STYLES.push({ bangs: bi, back: ki, vol: v }))));

// ---------- 目 56種 (形8 × 大きさ7) ----------
const EYE_SHAPES = ["まる", "たれ目", "つり目", "ほそ目", "アーモンド", "ぱっちり", "半月", "ジト目"];
const EYES = [];
EYE_SHAPES.forEach((s, si) => [0.6, 0.75, 0.9, 1.0, 1.15, 1.3, 1.5].forEach(sz =>
  EYES.push({ shape: si, size: sz })));

// ---------- 眉 50種 (形10 × 太さ5) ----------
const BROW_SHAPES = ["ストレート", "アーチ", "太アーチ", "下がり", "上がり", "短め", "長め", "まる", "への字", "キリッ"];
const BROWS = [];
BROW_SHAPES.forEach((s, si) => [1.4, 2.2, 3.2, 4.4, 6].forEach(th =>
  BROWS.push({ shape: si, th })));

// ---------- 鼻 50種 (形10 × 大きさ5) ----------
const NOSE_SHAPES = ["ちょん", "点", "小丸", "まる", "たて線", "L字", "やま", "はば広", "高め", "鼻すじ"];
const NOSES = [];
NOSE_SHAPES.forEach((s, si) => [0.6, 0.8, 1.0, 1.25, 1.5].forEach(sz =>
  NOSES.push({ shape: si, size: sz })));

// ---------- 口 60種 (形12 × 大きさ5) ----------
const MOUTH_SHAPES = ["にっこり", "ほほえみ", "真顔", "への字", "笑い(開)", "歯みせ", "おちょぼ", "おおくち", "ぽかん", "てへ", "ニヤリ", "むむっ"];
const MOUTHS = [];
MOUTH_SHAPES.forEach((s, si) => [0.6, 0.8, 1.0, 1.25, 1.5].forEach(sz =>
  MOUTHS.push({ shape: si, size: sz })));

// ---------- 耳 50種 (形5 × 大きさ5 × 張り出し2) ----------
const EAR_SHAPES = ["まる", "たまご", "小さめ", "とがり", "ふくよか"];
const EARS = [];
EAR_SHAPES.forEach((s, si) => [0.7, 0.85, 1.0, 1.2, 1.4].forEach(sz =>
  [0, 1].forEach(st => EARS.push({ shape: si, size: sz, stick: st }))));

// ---------- 服 60種 (種類10 × 色6) ----------
const OUTFIT_TYPES = ["Tシャツ", "ひつじ柄", "パーカー", "えりシャツ", "セーラー", "セーター", "ワンピース", "ジャージ", "スーツ", "タンクトップ"];
const OUTFITS = [];
OUTFIT_TYPES.forEach((t, ti) => OUTFIT_COLORS.forEach((c, ci) =>
  OUTFITS.push({ type: ti, color: ci })));

// ---------- アクセサリー 55種 ----------
const ACCESSORIES = [{ kind: "none" }];
["まる", "しかく", "ハーフ", "ふちなし", "おおきめ", "ねこ目"].forEach((g, gi) =>
  [{ h: 0, s: 0, l: 20 }, { h: 8, s: 60, l: 50 }, { h: 210, s: 50, l: 45 }].forEach(c =>
    ACCESSORIES.push({ kind: "glasses", style: gi, c })));           // 18
[{ h: 350, s: 70, l: 60 }, { h: 45, s: 80, l: 55 }, { h: 210, s: 60, l: 55 }, { h: 0, s: 0, l: 25 }].forEach(c =>
  [0, 1].forEach(side => ACCESSORIES.push({ kind: "ribbon", c, side })));   // 8
[{ h: 0, s: 0, l: 20 }, { h: 8, s: 60, l: 45 }, { h: 45, s: 60, l: 55 }].forEach(c =>
  [0, 1].forEach(st => ACCESSORIES.push({ kind: "hat", style: st, c })));   // 6
[{ h: 45, s: 80, l: 55 }, { h: 0, s: 0, l: 75 }, { h: 350, s: 60, l: 60 }].forEach(c =>
  ACCESSORIES.push({ kind: "earring", c }));                                // 3
[1, 2, 3].forEach(v => ACCESSORIES.push({ kind: "blush", v }));             // 3
ACCESSORIES.push({ kind: "freckles" });                                     // 1
[{ h: 350, s: 70, l: 60 }, { h: 45, s: 80, l: 55 }, { h: 210, s: 60, l: 55 }, { h: 130, s: 40, l: 50 }].forEach(c =>
  ACCESSORIES.push({ kind: "hairpin", c }));                                // 4
[{ h: 350, s: 60, l: 65 }, { h: 210, s: 50, l: 60 }, { h: 45, s: 70, l: 60 }].forEach(c =>
  ACCESSORIES.push({ kind: "headband", c }));                               // 3
ACCESSORIES.push({ kind: "mask" });                                         // 1
[{ h: 45, s: 80, l: 55 }, { h: 0, s: 0, l: 70 }].forEach(c =>
  ACCESSORIES.push({ kind: "necklace", c }));                               // 2
[1, 2].forEach(v => ACCESSORIES.push({ kind: "mole", v }));                 // 2
ACCESSORIES.push({ kind: "bandaid" });                                      // 1
ACCESSORIES.push({ kind: "star" });                                         // 1
ACCESSORIES.push({ kind: "tear" });                                         // 1
ACCESSORIES.push({ kind: "beard" });                                        // 1
ACCESSORIES.push({ kind: "mustache" });                                     // 1

// ---------- デフォルト状態 ----------
function defaultState() {
  return {
    name: "",
    sel: {
      faceShape: 13, skin: 9, hair: 2, hairColor: 2, eyes: 3, eyeColor: 3,
      brows: 6, nose: 12, mouth: 2, ears: 14, outfit: 6, accessory: 0,
    },
    tune: {
      skinL: 0, hairL: 0, faceW: 0,
      eyeGap: 0, eyeY: 0, eyeRot: 0,
      browY: 0, noseY: 0, mouthY: 0, mouthW: 0, earSize: 0,
    },
  };
}

// ---------- 描画 ----------
function renderAvatar(state) {
  const s = state.sel, t = state.tune;
  const fs = FACE_SHAPES[s.faceShape], jaw = JAW_TYPES[fs.jaw];
  const skin0 = SKIN_COLORS[s.skin];
  const skin = hsl(skin0.h, skin0.s, Math.max(5, Math.min(97, skin0.l + t.skinL)));
  const hc0 = HAIR_COLORS[s.hairColor];
  const hair = hsl(hc0.h, hc0.s, Math.max(3, Math.min(95, hc0.l + t.hairL)));
  const ec0 = EYE_COLORS[s.eyeColor];
  const eyeC = hsl(ec0.h, ec0.s, ec0.l);
  const line = shade(skin, -32);

  const wf = fs.wf * (1 + t.faceW / 100);
  const w = 66 * wf, top = 78, sideY = 152;
  const chinY = 236 + fs.chin * 9, jw = w * jaw.jw;
  const facePath = `M160 ${top}
    C ${160 + w * 0.72} ${top} ${160 + w} ${sideY - 42} ${160 + w} ${sideY}
    C ${160 + w} ${sideY + 46 * jaw.round} ${160 + jw} ${chinY} 160 ${chinY + 7}
    C ${160 - jw} ${chinY} ${160 - w} ${sideY + 46 * jaw.round} ${160 - w} ${sideY}
    C ${160 - w} ${sideY - 42} ${160 - w * 0.72} ${top} 160 ${top} Z`;

  // --- 耳 ---
  const ear = EARS[s.ears];
  const eScale = ear.size * (1 + t.earSize / 100);
  const eR = { まる: [11, 13], たまご: [9, 14], 小さめ: [8, 9], とがり: [10, 15], ふくよか: [13, 15] }[EAR_SHAPES[ear.shape]];
  const eX = w - 3 + ear.stick * 5, eY = 170;
  const earSvg = [-1, 1].map(d => {
    const cx = 160 + d * eX;
    if (EAR_SHAPES[ear.shape] === "とがり")
      return `<path d="M${cx} ${eY + eR[1] * eScale} Q ${cx + d * eR[0] * eScale * 1.6} ${eY} ${cx} ${eY - eR[1] * eScale}" fill="${skin}" stroke="${line}" stroke-width="2"/>`;
    return `<ellipse cx="${cx + d * 2}" cy="${eY}" rx="${eR[0] * eScale}" ry="${eR[1] * eScale}" fill="${skin}" stroke="${line}" stroke-width="2"/>`;
  }).join("");

  // --- 髪(後ろ) ---
  const hs = HAIR_STYLES[s.hair];
  const vol = 1 + hs.vol * 0.12;
  const hw = w * 1.12 * vol;
  const backLen = [190, 235, 275, 330, 240][hs.back];
  let backSvg = "";
  if (hs.back === 4) { // 結び
    backSvg = `<path d="M${160 - hw} 150 Q 160 ${-24} ${160 + hw} 150 L ${160 + hw * 0.9} ${backLen} Q 160 ${backLen + 18} ${160 - hw * 0.9} ${backLen} Z" fill="${hair}"/>
      <ellipse cx="${160 + hw + 6}" cy="120" rx="14" ry="26" fill="${hair}"/>
      <ellipse cx="${160 - hw - 6}" cy="120" rx="14" ry="26" fill="${hair}"/>`;
  } else {
    backSvg = `<path d="M${160 - hw} 150 Q 160 ${-24 - hs.vol * 10} ${160 + hw} 150 L ${160 + hw * 0.92} ${backLen} Q 160 ${backLen + 22} ${160 - hw * 0.92} ${backLen} Z" fill="${hair}"/>`;
  }

  // --- 髪(前) ---
  const fw = w * 1.06 * vol, ft = 62 - hs.vol * 6;
  const bangsPaths = {
    0: `M${160 - fw} 150 Q 160 ${ft - 80} ${160 + fw} 150 L ${160 + fw * 0.8} 128 L 160 122 L ${160 - fw * 0.8} 128 Z
        M${160 - fw * 0.8} 128 L ${160 + fw * 0.8} 128 Q 160 140 ${160 - fw * 0.8} 128`,
    1: `M${160 - fw} 150 Q 160 ${ft - 80} ${160 + fw} 150 L ${160 + fw * 0.85} 132 Q ${160 + 20} 108 ${160 - fw * 0.55} 140 L ${160 - fw * 0.85} 132 Z`,
    2: `M${160 - fw} 150 Q 160 ${ft - 80} ${160 + fw} 150 L ${160 + fw * 0.85} 130 Q ${160 + fw * 0.35} 118 ${160 + 6} 138 L 160 118 L ${160 - 6} 138 Q ${160 - fw * 0.35} 118 ${160 - fw * 0.85} 130 Z`,
    3: `M${160 - fw} 150 Q 160 ${ft - 80} ${160 + fw} 150 L ${160 + fw * 0.85} 126 L ${160 + fw * 0.5} 136 L ${160 + fw * 0.2} 120 L ${160 - fw * 0.1} 136 L ${160 - fw * 0.45} 120 L ${160 - fw * 0.85} 130 Z`,
    4: `M${160 - fw} 148 Q 160 ${ft - 76} ${160 + fw} 148 L ${160 + fw * 0.85} 112 Q 160 96 ${160 - fw * 0.85} 112 Z`,
    5: `M${160 - fw} 148 Q 160 ${ft - 82} ${160 + fw} 148 L ${160 + fw * 0.9} 104 Q 160 82 ${160 - fw * 0.9} 104 Z`,
  };
  const frontSvg = `<path d="${bangsPaths[hs.bangs]}" fill="${hair}"/>`;

  // --- 目 ---
  const ey = EYES[s.eyes];
  const gap = 32 + t.eyeGap, eyY = 168 + t.eyeY;
  const esz = ey.size;
  const eyeSvg = [-1, 1].map(d => {
    const cx = 160 + d * gap, rot = d * -t.eyeRot;
    const g = `transform="rotate(${rot} ${cx} ${eyY})"`;
    const shape = EYE_SHAPES[ey.shape];
    const rx = 11 * esz, ry = 13 * esz;
    let inner = "";
    if (shape === "ほそ目")
      inner = `<path d="M${cx - rx} ${eyY} Q ${cx} ${eyY + 6 * esz} ${cx + rx} ${eyY}" stroke="${eyeC}" stroke-width="${3.4 * esz}" fill="none" stroke-linecap="round"/>`;
    else if (shape === "半月")
      inner = `<path d="M${cx - rx} ${eyY} A ${rx} ${ry * 0.9} 0 0 0 ${cx + rx} ${eyY} Z" fill="${eyeC}"/><circle cx="${cx + rx * 0.3}" cy="${eyY + ry * 0.3}" r="${2.4 * esz}" fill="#fff"/>`;
    else if (shape === "ジト目")
      inner = `<rect x="${cx - rx}" y="${eyY - ry * 0.35}" width="${rx * 2}" height="${ry * 0.9}" rx="${ry * 0.3}" fill="${eyeC}"/><rect x="${cx - rx}" y="${eyY - ry * 0.55}" width="${rx * 2}" height="${ry * 0.28}" fill="${line}"/>`;
    else {
      let ry2 = ry, tilt = 0;
      if (shape === "たれ目") tilt = 12;
      if (shape === "つり目") tilt = -12;
      if (shape === "アーモンド") ry2 = ry * 0.72;
      if (shape === "ぱっちり") ry2 = ry * 1.15;
      inner = `<g transform="rotate(${d * tilt} ${cx} ${eyY})">
        <ellipse cx="${cx}" cy="${eyY}" rx="${rx}" ry="${ry2}" fill="${eyeC}"/>
        <circle cx="${cx - rx * 0.3}" cy="${eyY - ry2 * 0.35}" r="${2.6 * esz}" fill="#fff"/>
        ${shape === "ぱっちり" ? `<path d="M${cx - rx} ${eyY - ry2} Q ${cx} ${eyY - ry2 - 5} ${cx + rx} ${eyY - ry2}" stroke="${line}" stroke-width="2" fill="none"/>` : ""}
      </g>`;
    }
    return `<g ${g}>${inner}</g>`;
  }).join("");

  // --- 眉 ---
  const br = BROWS[s.brows];
  const brY = 146 + t.browY;
  const browSvg = [-1, 1].map(d => {
    const cx = 160 + d * 33;
    const shape = BROW_SHAPES[br.shape];
    const bw = { 短め: 10, 長め: 20 }[shape] || 15;
    let curve = 0, slope = 0;
    if (["アーチ", "太アーチ", "まる"].includes(shape)) curve = -6;
    if (shape === "下がり") slope = 5;
    if (["上がり", "キリッ"].includes(shape)) slope = -5;
    if (shape === "への字") { slope = -4; curve = 3; }
    return `<path d="M${cx - d * bw} ${brY + slope} Q ${cx} ${brY + curve - slope * 0.5} ${cx + d * bw} ${brY - slope}"
      stroke="${hair}" stroke-width="${br.th}" fill="none" stroke-linecap="round"/>`;
  }).join("");

  // --- 鼻 ---
  const no = NOSES[s.nose];
  const nY = 195 + t.noseY, nsz = no.size;
  const noseShapes = {
    ちょん: `<circle cx="160" cy="${nY}" r="${2 * nsz}" fill="${line}"/>`,
    点: `<ellipse cx="160" cy="${nY}" rx="${1.6 * nsz}" ry="${2.4 * nsz}" fill="${line}"/>`,
    小丸: `<circle cx="160" cy="${nY}" r="${3.5 * nsz}" fill="${shade(skin, -12)}" stroke="${line}" stroke-width="1.4"/>`,
    まる: `<circle cx="160" cy="${nY}" r="${5.5 * nsz}" fill="${shade(skin, -12)}" stroke="${line}" stroke-width="1.4"/>`,
    たて線: `<path d="M160 ${nY - 9 * nsz} L 160 ${nY + 3 * nsz}" stroke="${line}" stroke-width="2.2" stroke-linecap="round"/>`,
    L字: `<path d="M160 ${nY - 9 * nsz} L 160 ${nY + 2 * nsz} L ${160 - 5 * nsz} ${nY + 3 * nsz}" stroke="${line}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    やま: `<path d="M${160 - 5 * nsz} ${nY + 3 * nsz} L 160 ${nY - 6 * nsz} L ${160 + 5 * nsz} ${nY + 3 * nsz}" stroke="${line}" stroke-width="2" fill="none" stroke-linejoin="round"/>`,
    はば広: `<ellipse cx="160" cy="${nY}" rx="${8 * nsz}" ry="${4.5 * nsz}" fill="${shade(skin, -10)}" stroke="${line}" stroke-width="1.4"/>`,
    高め: `<path d="M${160 - 2} ${nY - 12 * nsz} Q ${160 + 4 * nsz} ${nY - 3} ${160 - 1} ${nY + 3 * nsz} L ${160 - 4 * nsz} ${nY + 3 * nsz}" stroke="${line}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    鼻すじ: `<path d="M${160 - 3} ${nY - 13 * nsz} L ${160 - 3} ${nY} M${160 + 3} ${nY - 13 * nsz} L ${160 + 3} ${nY} M${160 - 5 * nsz} ${nY + 3} Q 160 ${nY + 6 * nsz} ${160 + 5 * nsz} ${nY + 3}" stroke="${line}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  };
  const noseSvg = noseShapes[NOSE_SHAPES[no.shape]];

  // --- 口 ---
  const mo = MOUTHS[s.mouth];
  const mY = 218 + t.mouthY, msz = mo.size * (1 + t.mouthW / 100);
  const mw = 16 * msz;
  const lip = hsl(5, 60, 55);
  const mouthShapes = {
    にっこり: `<path d="M${160 - mw} ${mY} Q 160 ${mY + 12 * msz} ${160 + mw} ${mY}" stroke="${line}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    ほほえみ: `<path d="M${160 - mw * 0.7} ${mY} Q 160 ${mY + 6 * msz} ${160 + mw * 0.7} ${mY}" stroke="${line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    真顔: `<path d="M${160 - mw * 0.7} ${mY + 2} L ${160 + mw * 0.7} ${mY + 2}" stroke="${line}" stroke-width="2.4" stroke-linecap="round"/>`,
    への字: `<path d="M${160 - mw * 0.7} ${mY + 5} Q 160 ${mY - 5 * msz} ${160 + mw * 0.7} ${mY + 5}" stroke="${line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    "笑い(開)": `<path d="M${160 - mw} ${mY - 2} Q 160 ${mY + 16 * msz} ${160 + mw} ${mY - 2} Z" fill="${hsl(5, 60, 40)}"/><path d="M${160 - mw * 0.6} ${mY + 7 * msz} Q 160 ${mY + 13 * msz} ${160 + mw * 0.6} ${mY + 7 * msz} L ${160 - mw * 0.6} ${mY + 7 * msz}" fill="${lip}"/>`,
    歯みせ: `<path d="M${160 - mw} ${mY - 2} Q 160 ${mY + 15 * msz} ${160 + mw} ${mY - 2} Z" fill="${hsl(5, 60, 40)}"/><rect x="${160 - mw * 0.8}" y="${mY - 1}" width="${mw * 1.6}" height="${4.5 * msz}" rx="2" fill="#fff"/>`,
    おちょぼ: `<circle cx="160" cy="${mY + 3}" r="${4 * msz}" fill="${lip}"/>`,
    おおくち: `<ellipse cx="160" cy="${mY + 4}" rx="${mw}" ry="${9 * msz}" fill="${hsl(5, 60, 40)}"/><path d="M${160 - mw * 0.5} ${mY + 9 * msz} Q 160 ${mY + 13 * msz} ${160 + mw * 0.5} ${mY + 9 * msz}" fill="${lip}"/>`,
    ぽかん: `<ellipse cx="160" cy="${mY + 3}" rx="${5 * msz}" ry="${6.5 * msz}" fill="${hsl(5, 60, 40)}"/>`,
    てへ: `<path d="M${160 - mw * 0.8} ${mY} Q 160 ${mY + 11 * msz} ${160 + mw * 0.8} ${mY}" stroke="${line}" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="160" cy="${mY + 7 * msz}" rx="${5 * msz}" ry="${4 * msz}" fill="${lip}"/>`,
    ニヤリ: `<path d="M${160 - mw} ${mY + 3} Q ${160 + mw * 0.2} ${mY + 10 * msz} ${160 + mw} ${mY - 4}" stroke="${line}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    むむっ: `<path d="M${160 - mw * 0.8} ${mY + 2} Q ${160 - mw * 0.3} ${mY + 6} 160 ${mY + 2} Q ${160 + mw * 0.3} ${mY - 2} ${160 + mw * 0.8} ${mY + 2}" stroke="${line}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  };
  const mouthSvg = mouthShapes[MOUTH_SHAPES[mo.shape]];

  // --- 服 ---
  const of = OUTFITS[s.outfit];
  const oc0 = OUTFIT_COLORS[of.color];
  const oc = hsl(oc0.h, oc0.s, oc0.l), oc2 = shade(oc, -14);
  const neckW = 17 * wf, shY = 285;
  const bodyBase = `M${160 - 85} 360 Q ${160 - 85} ${shY} ${160 - 40} ${shY - 8} L ${160 - neckW} ${shY - 14} L ${160 - neckW} ${chinY - 4} L ${160 + neckW} ${chinY - 4} L ${160 + neckW} ${shY - 14} L ${160 + 40} ${shY - 8} Q ${160 + 85} ${shY} ${160 + 85} 360 Z`;
  let outfitSvg = `<path d="${bodyBase}" fill="${skin}"/>`;
  const collarY = shY - 12;
  const torso = (extra) => `<path d="M${160 - 85} 360 Q ${160 - 85} ${shY} ${160 - 42} ${collarY} Q 160 ${collarY + 14} ${160 + 42} ${collarY} Q ${160 + 85} ${shY} ${160 + 85} 360 Z" fill="${oc}"/>${extra || ""}`;
  const otype = OUTFIT_TYPES[of.type];
  if (otype === "Tシャツ") outfitSvg += torso(`<path d="M${160 - 26} ${collarY - 2} Q 160 ${collarY + 16} ${160 + 26} ${collarY - 2}" stroke="${oc2}" stroke-width="4" fill="none"/>`);
  else if (otype === "ひつじ柄") {
    let sheep = "";
    for (let i = 0; i < 7; i++) {
      const sx = 100 + (i % 4) * 42 + (i > 3 ? 20 : 0), sy = 305 + Math.floor(i / 4) * 34;
      sheep += `<ellipse cx="${sx}" cy="${sy}" rx="10" ry="7" fill="#f3ede2"/><circle cx="${sx + 8}" cy="${sy + 1}" r="4" fill="#d8c8b8"/>`;
    }
    outfitSvg += torso(sheep);
  } else if (otype === "パーカー") outfitSvg += torso(`<path d="M${160 - 34} ${collarY} Q 160 ${collarY + 28} ${160 + 34} ${collarY} Q 160 ${collarY - 10} ${160 - 34} ${collarY}" fill="${oc2}"/><path d="M160 ${collarY + 22} L 160 340" stroke="${oc2}" stroke-width="3"/><path d="M${160 - 6} ${collarY + 24} L ${160 - 6} ${collarY + 44} M${160 + 6} ${collarY + 24} L ${160 + 6} ${collarY + 44}" stroke="#fff" stroke-width="3"/>`);
  else if (otype === "えりシャツ") outfitSvg += torso(`<path d="M${160 - 24} ${collarY - 4} L 160 ${collarY + 18} L ${160 - 20} ${collarY + 12} Z" fill="#fff"/><path d="M${160 + 24} ${collarY - 4} L 160 ${collarY + 18} L ${160 + 20} ${collarY + 12} Z" fill="#fff"/><circle cx="160" cy="${collarY + 30}" r="2.5" fill="${oc2}"/><circle cx="160" cy="${collarY + 46}" r="2.5" fill="${oc2}"/>`);
  else if (otype === "セーラー") outfitSvg += torso(`<path d="M${160 - 40} ${collarY} L 160 ${collarY + 34} L ${160 + 40} ${collarY} L ${160 + 46} ${collarY + 14} L 160 ${collarY + 44} L ${160 - 46} ${collarY + 14} Z" fill="#fff" stroke="${oc2}" stroke-width="2"/><path d="M160 ${collarY + 34} L ${160 - 8} ${collarY + 52} L ${160 + 8} ${collarY + 52} Z" fill="${hsl(0, 70, 55)}"/>`);
  else if (otype === "セーター") outfitSvg += torso(`<path d="M${160 - 30} ${collarY} Q 160 ${collarY + 14} ${160 + 30} ${collarY}" stroke="${oc2}" stroke-width="8" fill="none"/><path d="M${160 - 60} 315 L ${160 + 60} 315 M${160 - 62} 330 L ${160 + 62} 330 M${160 - 64} 345 L ${160 + 64} 345" stroke="${oc2}" stroke-width="2.4"/>`);
  else if (otype === "ワンピース") outfitSvg += torso(`<path d="M${160 - 26} ${collarY} Q 160 ${collarY + 12} ${160 + 26} ${collarY}" stroke="#fff" stroke-width="4" fill="none"/><circle cx="160" cy="${collarY + 22}" r="4" fill="#fff"/><path d="M${160 - 70} 340 Q 160 352 ${160 + 70} 340" stroke="#fff" stroke-width="3" fill="none"/>`);
  else if (otype === "ジャージ") outfitSvg += torso(`<path d="M${160 - 42} ${collarY} L ${160 - 34} 360 M${160 + 42} ${collarY} L ${160 + 34} 360" stroke="#fff" stroke-width="5"/><path d="M160 ${collarY + 10} L 160 360" stroke="${oc2}" stroke-width="3"/>`);
  else if (otype === "スーツ") outfitSvg += torso(`<path d="M${160 - 36} ${collarY - 2} L 160 ${collarY + 30} L ${160 - 26} ${collarY + 20} Z" fill="${oc2}"/><path d="M${160 + 36} ${collarY - 2} L 160 ${collarY + 30} L ${160 + 26} ${collarY + 20} Z" fill="${oc2}"/><path d="M${160 - 10} ${collarY + 2} L 160 ${collarY + 30} L ${160 + 10} ${collarY + 2} L 160 ${collarY - 6} Z" fill="#fff"/><path d="M160 ${collarY + 2} L ${160 - 4} ${collarY + 18} L 160 ${collarY + 34} L ${160 + 4} ${collarY + 18} Z" fill="${hsl(0, 65, 45)}"/>`);
  else if (otype === "タンクトップ") outfitSvg += torso(`<path d="M${160 - 42} ${collarY} L ${160 - 56} ${shY + 16} M${160 + 42} ${collarY} L ${160 + 56} ${shY + 16}" stroke="${skin}" stroke-width="16"/><path d="M${160 - 30} ${collarY} Q 160 ${collarY + 20} ${160 + 30} ${collarY}" stroke="${oc2}" stroke-width="3" fill="none"/>`);

  // --- アクセサリー ---
  const ac = ACCESSORIES[s.accessory];
  let accSvg = "";
  const acC = ac.c ? hsl(ac.c.h, ac.c.s, ac.c.l) : "#333";
  if (ac.kind === "glasses") {
    const gy = eyY, gr = 16 + [0, 0, 0, -2, 4, 0][ac.style];
    const lens = ac.style === 1 ? `<rect x="${160 - 33 - gr}" y="${gy - gr * 0.8}" width="${gr * 2}" height="${gr * 1.6}" rx="4" fill="none" stroke="${acC}" stroke-width="2.6"/><rect x="${160 + 33 - gr}" y="${gy - gr * 0.8}" width="${gr * 2}" height="${gr * 1.6}" rx="4" fill="none" stroke="${acC}" stroke-width="2.6"/>`
      : ac.style === 2 ? `<path d="M${160 - 33 - gr} ${gy} A ${gr} ${gr * 0.7} 0 0 0 ${160 - 33 + gr} ${gy}" fill="none" stroke="${acC}" stroke-width="2.6"/><path d="M${160 + 33 - gr} ${gy} A ${gr} ${gr * 0.7} 0 0 0 ${160 + 33 + gr} ${gy}" fill="none" stroke="${acC}" stroke-width="2.6"/>`
      : ac.style === 5 ? `<path d="M${160 - 33 - gr} ${gy - 4} Q ${160 - 33} ${gy - gr} ${160 - 33 + gr} ${gy - 6} Q ${160 - 33 + gr * 0.8} ${gy + gr * 0.7} ${160 - 33 - gr * 0.6} ${gy + gr * 0.5} Z" fill="none" stroke="${acC}" stroke-width="2.4"/><path d="M${160 + 33 + gr} ${gy - 4} Q ${160 + 33} ${gy - gr} ${160 + 33 - gr} ${gy - 6} Q ${160 + 33 - gr * 0.8} ${gy + gr * 0.7} ${160 + 33 + gr * 0.6} ${gy + gr * 0.5} Z" fill="none" stroke="${acC}" stroke-width="2.4"/>`
      : `<circle cx="${160 - 33}" cy="${gy}" r="${gr}" fill="none" stroke="${acC}" stroke-width="${ac.style === 3 ? 1.4 : 2.6}"/><circle cx="${160 + 33}" cy="${gy}" r="${gr}" fill="none" stroke="${acC}" stroke-width="${ac.style === 3 ? 1.4 : 2.6}"/>`;
    accSvg = `${lens}<path d="M${160 - 15} ${gy} L ${160 + 15} ${gy}" stroke="${acC}" stroke-width="2.4"/><path d="M${160 - 33 - gr} ${gy} L ${160 - w - 2} ${gy - 4} M${160 + 33 + gr} ${gy} L ${160 + w + 2} ${gy - 4}" stroke="${acC}" stroke-width="2"/>`;
  } else if (ac.kind === "ribbon") {
    const rx = ac.side ? 160 + fw * 0.62 : 160 - fw * 0.62, ry = 96;
    accSvg = `<path d="M${rx} ${ry} L ${rx - 16} ${ry - 10} L ${rx - 16} ${ry + 10} Z M${rx} ${ry} L ${rx + 16} ${ry - 10} L ${rx + 16} ${ry + 10} Z" fill="${acC}"/><circle cx="${rx}" cy="${ry}" r="5" fill="${shade(acC, -14)}"/>`;
  } else if (ac.kind === "hat") {
    accSvg = ac.style === 0
      ? `<path d="M${160 - fw * 0.95} 92 Q 160 30 ${160 + fw * 0.95} 92 Z" fill="${acC}"/><rect x="${160 - fw * 1.05}" y="88" width="${fw * 2.1}" height="10" rx="5" fill="${shade(acC, -14)}"/>`
      : `<path d="M${160 - fw * 0.85} 90 Q 160 36 ${160 + fw * 0.85} 90 Z" fill="${acC}"/><path d="M${160 - 10} 90 L ${160 + fw * 1.3} 84 L ${160 + fw * 1.3} 94 Z" fill="${shade(acC, -14)}"/>`;
  } else if (ac.kind === "earring") {
    accSvg = [-1, 1].map(d => `<circle cx="${160 + d * (eX + 2)}" cy="${eY + eR[1] * eScale + 6}" r="4" fill="${acC}"/>`).join("");
  } else if (ac.kind === "blush") {
    accSvg = [-1, 1].map(d => `<ellipse cx="${160 + d * 42}" cy="205" rx="${8 + ac.v * 3}" ry="${4 + ac.v * 1.5}" fill="${hsl(5, 75, 72)}" opacity="${0.35 + ac.v * 0.15}"/>`).join("");
  } else if (ac.kind === "freckles") {
    accSvg = [-46, -38, -30, 30, 38, 46].map((dx, i) => `<circle cx="${160 + dx}" cy="${202 + (i % 2) * 5}" r="1.8" fill="${shade(skin, -22)}"/>`).join("");
  } else if (ac.kind === "hairpin") {
    accSvg = `<path d="M${160 - fw * 0.55} 112 L ${160 - fw * 0.3} 104 M${160 - fw * 0.52} 120 L ${160 - fw * 0.27} 112" stroke="${acC}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (ac.kind === "headband") {
    accSvg = `<path d="M${160 - fw * 0.95} 118 Q 160 76 ${160 + fw * 0.95} 118" stroke="${acC}" stroke-width="9" fill="none"/>`;
  } else if (ac.kind === "mask") {
    accSvg = `<path d="M${160 - w * 0.72} 195 Q 160 186 ${160 + w * 0.72} 195 Q ${160 + w * 0.6} 232 160 238 Q ${160 - w * 0.6} 232 ${160 - w * 0.72} 195 Z" fill="#fff" stroke="#d5d5d5" stroke-width="2"/><path d="M${160 - w * 0.72} 198 L ${160 - w} 185 M${160 + w * 0.72} 198 L ${160 + w} 185" stroke="#d5d5d5" stroke-width="2.4"/>`;
  } else if (ac.kind === "necklace") {
    accSvg = `<path d="M${160 - neckW} ${chinY + 24} Q 160 ${chinY + 44} ${160 + neckW} ${chinY + 24}" stroke="${acC}" stroke-width="3" fill="none"/><circle cx="160" cy="${chinY + 42}" r="5" fill="${acC}"/>`;
  } else if (ac.kind === "mole") {
    accSvg = ac.v === 1 ? `<circle cx="${160 + 26}" cy="228" r="2.2" fill="${shade(skin, -35)}"/>` : `<circle cx="${160 - 40}" cy="180" r="2.2" fill="${shade(skin, -35)}"/>`;
  } else if (ac.kind === "bandaid") {
    accSvg = `<g transform="rotate(-18 ${160 + 44} 206)"><rect x="${160 + 32}" y="200" width="26" height="11" rx="5" fill="${hsl(35, 45, 78)}"/><rect x="${160 + 40}" y="202" width="10" height="7" rx="2" fill="${hsl(35, 40, 86)}"/></g>`;
  } else if (ac.kind === "star") {
    accSvg = `<text x="${160 + 40}" y="164" font-size="16">✦</text>`;
  } else if (ac.kind === "tear") {
    accSvg = `<path d="M${160 + 44} 186 Q ${160 + 48} 194 ${160 + 44} 198 Q ${160 + 40} 194 ${160 + 44} 186 Z" fill="${hsl(200, 80, 70)}"/>`;
  } else if (ac.kind === "beard") {
    accSvg = `<path d="M${160 - jw * 0.9} ${chinY - 24} Q 160 ${chinY + 26} ${160 + jw * 0.9} ${chinY - 24} L ${160 + jw * 0.7} ${chinY - 30} Q 160 ${chinY + 8} ${160 - jw * 0.7} ${chinY - 30} Z" fill="${hair}"/>`;
  } else if (ac.kind === "mustache") {
    accSvg = `<path d="M160 208 Q ${160 - 14} 204 ${160 - 22} 210 Q ${160 - 12} 214 160 210 Q ${160 + 12} 214 ${160 + 22} 210 Q ${160 + 14} 204 160 208 Z" fill="${hair}"/>`;
  }

  return `
    ${backSvg}
    ${outfitSvg}
    ${earSvg}
    <path d="${facePath}" fill="${skin}" stroke="${line}" stroke-width="2"/>
    ${browSvg}
    ${eyeSvg}
    ${noseSvg}
    ${mouthSvg}
    ${accSvg && ac.kind !== "hat" && ac.kind !== "ribbon" && ac.kind !== "headband" ? accSvg : ""}
    ${frontSvg}
    ${(ac.kind === "hat" || ac.kind === "ribbon" || ac.kind === "headband") ? accSvg : ""}
  `;
}

// カテゴリごとのサムネイル用ズーム(viewBox)
const CATEGORY_ZOOM = {
  faceShape: "40 40 240 260",
  skin: null, hairColor: null, eyeColor: null,
  hair: "20 20 280 300",
  eyes: "90 130 140 70",
  brows: "100 125 120 45",
  nose: "125 175 70 45",
  mouth: "115 195 90 50",
  ears: "50 130 220 90",
  outfit: "60 240 200 120",
  accessory: "30 40 260 280",
};
