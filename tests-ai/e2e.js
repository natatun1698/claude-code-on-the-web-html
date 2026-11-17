/* =========================================================
 * tests-ai/e2e.js — 生成AI版の画面通し確認(Playwright・ネットワーク不要)
 *   node tests-ai/e2e.js [スクリーンショットの保存先]
 * 音声認識なしの環境を模擬し、テキスト入力で1商談を通す。
 * ========================================================= */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) pass++; else { fail++; console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
};

async function openPlay(browser, base, query, modeIndex, themeIndex) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await page.goto(`${base}/bucho-ai/${query}`);
  const sceneCount = await page.locator("#scene-list .card").count();
  await page.locator("#scene-list .card").first().click();
  await page.locator("#mode-list .card").nth(modeIndex).click();
  await page.locator("#theme-list .card").nth(themeIndex).click();
  await page.click("#btn-start");
  await page.click("#btn-tts-toggle"); // 読み上げOFF(待ち時間を短くする)
  return { page, errors, sceneCount };
}

async function say(page, text) {
  const before = await page.locator("#chat-log .bubble.npc:not(.typing)").count();
  await page.fill("#text-input", text);
  await page.click("#btn-send");
  await page.waitForFunction((n) =>
    document.querySelectorAll("#chat-log .bubble.npc:not(.typing)").length > n, before, { timeout: 15000 });
  return page.locator("#chat-log .bubble.npc:not(.typing) .bubble-text").last().textContent();
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const shot = process.argv[2];

  console.log("A. 模擬LLMが成功する場合(やさしい部長・値引き切り返し)");
  {
    const { page, errors, sceneCount } = await openPlay(browser, base, "?mock=ok", 0, 1);
    check("公開シーンは価格提示の1つだけ", sceneCount === 1, String(sceneCount));
    check("状態表示はAI応答", (await page.textContent("#ai-status")).includes("AI応答"));
    await say(page, "結論から申しますと、本体で約1億円です。");
    const r2 = await say(page, "根拠は、少ないX線の量でも細い血管までくっきり見える点です。患者さんの被ばくが減ります。");
    check("発言内容(被ばく)に反応した文面になる", r2.includes("被ばくが減る"), r2);
    const r3 = await say(page, "FPDの性能も高いです。");
    check("専門用語を聞き返す", r3.includes("FPD"), r3);
    const r4 = await say(page, "FPDは、例えばカメラのフィルムのようなものです。");
    check("同じ用語は二度聞き返さない", !r4.includes("「FPD」"), r4);
    if (shot) await page.screenshot({ path: shot });
    await say(page, "申し訳ありませんが、お値引きはできません。その代わり、故障時はすぐ駆けつけますので治療を止めません。");
    const log = await page.evaluate(() => window.__aiLog);
    check("文面はすべて生成AI(模擬)由来", log.every((l) => l.source === "llm"), JSON.stringify(log));
    page.once("dialog", (d) => d.accept());
    await page.click("#btn-end");
    await page.waitForSelector("#screen-result.active");
    check("結果画面に点数が出る", /\d+点/.test(await page.textContent("#result-score")));
    check("改善点が出る", (await page.textContent("#result-improve-point")).length > 10);
    check("画面エラーなし", errors.length === 0, errors.join(" | "));
    await page.close();
  }

  console.log("B. 生成AIが時間切れになる場合(普通の部長)");
  {
    const { page, errors } = await openPlay(browser, base, "?mock=slow&timeoutMs=400", 1, 2);
    const r1 = await say(page, "本体で約1億円になります。");
    check("1回目: 定型セリフで返事が来る", r1.length > 5, r1);
    check("1回目: まだAI応答の表示", (await page.textContent("#ai-status")).includes("AI応答"));
    await say(page, "根拠は安全に治療できることです。");
    check("2回連続の失敗で定型モード表示", (await page.textContent("#ai-status")).includes("定型モード"));
    const t0 = Date.now();
    await say(page, "お値引きはできません。保守の速さが価値です。");
    check("定型モードでは待たされない", Date.now() - t0 < 1500, `${Date.now() - t0}ms`);
    const log = await page.evaluate(() => window.__aiLog);
    check("理由が記録される", log[0].reason === "timeout" && log[2].reason.startsWith("disabled"), JSON.stringify(log));
    check("画面エラーなし", errors.length === 0, errors.join(" | "));
    await page.close();
  }

  console.log("C. 役を放棄した文面が返る場合(怖い部長・3ストライク)");
  {
    const { page, errors } = await openPlay(browser, base, "?mock=inject", 2, 2);
    const long = "本日はお忙しいところお時間をいただきまして誠にありがとうございます。まず弊社の歴史からご説明させていただきますと、創業以来長きにわたり医療の現場に寄り添ってまいりまして、数多くの先生方からご支持をいただいております次第でございます。";
    const r0 = await say(page, "1億円です。");
    check("不正な文面は画面に出ない", !r0.includes("AIアシスタント"), r0);
    await say(page, long);
    await say(page, long);
    await say(page, long);
    await page.waitForSelector("#screen-result.active", { timeout: 15000 });
    check("3ストライクで打ち切られる", await page.isVisible("#result-walkout"));
    check("画面エラーなし", errors.length === 0, errors.join(" | "));
    await page.close();
  }

  console.log("D. 通常版(/bucho/)が変わっていないこと");
  {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/bucho/`);
    check("通常版は5シーンのまま", (await page.locator("#scene-list .card").count()) === 5);
    check("通常版に画面エラーなし", errors.length === 0, errors.join(" | "));
    await page.close();
  }

  await browser.close();
  server.close();
  console.log(`\n結果: ${pass} 件合格 / ${fail} 件不合格`);
  process.exit(fail ? 1 : 0);
})();
