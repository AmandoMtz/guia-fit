const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(path.join(__dirname,'../web/dist/js/push-notifications.js'),'utf8');
async function harness(t,{permission='default',supported=true,view='profile',failConfig=false}={}){
 const dom=new JSDOM('<main id="view"></main>',{url:'https://fit.example.test',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 w.isSecureContext=true;let subscribed=false,requests=[],requested=0,sub=null;
 const subscription={endpoint:'https://fcm.googleapis.com/test',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'key',auth:'auth'}};},async unsubscribe(){sub=null;return true;}};
 const reg={pushManager:{async getSubscription(){return sub;},async subscribe(){sub=subscription;return sub;}}};
 Object.defineProperty(w.navigator,'serviceWorker',{value:{register:async()=>reg,ready:Promise.resolve(reg),addEventListener(){}}});
 if(supported){w.PushManager=function(){};w.Notification={permission,async requestPermission(){requested++;this.permission='granted';return 'granted';}};}
 const c={state:{user:{id:'11111111-1111-4111-8111-111111111111'},view},esc:s=>String(s),toast(){},render(){},client:{async request(url,method='GET',body){requests.push({url,method,body});if(url.endsWith('/config')){if(failConfig){failConfig=false;return {error:{message:'Error temporal'}};}return {data:{publicKey:'AQID'}};}if(url.endsWith('/activity'))return {data:[]};if(url.endsWith('/status'))return {data:{enabled:subscribed}};if(url.endsWith('/subscription')){subscribed=method==='POST';return {data:{enabled:subscribed}};}return {data:{sent:true}};}}};
 w.eval(script);w.FIT_PUSH.mount(c);
 await new Promise(r=>setTimeout(r,15));
 return {w,c,requests,permissionRequests:()=>requested,el:sel=>w.document.querySelector(sel)};
}
test('botón visible en Mi cuenta y campana: activa, envía prueba y desactiva',async t=>{
 for(const view of ['profile','notifications'])await t.test(view,async t=>{
 const h=await harness(t,{view});const enable=h.el('[data-push-enable]');
 assert.equal(enable.hidden,false);assert.equal(enable.disabled,false);assert.equal(enable.textContent,'Permitir notificaciones');assert.equal(h.permissionRequests(),0);
 await enable.onclick();assert.equal(h.permissionRequests(),1);assert.equal(enable.hidden,true);
 const check=h.el('[data-push-test]');assert.equal(check.hidden,false);await check.onclick();assert.ok(h.requests.some(r=>r.url==='/api/push/test'&&r.method==='POST'));
 const off=h.el('[data-push-disable]');assert.equal(off.hidden,false);await off.onclick();assert.equal(enable.hidden,false);assert.ok(h.requests.some(r=>r.url==='/api/push/subscription'&&r.method==='DELETE'));
 });
});
test('permiso bloqueado e iPhone sin instalar conservan botón de ayuda visible',async t=>{
 for(const option of [{permission:'denied'},{supported:false}])await t.test(JSON.stringify(option),async t=>{
 const h=await harness(t,option),button=h.el('[data-push-enable]');assert.equal(button.hidden,false);assert.equal(button.disabled,false);assert.match(button.textContent,/Cómo/);await button.onclick();assert.equal(h.permissionRequests(),0);assert.match(h.el('[data-push-status]').textContent,/permisos|pantalla de inicio/);
 });
});
test('un error temporal al preparar push permite reintentar con el botón',async t=>{
 const h=await harness(t,{failConfig:true}),button=h.el('[data-push-enable]');assert.equal(button.disabled,false);assert.equal(typeof button.onclick,'function');await button.onclick();assert.equal(h.el('[data-push-test]').hidden,false);
});
