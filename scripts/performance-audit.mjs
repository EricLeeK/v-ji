/** Production browser benchmark: disposable demo deck, delayed/aborted review requests, verified cleanup. */
import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
loadEnvConfig(process.cwd());
const baseURL = process.env.PERF_BASE_URL ?? 'http://localhost:3100';
const label = process.env.PERF_LABEL ?? 'baseline';
const out = `output/playwright/performance/${label}`;
await mkdir(out, { recursive: true });
const cookieJar = new Map();
const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: { getAll: () => [...cookieJar.values()], setAll: entries => entries.forEach(x => cookieJar.set(x.name, x)) },
});
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
const auth = checked(await db.auth.signInWithPassword({ email: process.env.PERF_EMAIL ?? 'demo@huaji.local', password: process.env.PERF_PASSWORD ?? 'huaji123456' }));
const uid = auth.user.id;
const deckId = randomUUID();
const count = 800;
const results = { label, baseURL, at: new Date().toISOString(), fixture: { notes: count, account: 'demo account; isolated disposable fixture deck; review writes aborted' }, runs: [], assertions: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  checked(await db.from('decks').insert({ id: deckId, owner_id: uid, name: '性能基准卡片盒', icon: 'book' }));
  const notes = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), deck_id: deckId, owner_id: uid, type: 'qa', fields: { question: `性能卡 ${String(i).padStart(4, '0')}：清晰、快速地学习知识`, answer: `答案 ${i}` }, created_at: new Date(Date.now() - count * 1000 + i * 1000).toISOString() }));
  checked(await db.from('notes').insert(notes));
  checked(await db.from('cards').insert(notes.map((n, i) => ({ note_id: n.id, deck_id: deckId, owner_id: uid, ord: 0, starred: i % 5 === 0 }))));
  for (const mode of ['desktop', 'mobile-4x']) {
    const context = await browser.newContext({ viewport: mode === 'desktop' ? { width: 1440, height: 1000 } : { width: 393, height: 851 }, isMobile: mode !== 'desktop', hasTouch: mode !== 'desktop', deviceScaleFactor: 1, locale: 'zh-CN', serviceWorkers: 'block' });
    await context.addCookies([...cookieJar.values()].filter(x => x.value).map(x => ({ name: x.name, value: x.value, url: baseURL, sameSite: 'Lax' })));
    await context.addInitScript(() => {
      window.__perf = { events: [], longTasks: [], lcp: 0, cls: 0 };
      for (const type of ['event', 'longtask', 'largest-contentful-paint', 'layout-shift']) {
        new PerformanceObserver(list => { for (const e of list.getEntries()) {
          if (type === 'event' && e.interactionId) window.__perf.events.push({ name: e.name, duration: e.duration });
          if (type === 'longtask') window.__perf.longTasks.push(e.duration);
          if (type === 'largest-contentful-paint') window.__perf.lcp = e.startTime;
          if (type === 'layout-shift' && !e.hadRecentInput) window.__perf.cls += e.value;
        }}).observe({ type, buffered: true, durationThreshold: 16 });
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: mode === 'desktop' ? 1 : 4 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sample = { mode, pages: [], interactions: {}, errors };
    for (const path of ['/today', '/decks', '/library', '/me', `/decks/${deckId}`, '/me/stats']) {
      const start = performance.now();
      await page.goto(baseURL + path);
      await page.locator('h1').first().waitFor();
      if (path === `/decks/${deckId}`) await page.getByPlaceholder('搜索卡片').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const metrics = await page.evaluate(() => ({ ...window.__perf, resources: performance.getEntriesByType('resource').map(e => ({ path: new URL(e.name).pathname, bytes: e.encodedBodySize, duration: e.duration, type: e.initiatorType })), navigation: performance.getEntriesByType('navigation')[0].toJSON(), domNodes: document.getElementsByTagName('*').length }));
      sample.pages.push({ path: path.replace(deckId, ':deckId'), readyMs: performance.now() - start, ...metrics });
      if (path === `/decks/${deckId}`) {
        const search = page.getByPlaceholder('搜索卡片');
        const timings = [];
        for (const value of ['0799', '', '079', '', '性能']) {
          const start = performance.now();
          await search.fill(value);
          await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
          timings.push(performance.now() - start);
        }
        sample.interactions.noteSearchMs = timings;
        sample.interactions.noteSearchEvents = await page.evaluate(() => window.__perf.events);
        sample.interactions.noteListNodes = await page.locator('li').count();
      }
    }
    // Cached tab navigation, including meaningful content (not only URL change).
    await page.goto(baseURL + '/today');
    await page.locator('h1').waitFor();
    await page.waitForTimeout(2000);
    sample.interactions.tabs = [];
    for (const [name, heading] of [['卡片', '卡片盒'], ['社区', '社区'], ['我的', ''], ['今日', '']]) {
      const start = performance.now();
      await page.locator('nav.app-tabbar').getByRole('link', { name, exact: true }).click();
      await page.locator('h1').filter({ hasText: heading }).waitFor();
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      sample.interactions.tabs.push({ name, ms: performance.now() - start });
    }
    await page.goto(baseURL + '/decks');
    await page.getByPlaceholder('搜索卡片盒').waitFor();
    const filterStart = performance.now();
    await page.getByRole('navigation', { name: '卡片盒筛选' }).getByRole('link', { name: '收藏夹' }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="卡片盒筛选"] [aria-current="page"]')?.textContent.trim() === '收藏夹');
    sample.interactions.deckFilterMs = performance.now() - filterStart;
    await page.goto(`${baseURL}/study?deckId=${deckId}`);
    const answer = page.getByRole('button', { name: '显示答案', exact: true });
    await answer.waitFor();
    let saveRequests = 0;
    await page.route('**/study?**', async route => {
      if (route.request().method() === 'POST') { saveRequests++; await new Promise(r => setTimeout(r, 1500)); await route.abort('failed'); return; }
      await route.continue();
    });
    await answer.click();
    const rateStart = performance.now();
    await page.getByRole('button', { name: '记得', exact: false }).click();
    await answer.waitFor();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="显示答案"]')?.disabled);
    sample.interactions.nextCardReadyWith1500msSaveDelay = performance.now() - rateStart;
    sample.interactions.saveRequests = saveRequests;
    results.assertions.push({ mode, name: 'next card usable within 200ms despite slow save', pass: sample.interactions.nextCardReadyWith1500msSaveDelay < 200 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${out}/${mode}-study.png` });
    await context.close();
    results.runs.push(sample);
    await writeFile(`${out}/metrics.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ mode, interactions: sample.interactions, errors }));
  }
} finally {
  await browser.close();
  const deletion = await db.from('decks').delete().eq('id', deckId).eq('owner_id', uid);
  results.cleanup = !deletion.error && (await db.from('decks').select('id').eq('id', deckId)).data?.length === 0;
  await writeFile(`${out}/metrics.json`, JSON.stringify(results, null, 2));
}
