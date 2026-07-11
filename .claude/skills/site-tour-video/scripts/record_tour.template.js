// サイト紹介動画: Playwrightでサイトを自動操縦しながら無音動画を録画するテンプレート。
// このファイルは雛形。案件ごとにコピーして CONFIG を書き換えてから実行する。
// 出力は無音のwebm。BGMはこのスクリプトの後で generate_bgm.sh / mux_bgm.sh を使って重ねる。
//
// 前提:
//   npm i playwright-core   (スクラッチパス等、書き込み可能な場所で)
//   Chromiumの実体は環境ごとに変わるので固定パス決め打ちにせず動的に探す:
//     find /opt/pw-browsers -maxdepth 2 -type f -name chrome
//
// 使い方: node record_tour.template.js
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CONFIG = {
  // file:// URL、または http://localhost:xxxx など。対象サイトのエントリーポイント
  url: 'file:///ABSOLUTE/PATH/TO/index.html',
  viewport: { width: 1280, height: 720 },
  outDir: 'video', // recordVideo の出力先ディレクトリ

  // オープニングオーバーレイのHTML(インラインstyleで完結させる。CSSに依存しない)
  openingHtml: `
    <div style="font-family:'Noto Serif CJK JP',serif;font-size:3.2rem;letter-spacing:.2em;color:#e8e6e1">タイトル</div>
    <div style="font-family:'Noto Serif CJK JP',serif;font-size:1.15rem;letter-spacing:.25em;background:linear-gradient(120deg,#7fd4e4,#8e9bff,#c9a86a);-webkit-background-clip:text;background-clip:text;color:transparent">キャッチコピー</div>
  `,
  openingHoldMs: 2200,
  openingFadeMs: 1200,

  // ヒーローを見せる時間
  heroHoldMs: 2600,

  // 巡回するセクション: [セレクタ, 移動にかける時間ms, その場で止まる時間ms]
  // 情報量が多いセクション(タイムライン・統計カード等)は hold を長めに、
  // 単純なセクションは短めにしてテンポを作る。合計が目標尺(30秒前後)に収まるよう調整する
  tour: [
    ['#section-1', 1800, 1000],
    ['#section-2', 1500, 1800],
  ],

  // エンディングオーバーレイ
  endingHtml: `
    <div style="font-family:'Noto Serif CJK JP',serif;font-size:1.5rem;letter-spacing:.3em;color:#e8e6e1">結びの一文</div>
  `,
  endingHoldMs: 3000,
};

(async () => {
  const chromiumPath = execSync(
    "find /opt/pw-browsers -maxdepth 2 -type f -name chrome | head -1"
  ).toString().trim();

  const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: CONFIG.viewport,
    recordVideo: { dir: CONFIG.outDir, size: CONFIG.viewport },
  });
  const page = await context.newPage();
  await page.goto(CONFIG.url);

  await page.evaluate((cfg) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const ov = document.createElement('div');
    ov.id = 'movOverlay';
    ov.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'background:#0c0e12',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
      'gap:26px', 'opacity:1', 'transition:opacity 1.1s ease', 'text-align:center',
    ].join(';');
    ov.innerHTML = cfg.openingHtml;
    document.body.appendChild(ov);

    // easeInOutCubicで滑らかにスクロールするヘルパー。CSSのscroll-behaviorに頼らず
    // rAFで自前制御することで、録画中の速度・停止タイミングを正確にコントロールする
    window.__glide = (targetY, dur) => new Promise(res => {
      const from = scrollY, delta = targetY - from, t0 = performance.now();
      const ease = p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      (function step(t) {
        const p = Math.min((t - t0) / dur, 1);
        scrollTo(0, from + delta * ease(p));
        p < 1 ? requestAnimationFrame(step) : res();
      })(t0);
    });
    window.__glideTo = (sel, dur, offset = -60) => {
      const el = document.querySelector(sel);
      if (!el) return Promise.resolve();
      const y = el.getBoundingClientRect().top + scrollY + offset;
      return window.__glide(Math.max(0, y), dur);
    };
  }, CONFIG);

  await sleep(CONFIG.openingHoldMs);
  await page.evaluate(() => { document.getElementById('movOverlay').style.opacity = '0'; });
  await sleep(CONFIG.openingFadeMs);

  await sleep(CONFIG.heroHoldMs);

  for (const [sel, dur, hold] of CONFIG.tour) {
    await page.evaluate(([s, d]) => window.__glideTo(s, d), [sel, dur]);
    await sleep(hold);
  }

  await page.evaluate((cfg) => {
    const ov = document.getElementById('movOverlay');
    ov.innerHTML = cfg.endingHtml;
    ov.style.opacity = '1';
  }, CONFIG);
  await sleep(CONFIG.endingHoldMs);

  await context.close();
  console.log('VIDEO:' + await page.video().path());
  await browser.close();
})();
