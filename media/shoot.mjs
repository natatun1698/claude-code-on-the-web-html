// umetsu.html の各セクションを撮影して media/shots/ に保存する
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "media", "shots");
fs.mkdirSync(outDir, { recursive: true });

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
  proxy: proxy ? { server: proxy } : undefined,
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1.5,
  ignoreHTTPSErrors: true,
});

await page.goto("file://" + path.join(root, "umetsu.html"), { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const ids = ["top", "work", "hobby", "life", "people", "roots", "money", "health", "travel", "contact"];
let i = 0;
for (const id of ids) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "instant", block: "start" }), id);
  await page.waitForTimeout(2200); // reveal / count-up アニメーション待ち
  await page.screenshot({ path: path.join(outDir, `s${String(i++).padStart(2, "0")}.png`) });
}
// タイムライン部分（workセクション後半）を追加で1枚
await page.evaluate(() => window.scrollTo(0, document.getElementById("work").offsetTop + 500));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, "s01b.png") });

await browser.close();
console.log("shots saved to", outDir);
