// X(Twitter)の「フォロー中」タイムラインから直近の投稿を収集するスクリプト。
// 自分のアカウントでログインしたブラウザプロファイルを使い、個人利用の範囲で
// 1日1回程度の実行を想定している。
//
// 使い方:
//   node fetch_timeline.mjs login   … 初回のみ。ブラウザが開くので手動でXにログインする
//   node fetch_timeline.mjs fetch   … 過去 DIGEST_HOURS 時間(既定24h)の投稿をJSONで保存
//
// 環境変数:
//   DIGEST_HOURS  収集対象の時間幅(時間)。既定 24
//   OUT_DIR       出力先ディレクトリ。既定 ./x-digest
//   HEADFUL=1     fetch時もブラウザを表示する(デバッグ用)
//
// 終了コード: 0=成功 / 2=未ログイン(標準エラーに NOT_LOGGED_IN を出力) / 1=その他エラー

import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROFILE_DIR = path.join(os.homedir(), '.x-digest-profile');
const OUT_DIR = process.env.OUT_DIR || path.join(process.cwd(), 'x-digest');
const HOURS = Number(process.env.DIGEST_HOURS || 24);
const MAX_SCROLLS = 120;
const mode = process.argv[2] || 'fetch';

const cutoff = Date.now() - HOURS * 60 * 60 * 1000;

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: mode === 'fetch' && process.env.HEADFUL !== '1',
  viewport: { width: 1280, height: 1600 },
  locale: 'ja-JP',
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
});
const page = context.pages()[0] ?? (await context.newPage());

if (mode === 'login') {
  await page.goto('https://x.com/login');
  console.log('開いたブラウザでXにログインしてください。ホーム画面が表示されたら自動で終了します。');
  await page.waitForURL('**/home', { timeout: 0 });
  console.log('ログインを確認しました。セッションを保存しました。');
  await context.close();
  process.exit(0);
}

await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

if (/\/(login|i\/flow\/login)/.test(page.url())) {
  console.error('NOT_LOGGED_IN');
  await context.close();
  process.exit(2);
}

// アルゴリズム順の「おすすめ」ではなく時系列の「フォロー中」タブに切り替える
try {
  const followingTab = page.getByRole('tab', { name: /^(フォロー中|Following)$/ });
  await followingTab.click({ timeout: 10000 });
  await page.waitForTimeout(3000);
} catch {
  console.error('警告: 「フォロー中」タブが見つかりませんでした。表示中のタイムラインをそのまま収集します。');
}

const seen = new Map();
let staleRounds = 0;

for (let i = 0; i < MAX_SCROLLS; i++) {
  const batch = await page.evaluate(() => {
    const items = [];
    for (const article of document.querySelectorAll('article[data-testid="tweet"]')) {
      const timeEl = article.querySelector('time[datetime]');
      if (!timeEl) continue; // プロモーション(広告)には日時が無いので除外
      const link = timeEl.closest('a')?.getAttribute('href') || '';
      const m = link.match(/^\/([^/]+)\/status\/(\d+)/);
      if (!m) continue;
      const social = article.querySelector('[data-testid="socialContext"]')?.innerText || '';
      items.push({
        id: m[2],
        url: 'https://x.com' + link,
        handle: '@' + m[1],
        name:
          article.querySelector('[data-testid="User-Name"]')?.innerText.split('\n')[0] || '',
        datetime: timeEl.getAttribute('datetime'),
        text: article.querySelector('[data-testid="tweetText"]')?.innerText || '',
        isRepost: /リポスト|reposted/i.test(social),
        repostedBy: social || null,
        hasMedia: !!article.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]'),
        quoted:
          article.querySelectorAll('[data-testid="tweetText"]')[1]?.innerText || null,
      });
    }
    return items;
  });

  let newCount = 0;
  let oldestInBatch = Infinity;
  for (const t of batch) {
    const ts = Date.parse(t.datetime);
    oldestInBatch = Math.min(oldestInBatch, ts);
    if (!seen.has(t.id)) {
      seen.set(t.id, { ...t, timestamp: ts });
      newCount++;
    }
  }

  // 「フォロー中」タブはほぼ時系列なので、cutoffより古い投稿しか出てこなくなったら終了
  if (newCount === 0 || (oldestInBatch !== Infinity && oldestInBatch < cutoff)) {
    staleRounds++;
    if (staleRounds >= 3) break;
  } else {
    staleRounds = 0;
  }

  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1500);
}

await context.close();

const tweets = [...seen.values()]
  .filter((t) => t.timestamp >= cutoff)
  .sort((a, b) => b.timestamp - a.timestamp);

fs.mkdirSync(OUT_DIR, { recursive: true });
const dateTag = new Date().toISOString().slice(0, 10);
const outFile = path.join(OUT_DIR, `raw-${dateTag}.json`);
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      hours: HOURS,
      cutoff: new Date(cutoff).toISOString(),
      count: tweets.length,
      tweets,
    },
    null,
    2,
  ),
);
console.log(`収集完了: ${tweets.length}件 -> ${outFile}`);
