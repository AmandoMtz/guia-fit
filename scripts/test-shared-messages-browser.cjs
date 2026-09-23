const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const output=path.join(require('os').tmpdir(),'fit-shared-chat-qa');fs.mkdirSync(output,{recursive:true});
const root=path.resolve(__dirname,'../web/dist');
(async()=>{const browser=await chromium.launch({...(process.env.FIT_CHROMIUM_PATH?{executablePath:process.env.FIT_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const width of [1280,390]){const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('http://localhost/**',route=>{const pathname=new URL(route.request().url()).pathname;const file=path.join(root,pathname);return pathname.startsWith('/assets/')&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({contentType:'text/html',body:'<html></html>'});});await page.goto('http://localhost/');page.setDefaultTimeout(8000);
await page.setContent('<html><body><span id="academic-chat-count"></span><main id="view"></main></body></html>');
await page.addStyleTag({path:path.join(root,'styles.css')});await page.addStyleTag({path:path.join(root,'chat-presence.css')});
await page.evaluate(()=>{window.EventSource=class{addEventListener(){}close(){}};window.confirm=()=>true;window.notes=[];window.sent=[];window.stage='requested';window.orderCreated=false;window.seller=false;window.photo=false;
window.c={state:{user:{id:'student',account_type:'student'},view:'messages'},$:s=>document.querySelector(s),esc:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),icon:()=>'',toast:m=>notes.push(m),poll:()=>{},render:()=>FIT_ACADEMIC_CHAT.render(c),dialog:html=>{const d=document.createElement('dialog');d.innerHTML=html;document.body.append(d);d.showModal();d.addEventListener('close',()=>d.remove());return d;},client:{request:async(url,method='GET',body)=>{
const chat={id:'f1',role:seller?'seller':'buyer',counterpart_id:seller?'student':'vendor',counterpart_name:seller?'Alumno':'Tacos FIT',business_name:'Tacos FIT',product_id:'p1',product_name:'Tacos',pickup_location:'Puesto 1',expires_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString(),messages:[],unread_count:1,order_id:orderCreated?'o1':null};
if(url==='/api/food/chats')return {data:method==='POST'?chat:{items:[chat],unread_count:1}};
if(url==='/api/food/catalog')return {data:{products:[{id:'p1',name:'Tacos',business_name:'Tacos FIT',seller_user_id:'vendor',price_cents:2500,sale_unit:'unit'}]}};
if(url==='/api/food/orders'&&method==='POST'){orderCreated=true;sent.push({url,body});return {data:{id:'o1'}};}
if(url==='/api/food/orders/o1'){if(method==='PATCH'){stage=body.status;sent.push({url,body});}return {data:{id:'o1',status:stage,product_name:'Tacos',total_cents:5000,quantity:2,sale_unit:'unit',pickup_location:'Puesto 1'}};}
if(url.includes('/food/chats/f1')){if(method==='POST'){sent.push({url,body});}return {data:chat};}
if(url==='/api/academic-chat/chats')return {data:method==='POST'?{id:'a1'}:{items:[{id:'a1',counterpart_name:'Docente Ana',counterpart_type:'teacher',last_message:'Hola',unread_count:2}],unread_count:2}};
if(url.includes('/contacts?'))return {data:[{id:'t1',full_name:'Docente Ana',account_type:'teacher'}]};
if(url.includes('/academic-chat/chats/a1')){if(method==='POST')sent.push({url,body});return {data:{id:'a1',counterpart_name:'Docente Ana',counterpart_type:'teacher',messages:[]}};}
if(url==='/api/gamification/orders')return {data:[{id:'o1',business_name:'Tacos FIT',product_name:'Tacos',categories:['comida'],stars:window.rated?5:null}]};
if(url==='/api/gamification/ratings'){window.rated=true;sent.push({url,body});return {data:{}};}
throw Error('API inesperada '+url);
}}};});
for(const f of ['food-flow.js','purchase-rating.js','food.js','academic-chat.js'])await page.addScriptTag({path:path.join(root,'js',f)});
await page.evaluate(()=>FIT_ACADEMIC_CHAT.render(c));await page.locator('[data-chat="food:f1"]').waitFor();assert.equal(await page.locator('[data-chat]').count(),2);assert.equal(await page.locator('#academic-chat-count').textContent(),'3');
await page.locator('[data-chat="food:f1"]').click();await page.locator('#chat-order-action').click();await page.waitForTimeout(150);await page.locator('[name=quantity]').fill('2');await page.locator('#chat-order-form').evaluate(f=>f.requestSubmit());await page.locator('.shared-order-card').waitFor();assert.match(await page.locator('.shared-order-card').innerText(),/Por confirmar/);
await page.locator('#chat-text').fill('Hola vendedor');await page.locator('#chat-composer').evaluate(f=>f.requestSubmit());
await page.locator('[data-chat="a1"]').click();await page.locator('#academic-message-form textarea').fill('Hola docente');await page.locator('#academic-message-form').evaluate(f=>f.requestSubmit());
await page.locator('[data-chat="food:f1"]').click();await page.locator('.shared-order-card').waitFor();
await page.evaluate(()=>{seller=true;FIT_ACADEMIC_CHAT.render(c);});await page.locator('[data-inline-status="accepted"]').click();await page.locator('[data-inline-status="ready"]').click();await page.locator('[data-inline-status="completed"]').click();await page.waitForFunction(()=>stage==='completed');
await page.evaluate(()=>{seller=false;FIT_ACADEMIC_CHAT.render(c);});await page.locator('[data-inline-rate]').click();await page.locator('[name=service_stars][value="5"]').check();await page.locator('[name=product_stars][value="4"]').check();await page.locator('#purchase-rating-form button').click();await page.waitForFunction(()=>rated===true);
await page.locator('[data-chat-filter="food"]').click();assert.equal(await page.locator('[data-chat]').count(),1);
await page.locator('#academic-contact-query').fill('Tacos');await page.locator('[data-food-product]').waitFor();await page.locator('[data-food-product]').click();await page.locator('.shared-food-chat').waitFor();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'messages-'+width+'.png'),fullPage:true});console.log('OK comprador, vendedor, pedido, valoración, búsqueda, cambio de chat: '+width);await page.evaluate(()=>FIT_ACADEMIC_CHAT.disconnect());}
const framePage=await browser.newPage({viewport:{width:1000,height:700}});
await framePage.setContent('<main class="reward-grid" id="frames" style="padding:30px"></main>');await framePage.addStyleTag({path:path.join(root,'styles.css')});
await framePage.evaluate(()=>{document.querySelector('#frames').innerHTML=['halloween','mexico','christmas','muertos','newyear','valentine'].map(x=>'<article class="reward-card"><div class="reward-preview frame-'+x+'"><span>FIT</span></div><h3>'+x+'</h3></article>').join('');});
assert.notEqual(await framePage.locator('.frame-halloween>span').evaluate(el=>getComputedStyle(el).animationName),'none');
await framePage.screenshot({path:path.join(output,'frames.png'),fullPage:true});await framePage.emulateMedia({reducedMotion:'reduce'});assert.equal(await framePage.locator('.frame-halloween>span').evaluate(el=>getComputedStyle(el).animationName),'none');
console.log('OK marcos animados y movimiento reducido');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
