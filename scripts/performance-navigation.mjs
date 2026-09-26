import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
const base = process.env.PERF_BASE_URL ?? 'http://localhost:3100';
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const requests = [];
page.on('requestfinished', req => {
  if (req.url().includes('_rsc')) requests.push({ path: new URL(req.url()).pathname, prefetch: req.headers()['next-router-prefetch'], timing: req.timing() });
});
await page.goto(base + '/login');
await page.getByRole('button', { name: '使用演示账号' }).click();
await page.waitForURL('**/today');
await page.locator('h1').waitFor();
await page.waitForTimeout(2500);
const samples = [];
for (let round = 0; round < 5; round++) {
  for (const [label, path] of [['卡片', '/decks'], ['社区', '/library'], ['我的', '/me'], ['今日', '/today']]) {
    await page.evaluate(() => { window.__clickAt = 0; document.addEventListener('click', () => { window.__clickAt = performance.now(); }, { once: true, capture: true }); });
    const start = performance.now();
    const before = requests.length;
    await page.locator('nav.app-tabbar').getByRole('link', { name: label, exact: true }).click();
    await page.waitForURL(base + path);
    await page.locator('h1').waitFor();
    const paintMs = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - window.__clickAt)))));
    samples.push({ round, path, automationMs: performance.now() - start, clickToPaintMs: paintMs, requests: requests.slice(before) });
  }
}
await mkdir('output/playwright/performance', { recursive: true });
await writeFile('output/playwright/performance/navigation-probe.json', JSON.stringify({ samples, errors, requests }, null, 2));
console.log(JSON.stringify({ samples, errors }));
await browser.close();
