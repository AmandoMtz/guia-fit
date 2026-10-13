'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {orientation,joystick,angle}=require('../web/dist/js/campus-controls.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('joystick has a dead zone, proportional speed and bounded diagonals',()=>{
 assert.deepEqual(joystick(2,2,40),{side:0,forward:0});
 const half=joystick(0,-20,40),full=joystick(0,-40,40),far=joystick(400,-400,40);
 assert.ok(half.forward>0&&half.forward<1);close(full.forward,1);close(Math.hypot(far.side,far.forward),1);assert.ok(far.side>0&&far.forward>0);
});
test('orientation follows optical direction in portrait and landscape',()=>{
 close(orientation(0,90,0).yaw,0);close(orientation(0,90,0).elevation,0);
 close(orientation(270,90,0).yaw,Math.PI/2);
 // Same forward axis after rotating the phone about its camera axis.
 close(orientation(90,0,-90).yaw,0);close(orientation(90,0,-90).elevation,0);
 assert.equal(orientation(null,90,0),null);assert.equal(orientation(0,0,0),null);
 close(angle((359-1)*Math.PI/180),-2*Math.PI/180);
});
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness({permission,requestSession}={}){
 const nodes=new Map(),listeners=new Map();let frames=new Map(),serial=0,walks=0,looks=0;
 function el(key){if(nodes.has(key))return nodes.get(key);const handlers=new Map(),classes=new Set();const e={dataset:{},style:{},hidden:false,isConnected:true,checked:true,textContent:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},setAttribute(){},insertAdjacentHTML(){},getBoundingClientRect:()=>({left:0,top:0,width:116,height:116}),setPointerCapture(){},querySelector:el,addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k),dispatchEvent:e=>handlers.get(e.type)?.(e),emit:(type,target)=>handlers.get(type)?.({target:{closest:s=>s===target?{}:null}}),getContext:()=>null};nodes.set(key,e);return e;}
 const win={isSecureContext:true,DeviceOrientationEvent:{requestPermission:permission||(()=>Promise.resolve('granted'))},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 const doc={hidden:false,addEventListener:(k,f)=>listeners.set('doc:'+k,f),removeEventListener:k=>listeners.delete('doc:'+k),createElement:el};
 el('.cm-walk').cmWalk={getPose:()=>({x:0,z:0,yaw:0,elevation:0,campus:true}),walk:()=>walks++,look:()=>looks++};
 const context={module:{exports:{}},window:win,document:doc,navigator:{xr:requestSession?{requestSession}:null},Event:class{constructor(type){this.type=type;}},setTimeout:()=>1,clearTimeout(){},performance:{now:()=>0},requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../web/dist/js/campus-controls.js'),'utf8'),context);const campus=el('campus'),controller=context.module.exports.mount(campus,campus);controller.attach();
 return {controller,campus,el,listeners,frames,win,doc,get walks(){return walks;},get looks(){return looks;}};
}
test('joystick stops scheduling movement on pointer cancellation and teardown',()=>{
 const h=harness(),pad=h.el('.cm-joystick');pad.onpointerdown({currentTarget:pad,pointerId:1,clientX:58,clientY:20,preventDefault(){}});assert.equal(h.frames.size,1);
 pad.onpointercancel();assert.equal(h.frames.size,0);h.controller.destroy();assert.equal(h.listeners.size,0);
});
test('sensor permission resolved after leaving never reattaches listeners',async()=>{
 let resolve;const h=harness({permission:()=>new Promise(r=>resolve=r)});const pending=h.controller.enableGyro();h.controller.stop();resolve('granted');await pending;assert.equal(h.listeners.has('deviceorientation'),false);h.controller.destroy();
});
test('orientation updates scene, and disabling removes the sensor listener',async()=>{
 const h=harness();await h.controller.enableGyro();h.listeners.get('deviceorientation')({alpha:0,beta:90,gamma:0});h.listeners.get('deviceorientation')({alpha:270,beta:90,gamma:0});assert.equal(h.looks,2);h.controller.stop();assert.equal(h.listeners.has('deviceorientation'),false);h.controller.destroy();
});
test('removed AR controls cannot request an XR session',()=>{let calls=0;const h=harness({requestSession:()=>calls++});h.campus.emit('click','[data-ar-start]');assert.equal(calls,0);assert.equal(h.controller.arActive,undefined);h.controller.destroy();});
