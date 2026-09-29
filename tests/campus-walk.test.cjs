const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/dist/js/campus-map.js'),'utf8');
function setup(start=101,count=15){
 const buttons=Object.fromEntries(['forward','back','left','right','strafe-left','strafe-right','reset','turn'].map(action=>[action,{dataset:{walk:action},setPointerCapture(){}}]));
 const rooms=Array.from({length:count},(_,i)=>({setAttribute(){},addEventListener(_,fn){this.click=fn}}));
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={dataset:{},getContext:()=>ctx,isConnected:true};const status={};
 const section={querySelector:q=>q==='canvas'?canvas:status,querySelectorAll:q=>q==='[data-walk]'?Object.values(buttons):rooms};
 let tick;const context={FLOORS:{'edificio-b':{ground:Array.from({length:15},(_,i)=>'Salón '+(101+i)),upper:Array.from({length:12},(_,i)=>'Salón '+(401+i))},'edificio-c':{ground:Array.from({length:13},(_,i)=>'Salón '+(201+i)),upper:Array.from({length:15},(_,i)=>'Salón '+(301+i))}},performance:{now:()=>0},requestAnimationFrame:fn=>(tick=fn,1),cancelAnimationFrame:()=>{tick=null}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function walkInterior('),source.indexOf('  function walkOriginalInterior('))+';this.run=walkInterior;',context);
 context.run(section,rooms.map((_,i)=>'Salón '+(start+i)));
 return {buttons,rooms,canvas,state:()=>JSON.parse(canvas.dataset.position),tick:t=>tick?.(t)};
}
test('exterior: movimiento continuo, desplazamiento lateral, límites, selección y reinicio',()=>{
 const h=setup();h.buttons.forward.onclick();assert.ok(h.state().z>2);
 h.buttons['strafe-right'].onclick();assert.ok(h.state().x>0);
 h.rooms[0].click();assert.equal(h.state().x,0);
 h.buttons.left.onclick();h.buttons.left.onclick();h.buttons.left.onclick();h.buttons.left.onclick();h.buttons.left.onclick();h.buttons.left.onclick();h.buttons.left.onclick();
 for(let i=0;i<80;i++)h.buttons.forward.onclick();assert.ok(h.state().x>=-1.5,'no atraviesa el muro');
 h.buttons.reset.onclick();assert.equal(h.state().z,2);
 h.buttons.forward.onpointerdown({preventDefault(){},pointerId:1});h.tick(40);assert.ok(h.state().z>2);h.buttons.forward.onpointerup();
 for(let i=0;i<200;i++)h.buttons.back.onclick();assert.ok(h.state().z>=1);
 h.rooms.forEach(b=>{b.click();assert.ok(Number.isFinite(h.state().x));assert.ok(Number.isFinite(h.state().yaw));});
});

test('B y C: una fila consecutiva en ambas plantas y retorno a la derecha',()=>{
 for(const [start,count] of [[101,15],[401,12],[201,13],[301,15]]){
  const h=setup(start,count);let previous=0;
  h.rooms.forEach(b=>{b.click();const p=h.state();assert.equal(p.x,0);assert.equal(p.yaw,0);assert.ok(p.z>previous);previous=p.z;});
  h.buttons.turn.onclick();assert.ok(Math.cos(h.state().yaw)<0);const before=h.state().z;h.buttons.forward.onclick();assert.ok(h.state().z<before);
 }
});
