const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/dist/js/campus-map.js'),'utf8');
function setup(){
 const buttons=Object.fromEntries(['forward','back','left','right','strafe-left','strafe-right','reset'].map(action=>[action,{dataset:{walk:action},setPointerCapture(){}}]));
 const rooms=Array.from({length:15},(_,i)=>({setAttribute(){},addEventListener(_,fn){this.click=fn}}));
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={dataset:{},getContext:()=>ctx,isConnected:true};const status={};
 const section={querySelector:q=>q==='canvas'?canvas:status,querySelectorAll:q=>q==='[data-walk]'?Object.values(buttons):rooms};
 let tick;const context={performance:{now:()=>0},requestAnimationFrame:fn=>(tick=fn,1),cancelAnimationFrame:()=>{tick=null}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function walkInterior('),source.indexOf('  function walkOriginalInterior('))+';this.run=walkInterior;',context);
 context.run(section,rooms.map((_,i)=>'Salón '+(101+i)));
 return {buttons,rooms,canvas,state:()=>JSON.parse(canvas.dataset.position),tick:t=>tick?.(t)};
}
test('exterior: movimiento continuo, desplazamiento lateral, límites, selección y reinicio',()=>{
 const h=setup();h.buttons.forward.onclick();assert.ok(h.state().z>2);
 h.buttons['strafe-right'].onclick();assert.ok(h.state().x>0);
 h.rooms[0].click();assert.equal(h.state().x,-25.5);
 for(let i=0;i<80;i++)h.buttons.forward.onclick();assert.ok(h.state().x<=-24.35,'no atraviesa el muro');
 h.buttons.reset.onclick();assert.equal(h.state().z,2);
 h.buttons.forward.onpointerdown({preventDefault(){},pointerId:1});h.tick(40);assert.ok(h.state().z>2);h.buttons.forward.onpointerup();
 for(let i=0;i<200;i++)h.buttons.back.onclick();assert.ok(h.state().z>=-2);
 h.rooms.forEach(b=>{b.click();assert.ok(Number.isFinite(h.state().x));assert.ok(Number.isFinite(h.state().yaw));});
});
