import { chromium } from 'playwright';
import { createServerClient } from '@supabase/ssr';
import nextEnv from '@next/env';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
nextEnv.loadEnvConfig(process.cwd());
const base=process.env.PERF_BASE_URL??'http://localhost:3102',cookies=new Map();
const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies.values()],setAll:a=>a.forEach(c=>cookies.set(c.name,c))}});
const checked=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const auth=checked(await db.auth.signInWithPassword({email:process.env.PERF_EMAIL??'demo@huaji.local',password:process.env.PERF_PASSWORD??'huaji123456'}));
const result={checks:[],errors:[]},ok=(name,test=true)=>{assert.ok(test,name);result.checks.push(name);console.log('PASS',name);};
const browser=await chromium.launch({channel:'chrome',headless:true});
const deckName='交互验收-'+randomUUID();let deckId;
try{
 const ctx=await browser.newContext({viewport:{width:320,height:740},hasTouch:true,isMobile:true,locale:'zh-CN'});await ctx.addCookies([...cookies.values()].filter(c=>c.value).map(c=>({name:c.name,value:c.value,url:base,sameSite:'Lax'})));
 await ctx.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{value:undefined,configurable:true});class Notice{static permission='denied';static async requestPermission(){return'denied';}}Object.defineProperty(window,'Notification',{value:Notice,configurable:true});});
 const p=await ctx.newPage();p.on('pageerror',e=>result.errors.push(e.message));p.setDefaultTimeout(15000);
 await p.goto(base+'/me/settings');await p.getByRole('button',{name:'试听朗读'}).click();await p.getByText('当前浏览器不支持朗读，请使用支持系统语音的浏览器',{exact:true}).waitFor();ok('unsupported speech reports the limitation instead of silently failing');
 await p.evaluate(uid=>{localStorage.removeItem(`vji:reminder-day:${uid}`);window.dispatchEvent(new CustomEvent('vji:reminder-settings',{detail:{enabled:true,time:'00:00'}}));},auth.user.id);
 await p.getByText('到学习时间了',{exact:true}).waitFor();ok('page-open reminder triggers at the configured time');
 await p.evaluate(()=>window.dispatchEvent(new CustomEvent('vji:reminder-settings',{detail:{enabled:true,time:'00:00'}})));
 ok('reminder is deduplicated per owner/day',await p.getByText('到学习时间了',{exact:true}).count()===1);
 await p.getByRole('button',{name:'开始学习',exact:true}).click();await p.waitForURL('**/study');ok('reminder action opens study');
 await p.goto(base+'/library');await p.getByRole('button',{name:'搜索卡册',exact:true}).click();ok('search icon focuses the input',await p.getByRole('textbox',{name:'搜索卡册',exact:true}).evaluate(e=>e===document.activeElement));
 await p.locator('ul a[href^="/library/"]').first().click();await p.getByRole('heading',{name:'目录',exact:true}).waitFor();
 const summary=p.locator('details summary').first();if(await summary.count()){await summary.click();ok('book chapter expands a preview',await summary.evaluate(e=>e.parentElement.open));}
 const join=p.getByRole('button',{name:/免费加入|前往卡片盒/});await join.waitFor();
 if(await join.innerText()==='免费加入'){
  await p.route('**/*',r=>r.request().method()==='POST'&&r.request().headers()['next-action']?r.abort('failed'):r.continue());await join.click();await p.getByText('操作未完成，请检查网络后重试',{exact:true}).waitFor();ok('failed book join unlocks retry without cloning a deck',await join.isEnabled());await p.unroute('**/*');
 }else{await join.click();await p.waitForURL('**/decks/*');ok('joined book opens its exact deck');}
 await p.goto(base+'/decks/new');await p.getByLabel('卡片盒名称').fill(deckName);await p.getByRole('button',{name:'创建',exact:true}).click();await p.waitForURL(/\/decks\/[0-9a-f-]+$/);deckId=new URL(p.url()).pathname.split('/').at(-1);ok('new deck form creates and navigates to persisted deck',checked(await db.from('decks').select('id').eq('id',deckId).eq('owner_id',auth.user.id)).length===1);
 await p.goto(base+'/decks');await p.getByRole('button',{name:'更多操作：'+deckName,exact:true}).click();await p.getByRole('button',{name:'删除',exact:true}).click();await p.getByRole('alertdialog').getByRole('button',{name:'删除',exact:true}).click();await p.getByText('已删除',{exact:true}).waitFor();ok('deck deletion confirms and removes only the disposable deck',checked(await db.from('decks').select('id').eq('id',deckId)).length===0);
 await p.goto(base+'/onboarding?returnTo=/me');await p.getByRole('button',{name:/第 3 步/}).click();await p.getByRole('button',{name:'跳过',exact:true}).click();await p.waitForURL('**/me');ok('signed-in guide also works in production build');
 const anon=await browser.newContext({viewport:{width:393,height:851}}),login=await anon.newPage();await login.goto(base+'/login');await login.getByLabel('邮箱').fill('offline@example.invalid');await login.getByLabel('密码',{exact:true}).fill('testing-only-password');
 await login.route('**/*',r=>r.request().method()==='POST'&&r.request().headers()['next-action']?r.abort('failed'):r.continue());await login.getByRole('button',{name:'登录',exact:true}).click();await login.getByText('暂时无法登录，请检查网络后重试',{exact:true}).waitFor();ok('login failure retains input and enables retry',await login.getByLabel('邮箱').inputValue()==='offline@example.invalid'&&await login.getByRole('button',{name:'登录',exact:true}).isEnabled());
 await login.unroute('**/*');await login.getByRole('button',{name:'使用演示账号'}).click();await login.waitForURL('**/today');ok('demo login works after a failed attempt');await login.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:'我的',exact:true}).click();await login.getByRole('button',{name:'退出登录',exact:true}).click();await login.waitForURL('**/login');ok('sign out returns to login');
 ok('production routes have no unhandled client errors',result.errors.length===0);
}catch(e){result.failure=e.message;throw e;}
finally{await browser.close();checked(await db.from('decks').delete().eq('name',deckName).eq('owner_id',auth.user.id));result.cleanup=checked(await db.from('decks').select('id').eq('name',deckName).eq('owner_id',auth.user.id)).length===0;await writeFile('output/playwright/interactions/supplement.json',JSON.stringify(result,null,2));console.log('CLEANUP',result.cleanup);}
