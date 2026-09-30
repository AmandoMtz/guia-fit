const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../web/dist/js/campus-map.js'),'utf8');
function setup(getUserMedia){
 function el(){const handlers={},children={},classes=new Set();return {hidden:false,style:{},isConnected:true,textContent:'',focus(){},classList:{add(...a){a.forEach(x=>classes.add(x));},remove(...a){a.forEach(x=>classes.delete(x));},toggle(x,on){on?classes.add(x):classes.delete(x);},contains:x=>classes.has(x)},querySelector(s){return children[s]??=(s==='video'?{srcObject:null,play:async()=>{}}:el());},querySelectorAll:()=>[],addEventListener(n,f){handlers[n]=f;},removeEventListener(n){delete handlers[n];},emit(n,e){return handlers[n]?.(e);},handlers};}
 const campus=el(),host=el(),doc=el(),win=el();doc.body={style:{overflow:'auto'}};doc.activeElement=el();doc.createElement=()=>el();doc.fullscreenElement=null;doc.hidden=false;win.isSecureContext=true;win.dispatchEvent=()=>{};
 let bar,panel;campus.prepend=x=>bar=x;campus.append=x=>panel=x;
 host.querySelector('[data-room-selection]').textContent='Edificio B · Planta alta · Salón 401';
 const context={window:win,document:doc,navigator:{mediaDevices:{getUserMedia}},Event:class{},getComputedStyle:()=>({visibility:'visible'})};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function immersive('),source.indexOf('  function mount('))+'this.run=immersive;',context);
 const controller=context.run(host,campus);
 const click=(kind,value)=>campus.emit('click',{target:{closest:()=>({dataset:{expand:value},hasAttribute:n=>n===kind})}});
 return {controller,click,campus,doc,win,get panel(){return panel;},get bar(){return bar;}};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('fullscreen fallback restores scrolling on Escape and destroy',()=>{
 const h=setup();h.click('data-expand','walk');assert.ok(h.campus.classList.contains('cm-immersive-walk'));assert.equal(h.doc.body.style.overflow,'hidden');
 h.doc.emit('keydown',{key:'Escape',preventDefault(){}});assert.equal(h.doc.body.style.overflow,'auto');assert.equal(h.bar.hidden,true);
 h.click('data-expand','map');h.controller.destroy();assert.equal(h.doc.body.style.overflow,'auto');assert.equal(Object.keys(h.doc.handlers).length,0);
});
test('camera denial leaves a clear message and close remains available',async()=>{
 const h=setup(async()=>{throw Object.assign(new Error(),{name:'NotAllowedError'});});h.click('data-camera');await flush();
 assert.match(h.panel.querySelector('[data-camera-status]').textContent,/Permiso denegado/);h.click('data-immersive-close');assert.equal(h.panel.hidden,true);
});
test('late permission after leaving stops every camera track',async()=>{
 let resolve,stops=0;const h=setup(()=>new Promise(r=>resolve=r));h.click('data-camera');h.controller.leave();
 resolve({getTracks:()=>[{stop:()=>stops++}]});await flush();assert.equal(stops,1);assert.equal(h.panel.querySelector('video').srcObject,null);
});
test('camera uses no audio, shows selected destination, stops when hidden',async()=>{
 let stops=0,args;const track={stop:()=>stops++,addEventListener(){}};const media={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const h=setup(async options=>(args=options,media));h.click('data-camera');await flush();
 assert.equal(args.audio,false);assert.equal(args.video.facingMode.ideal,'environment');assert.match(h.panel.querySelector('[data-camera-destination]').textContent,/401/);
 assert.equal(h.panel.querySelector('video').srcObject,media);h.doc.hidden=true;h.doc.emit('visibilitychange');assert.equal(stops,1);assert.equal(h.panel.hidden,true);
});
test('insecure contexts never request the camera',async()=>{
 let calls=0;const h=setup(async()=>calls++);h.win.isSecureContext=false;h.click('data-camera');await flush();assert.equal(calls,0);assert.match(h.panel.querySelector('[data-camera-status]').textContent,/HTTPS/);
});
