#!/usr/bin/env node
/* 全テスト。 node neko-sansu/tests/run.js */
const files = ["judge", "history", "importer", "templates", "copyright"];
let pass = 0, fail = 0; const fails = [];
const t = {
  ok(c, msg) { if (c) pass++; else { fail++; if (fails.length < 30) fails.push(msg); } },
  eq(a, b, msg) { t.ok(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); },
  throws(fn, msg) { let threw = false; try { fn(); } catch (e) { threw = true; } t.ok(threw, msg); },
};
for (const f of files) {
  const before = fail;
  try { require(`./${f}.test.js`)(t); } catch (e) { fail++; fails.push(`${f}: crashed: ${e.stack}`); }
  console.log(`${fail === before ? "PASS" : "FAIL"}  ${f}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("\n" + fails.join("\n")); process.exit(1); }
