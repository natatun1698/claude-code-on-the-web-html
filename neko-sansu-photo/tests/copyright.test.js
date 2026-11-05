/* 著作権チェック: 禁止語が無いこと、写真・JSON などのデータファイルがリポジトリに入っていないこと */
const fs = require("fs"), path = require("path");
const WORDS = require("../../neko-sansu/tests/forbidden-words.js");
module.exports = function (t) {
  const root = path.join(__dirname, "..");
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "tests") walk(p); } else files.push(p); } })(root);
  for (const f of files) {
    const rel = path.relative(root, f);
    t.ok(!/\.(jpe?g|png|heic|heif|webp|gif|json)$/i.test(f), `no photo/data file in repo: ${rel}`);
    if (!/\.(js|html|md|css)$/.test(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const w of WORDS) t.ok(!s.includes(w), `forbidden word "${w}" in ${rel}`);
  }
};
