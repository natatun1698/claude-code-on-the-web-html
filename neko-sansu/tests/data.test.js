/* 問題データの検査: スキーマ・ID重複・tags一覧・ready の必須項目・excluded の reason・図の存在と XML・禁止語 */
const fs = require("fs"), path = require("path");
const { validateAll, ready, TAGS, textToHtml } = require("../problems.js");
const DATA = path.join(__dirname, "..", "data");
const ROOT = path.join(__dirname, "..");
// 学校名・出版社名・塾名などが入っていないか。データとコードには広めの語も禁止(「中学」「出版」「書店」)
const FORBID_ALL = /学院|学園|中学校|女子中|四谷大塚|日能研|SAPIX|サピックス|早稲アカ|入試問題|入学試験|声の教育社|東京学参|みくに出版|偏差値/;
const FORBID_DATA = /中学|出版|書店/;
function walk(dir, out = []) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; }
/** 簡易 XML 検査: タグの開閉が対応していること(外部ライブラリなし) */
function wellFormed(xml) {
  const s = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "");
  const stack = []; const re = /<(\/?)([A-Za-z_][\w:.-]*)([^<>]*?)(\/?)>/g; let m, last = 0;
  while ((m = re.exec(s))) { const between = s.slice(last, m.index); if (/<|>/.test(between)) return false; last = re.lastIndex; if (m[4]) continue; if (m[1]) { if (stack.pop() !== m[2]) return false; } else stack.push(m[2]); }
  return stack.length === 0 && !/[<>]/.test(s.slice(last));
}
module.exports = function (t) {
  const idx = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
  t.ok(Array.isArray(idx.files) && idx.files.length > 0, "index.json has files");
  const all = [];
  for (const f of idx.files) {
    t.ok(/^problems-\d{4}-\d+\.json$/.test(f), `file name ${f} is problems-{年度}-{回}.json`);
    let arr; try { arr = JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")); } catch (e) { t.ok(false, `${f}: JSON parse error ${e.message}`); continue; }
    t.ok(Array.isArray(arr), `${f} is an array`); if (Array.isArray(arr)) all.push(...arr);
  }
  // index.json に載っていない problems-*.json が無いこと
  for (const f of fs.readdirSync(DATA).filter(f => /^problems-.*\.json$/.test(f))) t.ok(idx.files.includes(f), `${f} is listed in index.json`);
  const v = validateAll(all, { figureExists: p => fs.existsSync(path.join(DATA, p)) });
  for (const e of v.errors) t.ok(false, `${e.id}: ${e.msg}`);
  t.ok(v.ok, "all problems pass schema validation");
  t.ok(ready(all).length >= 1, "at least one ready problem");
  for (const p of ready(all)) {
    for (const k of ["essence", "hint1", "hint2", "exp"]) t.ok(typeof p[k] === "string" && p[k].length >= 8, `${p.id}: ${k} is written`);
    t.ok(!/にゃ/.test(p.essence + p.hint1 + p.hint2 + p.exp), `${p.id}: data text has no cat speech (app adds it)`);
    t.ok(!/\{\{[^}]*\}\}/.test(textToHtml(p.text)), `${p.id}: all {{a/b}} fractions render`);
  }
  for (const p of all.filter(p => p.status === "excluded")) t.ok(typeof p.reason === "string" && p.reason.length >= 5, `${p.id}: excluded has reason`);
  // 図: ready の問題が参照する SVG が存在し、正しい XML で、危険な要素を含まない。参照されない SVG が無いこと
  const used = new Set(all.filter(p => p.figure).map(p => p.figure));
  const figDir = path.join(DATA, "figures");
  for (const f of fs.existsSync(figDir) ? fs.readdirSync(figDir) : []) {
    const rel = "figures/" + f; const xml = fs.readFileSync(path.join(figDir, f), "utf8");
    t.ok(f.endsWith(".svg"), `${rel}: only .svg in figures/`);
    t.ok(used.has(rel), `${rel}: referenced by some problem`);
    t.ok(/<svg[^>]*\sviewBox=/.test(xml) && /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(xml), `${rel}: has viewBox and xmlns`);
    t.ok(wellFormed(xml), `${rel}: well-formed XML`);
    t.ok(!/<script|<img|<foreignObject|\son\w+=|https?:\/\/(?!www\.w3\.org)/i.test(xml), `${rel}: no script/img/external refs`);
  }
  // 禁止語: アプリ配下すべて + スキル
  const files = walk(ROOT).filter(f => !/node_modules/.test(f) && f !== __filename).concat(walk(path.join(ROOT, "..", ".claude", "skills", "neko-sansu")));
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8"); const rel = path.relative(path.join(ROOT, ".."), f);
    const m = text.match(FORBID_ALL); t.ok(!m, `${rel}: contains forbidden word "${m && m[0]}"`);
    if (f.startsWith(DATA) || /\.(js|html|css)$/.test(f)) { const m2 = text.match(FORBID_DATA); t.ok(!m2, `${rel}: contains forbidden word "${m2 && m2[0]}"`); }
  }
  // 検証関数そのもののテスト(壊れたデータを拾えること)
  const bad = [{ id: "2024-1-1-1", source: { year: 2024, round: 1, big: 1, no: 2 }, tags: ["計算/ないタグ"], pattern: "x", text: "TODO", answerType: "int", answer: 26, status: "ready", essence: "a", hint1: "b", hint2: "c", exp: "d" }, { id: "2024-1-1-1", status: "excluded", source: { year: 2024, round: 1, big: 1, no: 1 }, tags: ["場合の数"], pattern: "x", text: "t", answerType: "int", answer: "1" }];
  const msgs = validateAll(bad).errors.map(e => e.msg).join("|");
  for (const k of ["source が id と一致しません", "一覧にない分野", "TODO", "整数の文字列", "id が重複", "reason が必要"]) t.ok(msgs.includes(k), `validator catches: ${k}`);
  t.ok(TAGS.length === 31, "31 tags defined");
};
