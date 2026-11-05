#!/usr/bin/env node
/* 写真版の全テスト。 node neko-sansu-photo/tests/run.js  (共用ロジックのテストは neko-sansu/tests/run.js) */
const files = ["photo-bank", "copyright"];
let pass = 0, fail = 0; const fails = [];
const t = {
  ok(c, msg) { if (c) pass++; else { fail++; if (fails.length < 30) fails.push(msg); } },
  eq(a, b, msg) { t.ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); },
};
for (const f of files) {
  const before = fail;
  try { require(`./${f}.test.js`)(t); } catch (e) { fail++; fails.push(`${f}: crashed: ${e.stack}`); }
  console.log(`${fail === before ? "PASS" : "FAIL"}  ${f}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\n" + fails.join("\n")); process.exit(1); }
