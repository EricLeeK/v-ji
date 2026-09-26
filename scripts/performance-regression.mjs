import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createPerformanceFixture } from './performance-fixture.mjs';
const base = process.env.PERF_BASE_URL ?? 'http://localhost:3100';
const out = 'output/playwright/performance/regression';
await mkdir(out, { recursive: true });
const fixture = await createPerformanceFixture();
const browser = await chromium.launch({ channel: 'chrome' });
const result = { checks: [], pageErrors: [], network: [], metrics: {} };
const check = (name, condition) => { assert.ok(condition, name); result.checks.push(name); console.log('PASS', name); };
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  await context.addCookies(fixture.cookies(base));
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => result.pageErrors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto(`${base}/decks/${fixture.deckId}`);
  const links = page.locator(`a[href^="/decks/${fixture.deckId}/cards/"]`).filter({ hasNotText: '添加卡片' });
  const search = page.getByPlaceholder('搜索卡片', { exact: true });
  await search.waitFor();
  check('800-note list mounts at most 120 rows initially', await links.count() <= 120);
  await search.fill('0000');
  await page.waitForFunction(() => document.querySelectorAll('ul.mt-3 li').length === 1);
  check('search finds a note outside the initial render batch', (await links.first().textContent()).includes('0000'));
  await search.fill('');
  await page.waitForFunction(() => document.querySelectorAll('ul.mt-3 li').length >= 60);
  for (let i = 0; i < 20 && await links.count() < 800; i++) {
    const before = await links.count();
    await page.getByRole('button', { name: /加载更多/ }).scrollIntoViewIfNeeded();
    await page.waitForFunction(n => document.querySelectorAll('ul.mt-3 li').length > n, before);
  }
  check('all 800 notes remain reachable by scrolling', await links.count() === 800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  check('starred filter remains functional', await page.getByRole('button', { name: '收藏', exact: true }).getAttribute('aria-pressed') === 'true');
  await search.fill('0000');
  await links.first().click({ button: 'right' });
  await page.getByRole('heading', { name: '卡片操作' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: '卡片操作' }).waitFor({ state: 'hidden' });
  check('note action sheet still opens and closes', !(await page.getByRole('heading', { name: '卡片操作' }).isVisible()));

  await page.goto(base + '/decks');
  await page.getByPlaceholder('搜索卡片盒').waitFor();
  check('main tabs are visible without scrolling a long page', await page.locator('nav.app-tabbar').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await page.waitForTimeout(1000);
  let filterRequests = 0;
  const onRequest = r => { if (new URL(r.url()).pathname === '/decks' && (r.url().includes('_rsc') || r.isNavigationRequest())) filterRequests++; };
  page.on('request', onRequest);
  await page.evaluate(() => { window.__connectionProbe = 'preserved'; });
  await context.setOffline(true);
  const filterStart = performance.now();
  await page.getByRole('navigation', { name: '卡片盒筛选' }).getByRole('link', { name: '未学习', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="卡片盒筛选"] [aria-current]')?.textContent.trim() === '未学习');
  result.metrics.offlineDeckFilterMs = performance.now() - filterStart;
  await page.getByPlaceholder('搜索卡片盒').fill('性能基准');
  await page.getByPlaceholder('搜索卡片盒').press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label^="更多操作："]').length === 1);
  check('deck search and filters work offline without a server request', filterRequests === 0);
  check('search query is shareable in URL', new URL(page.url()).searchParams.get('q') === '性能基准');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('[aria-label="卡片盒筛选"] [aria-current]')?.textContent.trim() === '全部');
  check('browser back restores previous filter', new URL(page.url()).searchParams.get('status') === null);
  await context.setOffline(false);
  await page.waitForTimeout(350);
  check('reconnecting preserves current UI without reloading the document', await page.evaluate(() => window.__connectionProbe === 'preserved'));
  page.off('request', onRequest);
  await page.goto(base + '/decks?q=' + encodeURIComponent('性能基准') + '&status=new');
  await page.getByPlaceholder('搜索卡片盒').waitFor();
  check('direct filtered URL hydrates with the correct query', await page.getByPlaceholder('搜索卡片盒').inputValue() === '性能基准');

  const prefetchedStudy = page.waitForResponse(response => {
    const request = response.request();
    const url = new URL(request.url());
    return url.pathname === '/study' && url.searchParams.get('deckId') === fixture.deckId && url.searchParams.has('_rsc') && !request.headers()['next-router-segment-prefetch'];
  }).then(response => { if (!response.ok()) throw new Error("Study prefetch failed"); });
  await page.goto(`${base}/decks/${fixture.deckId}`);
  await prefetchedStudy;
  check('primary study link prefetches the full dynamic route', true);
  const studyStart = performance.now();
  await page.getByRole('link', { name: '学习', exact: true }).click();
  const answer = page.getByRole('button', { name: '显示答案', exact: true });
  await answer.waitFor();
  result.metrics.prefetchedStudyNavigationMs = performance.now() - studyStart;
  const initialCard = await page.locator('div.cursor-pointer').innerText();
  let attempts = 0;
  let firstBody;
  await page.route('**/study?**', async route => {
    if (route.request().method() === 'POST') {
      attempts++;
      firstBody = route.request().postDataJSON();
      await new Promise(r => setTimeout(r, 2500));
      await route.abort('failed');
    } else await route.continue();
  });
  const ratings = [];
  for (let i = 0; i < 3; i++) {
    await answer.click();
    const start = performance.now();
    await page.getByRole('button', { name: /^记得/ }).click();
    await page.waitForFunction(() => { const b = document.querySelector('button[aria-label="显示答案"]'); return b && !b.disabled; });
    ratings.push(performance.now() - start);
  }
  result.metrics.ratingReadyMs = ratings;
  check('three consecutive ratings remain responsive while save is pending', Math.max(...ratings) < 200);
  check('only one persistence request is in flight', attempts === 1);
  check('review requests exclude note text and rollback snapshots', !JSON.stringify(firstBody).includes('checkpoint') && !JSON.stringify(firstBody).includes('previous') && JSON.stringify(firstBody).length < 1000);
  await page.getByRole('button', { name: '结束学习', exact: true }).click();
  await page.getByRole('button', { name: '结束', exact: true }).click();
  check('leaving waits for outstanding writes', page.url().includes('/study'));
  await page.waitForFunction(() => document.body.textContent.includes('进度 0 / 80'));
  check('failed write restores all three optimistic ratings', (await page.locator('div.cursor-pointer').innerText()) === initialCard);
  check('dependent writes are discarded on failure', attempts === 1);
  const { data: persisted, error } = await fixture.db.from('cards').select('reps').eq('deck_id', fixture.deckId);
  check('failure test did not persist synthetic reviews', !error && persisted.every(c => c.reps === 0));
  await page.unroute('**/study?**');

  // Real CDP touch: leave the viewport fixed and return an incomplete drag to zero.
  await answer.click();
  const card = page.locator('div.cursor-pointer');
  const box = await card.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2 + 35, y: box.y + box.height / 2 + 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(450);
  check('mobile swipe keeps the document fixed', await page.evaluate(() => window.scrollY === 0 && getComputedStyle(document.body).position === 'fixed'));
  await page.locator('[data-sonner-toast]').waitFor({ state: 'hidden' });
  await page.screenshot({ path: out + '/mobile-study.png' });
  await page.getByRole('button', { name: '结束学习', exact: true }).click();
  await page.getByRole('button', { name: '结束', exact: true }).click();
  await page.waitForURL('**/today');
  check('user can leave after a rolled-back failure', await page.locator('body').evaluate(el => getComputedStyle(el).position) === 'static');

  // Cold slow-network navigation: CPU 4x, 150ms latency, 1.6 Mbps download.
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
  await page.addInitScript(() => {
    window.__slowPerf = { lcp: 0, cls: 0, events: [], longTasks: [] };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__slowPerf.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__slowPerf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.interactionId) window.__slowPerf.events.push(e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__slowPerf.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  });
  for (const path of ['/me/settings', '/today', `/decks/${fixture.deckId}/cards/new`, '/me/stats', '/ai/new']) {
    await page.goto(base + path);
    await page.locator('h1').waitFor();
    await page.waitForTimeout(500);
    result.network.push({ path: path.replace(fixture.deckId, ':deckId'), ...await page.evaluate(() => ({ ...window.__slowPerf, resources: performance.getEntriesByType('resource').map(e => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize, transfer: e.transferSize })), navigation: performance.getEntriesByType('navigation')[0].toJSON() })) });
    if (path.endsWith('/cards/new')) {
      const initialJs = result.network.at(-1).resources.filter(r => r.path.endsWith('.js')).reduce((sum, r) => sum + r.bytes, 0);
      check('QA editor initial JS stays below 300 KiB', initialJs < 300 * 1024);
      await page.locator('textarea').first().fill('测试即时输入');
      await page.getByRole('button', { name: /挖空/ }).click();
      await page.locator('.tiptap').waitFor();
      await page.locator('.tiptap').fill('测试挖空编辑器');
      check('card editor supports QA and cloze after navigation', (await page.locator('.tiptap').innerText()).includes('测试挖空'));
    }
  }
  check('system fonts remove all web font downloads', result.network.every(p => !p.resources.some(r => r.path.endsWith('.woff2'))));
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  for (const path of ['/today', '/decks', '/library', '/me/stats']) {
    await page.goto(base + path);
    await page.locator('h1').waitFor();
    await page.screenshot({ path: `${out}/mobile-${path.replaceAll('/', '-')}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/decks');
  await page.locator('h1').waitFor();
  await page.screenshot({ path: out + '/desktop-decks.png' });
  check('normal service-worker-enabled browser has no uncaught errors', result.pageErrors.length === 0);
} finally {
  await browser.close();
  result.cleanup = await fixture.cleanup();
  await writeFile(out + '/results.json', JSON.stringify(result, null, 2));
}
