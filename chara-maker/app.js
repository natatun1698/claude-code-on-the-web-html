/* そっくりメーカー UIロジック */
"use strict";

const CATEGORIES = [
  { key: "faceShape", label: "① 輪郭", items: FACE_SHAPES, hint: "あごの形×幅×長さ",
    sliders: [{ k: "faceW", label: "顔の幅 微調整", min: -12, max: 12 }] },
  { key: "skin", label: "② 肌の色", items: SKIN_COLORS, swatch: true,
    sliders: [{ k: "skinL", label: "色の濃さ 微調整", min: -12, max: 12, invert: true }] },
  { key: "hair", label: "③ 髪型", items: HAIR_STYLES, hint: "前髪×後ろ髪×ボリューム", sliders: [] },
  { key: "hairColor", label: "④ 髪色", items: HAIR_COLORS, swatch: true,
    sliders: [{ k: "hairL", label: "明るさ 微調整", min: -12, max: 12 }] },
  { key: "eyes", label: "⑤ 目", items: EYES, hint: "形×大きさ",
    sliders: [
      { k: "eyeGap", label: "目の間隔", min: -10, max: 10 },
      { k: "eyeY", label: "目の高さ", min: -12, max: 12 },
      { k: "eyeRot", label: "目の角度", min: -12, max: 12 },
    ] },
  { key: "eyeColor", label: "⑥ 瞳の色", items: EYE_COLORS, swatch: true, sliders: [] },
  { key: "brows", label: "⑦ 眉", items: BROWS, hint: "形×太さ",
    sliders: [{ k: "browY", label: "眉の高さ", min: -10, max: 10 }] },
  { key: "nose", label: "⑧ 鼻", items: NOSES, hint: "形×大きさ",
    sliders: [{ k: "noseY", label: "鼻の高さ", min: -10, max: 10 }] },
  { key: "mouth", label: "⑨ 口", items: MOUTHS, hint: "形×大きさ",
    sliders: [
      { k: "mouthY", label: "口の高さ", min: -10, max: 10 },
      { k: "mouthW", label: "口の幅", min: -25, max: 25 },
    ] },
  { key: "ears", label: "⑩ 耳", items: EARS, hint: "形×大きさ×張り出し",
    sliders: [{ k: "earSize", label: "大きさ 微調整", min: -20, max: 20 }] },
  { key: "outfit", label: "⑪ 服装", items: OUTFITS, hint: "種類×色", sliders: [] },
  { key: "accessory", label: "⑫ 小物", items: ACCESSORIES, hint: "メガネ・帽子・ほくろ等", sliders: [] },
];

const LS_KEY = "sokkuri-maker-collection-v1";
let state = defaultState();
let currentCat = 0;
let editingId = null;

const $ = id => document.getElementById(id);
const svgEl = $("avatar-svg");

// ---------- 描画 ----------
function refresh() {
  svgEl.innerHTML = renderAvatar(state);
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- カテゴリタブ ----------
function buildTabs() {
  const box = $("category-tabs");
  box.innerHTML = "";
  CATEGORIES.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "cat-tab" + (i === currentCat ? " active" : "");
    b.textContent = c.label;
    b.onclick = () => { currentCat = i; buildTabs(); buildGrid(); buildSliders(); };
    box.appendChild(b);
  });
}

// ---------- パーツグリッド ----------
function buildGrid() {
  const cat = CATEGORIES[currentCat];
  const grid = $("parts-grid");
  grid.innerHTML = "";
  $("parts-count").textContent = `全 ${cat.items.length} 種類`;
  $("parts-hint").textContent = cat.hint || "";

  cat.items.forEach((item, i) => {
    let el;
    if (cat.swatch) {
      el = document.createElement("button");
      el.className = "swatch" + (state.sel[cat.key] === i ? " selected" : "");
      el.style.background = hsl(item.h, item.s, item.l);
      el.title = `${cat.label} #${i + 1}`;
    } else {
      el = document.createElement("button");
      el.className = "part-thumb" + (state.sel[cat.key] === i ? " selected" : "");
      const tmp = JSON.parse(JSON.stringify(state));
      tmp.sel[cat.key] = i;
      const vb = CATEGORY_ZOOM[cat.key] || "0 0 320 360";
      el.innerHTML = `<svg viewBox="${vb}">${renderAvatar(tmp)}</svg><span class="num">${i + 1}</span>`;
    }
    el.onclick = () => {
      state.sel[cat.key] = i;
      refresh();
      buildGrid();
    };
    grid.appendChild(el);
  });
}

// ---------- 微調整スライダー ----------
function buildSliders() {
  const cat = CATEGORIES[currentCat];
  const box = $("fine-tune");
  if (!cat.sliders.length) { box.innerHTML = ""; return; }
  box.innerHTML = "<h4>🎚️ 微調整(パーツはそのまま、ここだけ変える)</h4>";
  cat.sliders.forEach(sl => {
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `<label>${sl.label}</label>
      <input type="range" min="${sl.min}" max="${sl.max}" value="${state.tune[sl.k] * (sl.invert ? -1 : 1)}" step="1">
      <output>${state.tune[sl.k]}</output>`;
    const input = row.querySelector("input"), out = row.querySelector("output");
    input.oninput = () => {
      state.tune[sl.k] = (+input.value) * (sl.invert ? -1 : 1);
      out.textContent = input.value;
      refresh();
    };
    box.appendChild(row);
  });
}

// ---------- コレクション ----------
function loadCollection() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function saveCollection(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
  $("collection-count").textContent = list.length;
}

function saveCurrent() {
  const list = loadCollection();
  const name = $("chara-name").value.trim() || `キャラ${list.length + 1}`;
  state.name = name;
  const data = JSON.parse(JSON.stringify(state));
  if (editingId) {
    const idx = list.findIndex(e => e.id === editingId);
    if (idx >= 0) { list[idx] = { ...list[idx], name, data, updated: Date.now() }; }
    else list.push({ id: editingId, name, data, updated: Date.now() });
  } else {
    editingId = "c" + Date.now();
    list.push({ id: editingId, name, data, updated: Date.now() });
  }
  saveCollection(list);
  toast(`💾 「${name}」を保存しました！`);
  renderCollection();
}

function renderCollection() {
  const list = loadCollection();
  const grid = $("collection-grid");
  grid.innerHTML = "";
  $("collection-empty").hidden = list.length > 0;
  $("collection-count").textContent = list.length;
  list.slice().reverse().forEach(entry => {
    const card = document.createElement("div");
    card.className = "collection-card";
    const d = new Date(entry.updated);
    card.innerHTML = `<svg viewBox="0 0 320 360">${renderAvatar(entry.data)}</svg>
      <div class="cname">${escapeHtml(entry.name)}</div>
      <div class="cdate">${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 更新</div>
      <div class="cactions">
        <button class="btn small" data-act="edit">✏️ 編集</button>
        <button class="btn small danger" data-act="del">🗑️</button>
      </div>`;
    card.querySelector('[data-act="edit"]').onclick = () => {
      state = JSON.parse(JSON.stringify(entry.data));
      editingId = entry.id;
      $("chara-name").value = entry.name;
      showView("editor");
      refresh(); buildGrid(); buildSliders();
      toast(`✏️ 「${entry.name}」を編集中`);
    };
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm(`「${entry.name}」を削除しますか？`)) return;
      saveCollection(loadCollection().filter(e => e.id !== entry.id));
      if (editingId === entry.id) editingId = null;
      renderCollection();
      toast("🗑️ 削除しました");
    };
    grid.appendChild(card);
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- ビュー切り替え ----------
function showView(v) {
  $("view-editor").hidden = v !== "editor";
  $("view-collection").hidden = v !== "collection";
  $("nav-editor").classList.toggle("active", v === "editor");
  $("nav-collection").classList.toggle("active", v === "collection");
  if (v === "collection") renderCollection();
}

// ---------- おまかせ生成 ----------
function randomize() {
  const r = n => Math.floor(Math.random() * n);
  Object.assign(state.sel, {
    faceShape: r(FACE_SHAPES.length), skin: r(28), hair: r(HAIR_STYLES.length),
    hairColor: r(HAIR_COLORS.length), eyes: r(EYES.length), eyeColor: r(EYE_COLORS.length),
    brows: r(BROWS.length), nose: r(NOSES.length), mouth: r(MOUTHS.length),
    ears: r(EARS.length), outfit: r(OUTFITS.length),
    accessory: Math.random() < 0.5 ? 0 : r(ACCESSORIES.length),
  });
  state.tune = defaultState().tune;
  refresh(); buildGrid(); buildSliders();
  toast("🎲 おまかせで生成しました！");
}

// ---------- PNG書き出し ----------
function exportPng() {
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="640" height="720"><rect width="320" height="360" fill="#fbf8f3"/>${renderAvatar(state)}</svg>`;
  const blob = new Blob([svgStr], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = 640; cv.height = 720;
    cv.getContext("2d").drawImage(img, 0, 0, 640, 720);
    URL.revokeObjectURL(url);
    const a = document.createElement("a");
    a.download = ($("chara-name").value.trim() || "chara") + ".png";
    a.href = cv.toDataURL("image/png");
    a.click();
    toast("🖼️ PNGを書き出しました！");
  };
  img.src = url;
}

// ---------- AIサジェスト(写真解析) ----------
function nearestColor(list, rgb) {
  let best = 0, bd = Infinity;
  list.forEach((c, i) => {
    const [r, g, b] = hslToRgb(c.h, c.s, c.l);
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function medianColor(px) {
  if (!px.length) return null;
  const ch = i => px.map(p => p[i]).sort((a, b) => a - b)[Math.floor(px.length / 2)];
  return [ch(0), ch(1), ch(2)];
}

function suggestFromPhoto(file) {
  const status = $("suggest-status");
  status.textContent = "🔍 解析中…";
  const img = new Image();
  img.onload = () => {
    const cv = $("photo-canvas");
    const W = 96, H = Math.round(96 * img.height / img.width);
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const at = (x, y) => {
      const i = (y * W + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    };
    // 肌: 中央〜やや下の領域から「肌色っぽい」画素の中央値
    const skinPx = [];
    for (let y = Math.round(H * 0.35); y < H * 0.75; y++)
      for (let x = Math.round(W * 0.3); x < W * 0.7; x++) {
        const [r, g, b] = at(x, y);
        if (r > 60 && r > g && g > b * 0.8 && r - b > 10 && r - b < 130) skinPx.push([r, g, b]);
      }
    // 髪: 上部領域の暗め画素の中央値
    const hairPx = [];
    for (let y = Math.round(H * 0.02); y < H * 0.3; y++)
      for (let x = Math.round(W * 0.25); x < W * 0.75; x++) {
        const p = at(x, y);
        if ((p[0] + p[1] + p[2]) / 3 < 150) hairPx.push(p);
      }
    const skinRgb = medianColor(skinPx), hairRgb = medianColor(hairPx);
    const found = [];
    if (skinRgb) { state.sel.skin = nearestColor(SKIN_COLORS, skinRgb); found.push("肌の色"); }
    if (hairRgb) { state.sel.hairColor = nearestColor(HAIR_COLORS, hairRgb); found.push("髪の色"); }
    if (hairRgb) {
      // 髪量ヒント: 上部の髪画素が多い→ボリュームあり/前髪あり寄りの髪型を提案
      const dense = hairPx.length > (W * H * 0.28 * 0.5) * 0.45;
      const bangs = dense ? 0 : 4;
      const backs = dense ? [1, 2, 3] : [0, 1];
      const back = backs[Math.floor(Math.random() * backs.length)];
      state.sel.hair = HAIR_STYLES.findIndex(h => h.bangs === bangs && h.back === back && h.vol === (dense ? 1 : 0));
      found.push("髪型の候補");
    }
    // 明るい写真→にっこり、暗い写真→ほほえみ の軽い演出
    state.sel.mouth = MOUTHS.findIndex(m => m.shape === 0 && m.size === 1.0);
    state.tune = defaultState().tune;
    refresh(); buildGrid(); buildSliders();
    status.textContent = found.length
      ? `✅ ${found.join("・")}を写真から推定しました。ここから微調整してください！`
      : "⚠️ うまく解析できませんでした。明るい正面写真でお試しください。";
    toast("🤖 AIサジェストを適用しました");
  };
  img.onerror = () => { status.textContent = "⚠️ 画像を読み込めませんでした。"; };
  img.src = URL.createObjectURL(file);
}

// ---------- JSON入出力 ----------
function exportJson() {
  const blob = new Blob([JSON.stringify(loadCollection(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.download = "sokkuri-collection.json";
  a.href = URL.createObjectURL(blob);
  a.click();
  toast("⬇️ コレクションを書き出しました");
}
function importJson(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const arr = JSON.parse(fr.result);
      if (!Array.isArray(arr)) throw 0;
      const cur = loadCollection();
      const ids = new Set(cur.map(e => e.id));
      arr.forEach(e => { if (e && e.id && e.data && !ids.has(e.id)) cur.push(e); });
      saveCollection(cur);
      renderCollection();
      toast(`⬆️ ${arr.length}体を読み込みました`);
    } catch { toast("⚠️ JSONの読み込みに失敗しました"); }
  };
  fr.readAsText(file);
}

// ---------- 初期化 ----------
$("nav-editor").onclick = () => showView("editor");
$("nav-collection").onclick = () => showView("collection");
$("btn-save").onclick = saveCurrent;
$("btn-random").onclick = randomize;
$("btn-png").onclick = exportPng;
$("btn-export-json").onclick = exportJson;
$("import-json").onchange = e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; };
$("photo-input").onchange = e => { if (e.target.files[0]) suggestFromPhoto(e.target.files[0]); e.target.value = ""; };
$("chara-name").oninput = () => { state.name = $("chara-name").value; };

refresh();
buildTabs();
buildGrid();
buildSliders();
$("collection-count").textContent = loadCollection().length;
