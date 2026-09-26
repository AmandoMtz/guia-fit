const {chromium}=require('playwright');const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox']});try{
for(const width of [1280,390]){const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:8765/');
await page.evaluate(()=>document.body.innerHTML='<div class="top-actions"><button class="profile-shortcut"><span class="avatar profile-avatar"><img src="/assets/guia-fit-mascota.png" alt=""></span></button></div><main id="view"></main>');
await page.evaluate(()=>{window.fixture={coins:300,level:3,xp:200,next:100,animations:true,equipped:{frame:'frame-halloween'},catalog:[{id:'frame-halloween',name:'Halloween',description:'Fiesta',slot:'frame',price:50}],inventory:[],history:[{activity:'first-schedule',created_at:new Date().toISOString(),xp:30}],days:[],categories:[]};window.c={state:{admin:true,user:{id:'test',account_type:'admin'},view:'rewards'},toast:()=>{},client:{request:async(url)=>({data:url.endsWith('/me')?fixture:{}})},dialog:html=>{const d=document.createElement('dialog');d.innerHTML=html;document.body.append(d);d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.addEventListener('close',()=>d.remove());return d;}};});
await page.evaluate(()=>FIT_REWARDS.render(c));await page.locator('[data-tab=shop]').click();await page.locator('[data-try]').click();await page.locator('dialog').waitFor();
assert.equal(await page.locator('dialog .profile-avatar img').count(),1);assert.equal(await page.locator('dialog .fit-frame-particles i').count(),6);
assert.notEqual(await page.locator('dialog .fit-frame-particles i').first().evaluate(e=>getComputedStyle(e).animationName),'none');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:'/workspace/scratch/6946f25ba18f/preview-'+width+'.png'});
await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
assert.equal(await page.evaluate(()=>document.body.dataset.fitframe),'frame-halloween');
await page.locator('[data-tab=editor]').click();await page.locator('[name=name]').fill('Marco verde');await page.locator('[name=effect]').selectOption('candy');await page.locator('#style-try').click();assert.equal(await page.locator('dialog .fit-frame-particles i').count(),6);await page.locator('[data-close]').click();
assert.deepEqual(errors,[]);console.log('Preview y editor OK '+width);await page.close();}
// Service worker must serve the independent game on a real disconnected context.
const context=await browser.newContext();const page=await context.newPage();await page.goto('http://localhost:8765/');await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await page.reload();await context.setOffline(true);await page.goto('http://localhost:8765/juego-castor.html');await page.locator('[data-start-offline-game]').click();await page.locator('[data-play]').waitFor({state:'visible'});console.log('Juego offline OK');await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
