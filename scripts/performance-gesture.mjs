/** Read-only mobile animation probe; aborts any unexpected review submission. */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const base = process.env.PERF_BASE_URL ?? 'http://localhost:3100';
  await page.goto(base + '/login');
  await page.getByRole('button', { name: '使用演示账号' }).click();
  await page.waitForURL('**/today');
  await page.goto(base + '/study');
  await page.getByRole('button', { name: /^(显示答案|直接看答案)$/ }).click();
  let accidentalRatings = 0;
  await page.route('**/study**', async route => {
    if (route.request().method() === 'POST') { accidentalRatings++; await route.abort(); }
    else await route.continue();
  });
  const box = await page.locator('div.cursor-pointer').boundingBox();
  await page.evaluate(() => {
    window.__gestureFrames = [];
    window.__recordFrames = true;
    let previous;
    const frame = t => {
      if (previous) window.__gestureFrames.push(t - previous);
      previous = t;
      if (window.__recordFrames) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (let round = 0; round < 4; round++) {
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 0; step < 24; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + Math.sin(step / 23 * Math.PI) * (round % 2 ? -60 : 60), y: start.y + 5 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.waitForTimeout(350);
  const frames = await page.evaluate(() => { window.__recordFrames = false; return window.__gestureFrames; });
  const sorted = [...frames].sort((a, b) => a - b);
  const result = { cpuSlowdown: 4, gestureCycles: 4, frameCount: frames.length, medianFrameMs: sorted[Math.floor(sorted.length / 2)], p95FrameMs: sorted[Math.floor(sorted.length * .95)], maxFrameMs: Math.max(...frames), framesOver34ms: frames.filter(t => t > 34).length, scrollY: await page.evaluate(() => scrollY), accidentalRatings };
  await writeFile('output/playwright/performance/gesture-probe.json', JSON.stringify(result, null, 2));
  assert.equal(result.scrollY, 0);
  assert.equal(accidentalRatings, 0);
  assert.ok(result.p95FrameMs < 34, 'gesture frame budget');
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
