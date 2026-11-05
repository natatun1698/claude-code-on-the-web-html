const fs = require("fs"), path = require("path");
const WORDS = require("./forbidden-words.js");
module.exports = function (t) {
  const root = path.join(__dirname, "..");
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== "tests") walk(p); } else if (/\.(js|html|md|css)$/.test(f)) files.push(p); } })(root);
  files.push(path.join(root, "README.md"));
  for (const f of new Set(files)) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const w of WORDS) t.ok(!s.includes(w), `forbidden word "${w}" in ${path.relative(root, f)}`);
  }
  t.ok(!files.some(f => f.endsWith(".json")), "no .json data files in neko-sansu");
};
