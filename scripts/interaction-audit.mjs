import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createPerformanceFixture } from './performance-fixture.mjs';

// Mutate only these disposable owner-scoped fixtures. Profile, key, feedback,
// AI retries and review writes are intercepted before they reach the server.
const base = process.env.PERF_BASE_URL ?? 'http://localhost:3101';
const out = 'output/playwright/interactions';
await mkdir(out, { recursive: true });
const result = { checks: [], errors: [], cleanup: {} };
const ok = (name, value = true) => { assert.ok(value, name); result.checks.push(name); console.log('PASS', name); };
const checked = r => { if (r.error) throw Error(r.error.message); return r.data; };
const fixture = await createPerformanceFixture(3);
let destination, browser, page, jobId;
try {
  destination = await createPerformanceFixture(1);
  checked(await fixture.db.from('decks').update({name:'交互测试目标盒'}).eq('id',destination.deckId).eq('owner_id',fixture.uid));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: {width:393,height:851}, hasTouch:true, isMobile:true, locale:'zh-CN', serviceWorkers:'block' });
  await context.addCookies(fixture.cookies(base));
  await context.addInitScript(() => {
    window.__spoken = [];
    class Utterance { constructor(text) { this.text = text; } }
    const speech = { getVoices: () => [{ name: '测试中文', lang: 'zh-CN' }], addEventListener(){}, removeEventListener(){}, cancel(){}, speak(u){window.__spoken.push(u.text);} };
    Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});
    Object.defineProperty(window,'speechSynthesis',{value:speech,configurable:true});
    class Notice { static permission='denied'; static async requestPermission(){return this.permission;} }
    Object.defineProperty(window,'Notification',{value:Notice,configurable:true});
  });
  page = await context.newPage();
  page.setDefaultTimeout(18000);
  page.on('pageerror',e=>result.errors.push(e.message));
  const goto = async path => { await page.goto(base+path); await page.locator('h1').first().waitFor(); };
  const mockActions = async handler => page.route('**/*', async route => {
    if (route.request().method() !== 'POST' || !route.request().headers()['next-action']) return route.continue();
    const payload = await handler(route);
    if (payload === 'abort') return route.abort('failed');
    await route.fulfill({ status:200, contentType:'text/x-component', body:`0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(payload)}\n` });
  });
  const clearMocks = () => page.unroute('**/*');
  const toast = text => page.locator('[data-sonner-toast]').filter({hasText:text}).last().waitFor();
  const study = `/study?deckId=${fixture.deckId}`;
  await page.goto(base+study);
  const card = page.locator('.study-card-content');
  await page.getByRole('button',{name:'显示答案',exact:true}).waitFor();
  const first = await card.innerText();
  await page.getByRole('button',{name:'朗读',exact:true}).click();
  await page.getByRole('button',{name:'停止朗读',exact:true}).waitFor();
  ok('study speech exposes playing state and does not speak the answer', await page.evaluate(()=>window.__spoken.length===1&&!window.__spoken[0].includes('答案')));
  await page.getByRole('button',{name:'停止朗读',exact:true}).click();
  await page.getByRole('button',{name:'朗读',exact:true}).waitFor();
  const star = page.getByRole('button',{name:/^(取消收藏卡片|收藏卡片)$/});
  const before = await star.getAttribute('aria-pressed');
  await star.click();await toast(before==='true'?'已取消收藏':'已收藏卡片');
  ok('study star has immediate state and persists',await star.getAttribute('aria-pressed')!==before);
  await page.reload();await page.getByRole('button',{name:'显示答案',exact:true}).waitFor();
  ok('star state survives reload',await star.getAttribute('aria-pressed')!==before);
  await page.getByRole('button',{name:'切换卡片',exact:true}).click();
  await page.waitForFunction(t=>document.querySelector('.study-card-content')?.textContent!==t,first);
  ok('next card moves to the next ungraded card',(await card.innerText())!==first);
  ok('postponing does not count as review',checked(await fixture.db.from('cards').select('reps').eq('deck_id',fixture.deckId)).every(c=>c.reps===0));
  await page.getByRole('button',{name:'更多学习选项'}).click();
  await page.getByRole('heading',{name:'学习选项'}).waitFor();
  const motion = await page.locator('[data-slot="sheet-content"]').evaluate(e=>({name:getComputedStyle(e).animationName,duration:getComputedStyle(e).animationDuration}));
  ok('study menu opens with animation',motion.name!=='none');
  await page.getByRole('button',{name:'暂停这张卡片'}).click();await toast('已暂停');
  ok('suspend removes current card',checked(await fixture.db.from('cards').select('id').eq('deck_id',fixture.deckId).eq('suspended',true)).length===1);
  await page.getByRole('button',{name:'更多学习选项'}).click();
  await page.getByRole('button',{name:'学习设置',exact:true}).click();await page.waitForURL('**/me/settings?returnTo=*');
  await page.getByRole('link',{name:'返回学习'}).click();await page.waitForURL('**/study?deckId=*');
  ok('study settings return to the same deck',page.url().includes(fixture.deckId));
  await page.getByRole('button',{name:'更多学习选项'}).click();await page.getByRole('button',{name:'编辑这张卡片'}).click();
  await page.waitForURL('**/cards/*');await page.getByRole('button',{name:'保存卡片'}).waitFor();
  await page.getByLabel('问题',{exact:true}).fill('交互测试：编辑已保存');
  await page.getByRole('button',{name:'保存卡片'}).click();await page.waitForURL(`**/decks/${fixture.deckId}`);
  ok('study edit opens editor and saves the disposable note',checked(await fixture.db.from('notes').select('fields').eq('deck_id',fixture.deckId)).some(n=>n.fields.question==='交互测试：编辑已保存'));
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:/更多操作/}).first().click();
  await page.getByRole('button',{name:'恢复学习',exact:true}).click();await toast('已恢复学习');
  ok('paused filter provides a working restore action',checked(await fixture.db.from('cards').select('id').eq('deck_id',fixture.deckId).eq('suspended',true)).length===0);
  await page.getByRole('button',{name:'全部',exact:true}).click();
  await page.getByRole('button',{name:/更多操作/}).first().click();
  await page.getByLabel('移动到其他卡片盒').selectOption(destination.deckId);
  await page.getByRole('button',{name:'确认移动'}).click();await toast('已移动');
  ok('move updates the persisted deck',checked(await fixture.db.from('notes').select('id').eq('deck_id',fixture.deckId)).length===2);
  await page.getByRole('button',{name:/更多操作/}).first().click();await page.getByRole('button',{name:'删除卡片',exact:true}).click();
  ok('note deletion requires confirmation',await page.getByRole('button',{name:'确认删除',exact:true}).isVisible());
  await page.getByRole('button',{name:'确认删除',exact:true}).click();await toast('已删除');
  ok('confirmed note deletion persists',checked(await fixture.db.from('notes').select('id').eq('deck_id',fixture.deckId)).length===1);

  await goto('/decks');
  await page.getByRole('button',{name:'更多操作：性能基准卡片盒',exact:true}).click();
  await page.getByLabel('卡片盒名称').fill('交互测试临时卡盒');
  await mockActions(()=> 'abort');
  await page.getByRole('button',{name:'保存',exact:true}).click();await toast('操作未完成');
  ok('failed deck save keeps dialog and entered name',await page.getByLabel('卡片盒名称').inputValue()==='交互测试临时卡盒');
  await clearMocks();await page.getByRole('button',{name:'保存',exact:true}).click();await toast('已更新');
  ok('deck save can retry after network failure',checked(await fixture.db.from('decks').select('name').eq('id',fixture.deckId).single()).name==='交互测试临时卡盒');

  await goto('/me/settings');
  const nickname=await page.getByLabel('昵称',{exact:true}).inputValue();
  let posts=0;
  await mockActions(async()=>{posts++;await new Promise(r=>setTimeout(r,250));return {error:'模拟保存失败'};});
  await page.getByLabel('每日新卡上限',{exact:true}).fill('-1');await page.getByRole('button',{name:'保存设置',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'每日新卡上限'}).waitFor();ok('invalid daily limit is stopped before request',posts===0);
  await page.getByLabel('每日新卡上限').fill('20');await page.getByLabel('昵称',{exact:true}).fill('交互校验');
  await page.getByRole('button',{name:'保存设置',exact:true}).click();await toast('模拟保存失败');
  ok('settings error keeps unsaved edits and enables retry',await page.getByLabel('昵称',{exact:true}).inputValue()==='交互校验'&&await page.getByRole('button',{name:'保存设置',exact:true}).isEnabled());
  await clearMocks();await mockActions(()=>({}));await page.getByRole('button',{name:'保存设置',exact:true}).click();await toast('设置已保存');
  ok('successful settings save clears dirty status',await page.getByRole('button',{name:'保存设置',exact:true}).isDisabled());
  await clearMocks();await page.reload();await page.getByLabel('昵称',{exact:true}).waitFor();
  ok('profile tests did not mutate real preferences',await page.getByLabel('昵称',{exact:true}).inputValue()===nickname);
  await page.getByRole('button',{name:'试听朗读',exact:true}).click();await page.getByRole('button',{name:'停止试听',exact:true}).click();
  ok('speech preview starts and stops');
  await page.getByRole('button',{name:'授权浏览器通知',exact:true}).click();await toast('通知已被浏览器阻止');
  ok('denied notification permission is explained');
  const toggle=page.getByRole('switch',{name:'每日学习提醒'});
  const wasOn=await toggle.getAttribute('aria-checked');await toggle.click();
  ok('reminder switch changes visual state',await toggle.getAttribute('aria-checked')!==wasOn);
  await page.getByTestId('deepseek-key-input').fill('sk-test-not-a-real-secret');
  await mockActions(()=>({error:'模拟密钥保存失败'}));await page.getByTestId('deepseek-key-save').click();await toast('模拟密钥保存失败');
  ok('key failure retains draft and unlocks save',await page.getByTestId('deepseek-key-save').isEnabled());
  await clearMocks();await mockActions(()=>({masked:'sk-***test'}));await page.getByTestId('deepseek-key-save').click();await toast('API Key 已保存');
  await page.getByTestId('deepseek-key-clear').click();await page.getByRole('button',{name:'取消',exact:true}).click();
  ok('key clear offers cancellation',await page.getByTestId('deepseek-key-clear').isVisible());
  await page.getByTestId('deepseek-key-clear').click();await page.getByRole('button',{name:'确认清除',exact:true}).click();await toast('已清除');
  ok('mocked key clear completes');await clearMocks();

  await goto('/library');
  await page.getByRole('combobox',{name:'卡册排序'}).selectOption('recent');await page.waitForURL('**sort=recent');
  ok('library sort updates URL and active view',await page.getByRole('navigation',{name:'卡册排序视图'}).getByRole('link',{name:'最新',exact:true}).getAttribute('aria-current')==='page');
  const bookLinks=page.locator('ul a[href^="/library/"]');const firstBatch=await bookLinks.evaluateAll(es=>es.map(e=>e.getAttribute('href')).join(','));
  if(await page.getByRole('link',{name:'换一批',exact:true}).count()) {await page.getByRole('link',{name:'换一批',exact:true}).click();await page.waitForURL('**batch=1#library-books');ok('next library batch changes visible books',await bookLinks.evaluateAll(es=>es.map(e=>e.getAttribute('href')).join(','))!==firstBatch);}
  await page.getByRole('link',{name:'开始发现',exact:true}).click();ok('discover scrolls to book list',new URL(page.url()).hash==='#library-books');
  await page.getByRole('navigation',{name:'社区分类'}).getByRole('link',{name:'英语',exact:true}).click();await page.waitForURL('**category=*');
  ok('library category filter remains selected',await page.getByRole('link',{name:'英语',exact:true}).getAttribute('aria-current')==='page');
  await page.getByRole('textbox',{name:'搜索卡册',exact:true}).fill('不会命中的测试关键词');await page.getByRole('textbox',{name:'搜索卡册',exact:true}).press('Enter');await page.getByText('还没有找到卡册',{exact:true}).waitFor();
  ok('library empty search gives recovery action',await page.getByRole('link',{name:'查看全部',exact:true}).isVisible());
  await goto('/me');await page.getByRole('link',{name:'通知',exact:true}).click();await page.waitForURL('**/me/settings#reminder');ok('notification shortcut opens reminder section');
  await goto('/me');await page.getByRole('link',{name:'使用指北',exact:true}).click();await page.getByRole('button',{name:/第 4 步/}).click();await page.getByRole('button',{name:'开始使用',exact:true}).click();await page.waitForURL('**/me');ok('guide dots work and completion returns to profile');
  await goto('/me/stats');await page.getByRole('button',{name:/次复习/}).last().click();ok('heatmap supports tapping to reveal date',await page.getByRole('status').filter({hasText:/复习.*次/}).isVisible());
  await goto('/me/feedback');await mockActions(()=>({error:'模拟反馈失败'}));await page.getByLabel('反馈内容').fill('不会发送的测试反馈');await page.getByRole('button',{name:'提交',exact:true}).click();await toast('模拟反馈失败');ok('feedback failures preserve draft without sending messages',await page.getByLabel('反馈内容').inputValue()==='不会发送的测试反馈');await clearMocks();

  jobId=randomUUID();const aiCardId=randomUUID();
  const job=checked(await fixture.db.from('ai_jobs').insert({id:jobId,owner_id:fixture.uid,deck_id:fixture.deckId,status:'failed',error:'交互测试失败状态'}).select('*').single());
  const aiCard=checked(await fixture.db.from('ai_cards').insert({id:aiCardId,job_id:jobId,owner_id:fixture.uid,type:'qa',fields:{question:'临时 AI 草稿',answer:'测试答案'},status:'draft',ord:0}).select('*').single());
  await goto('/ai/'+jobId);let aiRequests=0;
  await mockActions(()=>{aiRequests++;return aiRequests===1?{}:{job:{...job,status:'ready',error:null},cards:[aiCard],sources:[]};});
  await page.getByRole('button',{name:'重试失败部分'}).click();await page.getByTestId('ai-import').waitFor();ok('AI retry restarts polling and displays ready state',aiRequests>=2);await clearMocks();
  await page.getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('问题',{exact:true}).fill('未保存的草稿修改');
  await mockActions(()=>({error:'模拟草稿保存失败'}));await page.getByRole('button',{name:'保存修改'}).click();await toast('模拟草稿保存失败');ok('AI editor stays open after failed save',await page.getByLabel('问题',{exact:true}).inputValue()==='未保存的草稿修改');
  await page.getByRole('button',{name:'取消',exact:true}).click();await clearMocks();await mockActions(()=>({error:'模拟删除失败'}));await page.getByRole('button',{name:'删除',exact:true}).click();await toast('模拟删除失败');ok('AI deletion failure retains card',await page.getByText('临时 AI 草稿',{exact:true}).isVisible());
  await clearMocks();await mockActions(()=>({error:'模拟导入失败'}));await page.getByTestId('ai-import').click();await toast('模拟导入失败');await page.waitForFunction(()=>!document.querySelector('[data-testid=ai-import]').disabled);ok('AI import failure enables retry',await page.getByTestId('ai-import').isEnabled());await clearMocks();

  for(const width of [320,393,430,1280]) {
    await page.setViewportSize({width,height:851});
    for(const route of ['/me/settings','/decks','/library','/me']) {
      await goto(route);ok(`${route} has no horizontal overflow at ${width}px`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(width===320)await page.screenshot({path:`${out}/${route.replaceAll('/','-')}-320.png`,fullPage:true,scale:'css'});
    }
  }
  await page.setViewportSize({width:393,height:851});await page.goto(base+study);await page.getByRole('button',{name:'显示答案',exact:true}).waitFor();
  const more=page.getByRole('button',{name:'更多学习选项'});const box=await more.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(170);
  const feedback=await more.evaluate(e=>({scale:getComputedStyle(e).scale,duration:getComputedStyle(e).transitionDuration}));await page.mouse.up();
  ok('button press visibly scales with short transition',parseFloat(feedback.scale)<1&&feedback.duration==='0.14s');
  await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await more.click();
  ok('reduced motion disables sheet movement',await page.locator('[data-slot="sheet-content"]').evaluate(e=>parseFloat(getComputedStyle(e).animationDuration)<0.01));
  await page.screenshot({path:out+'/study-menu-393.png',scale:'css'});
  ok('no unhandled client exceptions',result.errors.length===0);
} catch(error) {
  result.failure=error.message;
  if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
  throw error;
} finally {
  if(browser)await browser.close();
  if(jobId){checked(await fixture.db.from('ai_jobs').delete().eq('id',jobId).eq('owner_id',fixture.uid));result.cleanup.ai=checked(await fixture.db.from('ai_jobs').select('id').eq('id',jobId)).length===0;}
  result.cleanup.source=await fixture.cleanup();
  if(destination)result.cleanup.destination=await destination.cleanup();
  await writeFile(out+'/results.json',JSON.stringify(result,null,2));
  console.log('CLEANUP',JSON.stringify(result.cleanup));
}
