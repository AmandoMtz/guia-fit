const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/dist/js/campus-map.js'),'utf8');
function setup(start=101,count=15,selectedId){
 const buttons=Object.fromEntries(['forward','back','left','right','strafe-left','strafe-right','reset','turn'].map(action=>[action,{dataset:{walk:action},setPointerCapture(){}}]));
 const rooms=Array.from({length:count},(_,i)=>({setAttribute(){},addEventListener(_,fn){this.click=fn}}));
 const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
 const canvas={dataset:{},getContext:()=>ctx,isConnected:true};const status={};
 const section={querySelector:q=>q==='canvas'?canvas:status,querySelectorAll:q=>q==='[data-walk]'?Object.values(buttons):rooms};
 let tick;const context={window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){},createElement:()=>({getContext:()=>null})},FLOORS:{'edificio-b':{ground:Array.from({length:15},(_,i)=>'Salón '+(101+i)),upper:Array.from({length:12},(_,i)=>'Salón '+(401+i))},'edificio-c':{ground:Array.from({length:13},(_,i)=>'Salón '+(201+i)),upper:Array.from({length:15},(_,i)=>'Salón '+(301+i))}},performance:{now:()=>0},requestAnimationFrame:fn=>(tick=fn,1),cancelAnimationFrame:()=>{tick=null}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function walkInterior('),source.indexOf('  function walkOriginalInterior('))+';this.run=walkInterior;',context);
 context.run(section,rooms.map((_,i)=>'Salón '+(start+i)),selectedId);
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
 for(let i=0;i<200;i++)h.buttons.back.onclick();assert.ok(h.state().z>=-10);
 h.rooms.forEach(b=>{b.click();assert.ok(Number.isFinite(h.state().x));assert.ok(Number.isFinite(h.state().yaw));});
});

test('B y C: una fila consecutiva en ambas plantas y retorno a la derecha',()=>{
 for(const [start,count] of [[101,15],[401,12],[201,13],[301,15]]){
  const h=setup(start,count);let previous=0;
  h.rooms.forEach(b=>{b.click();const p=h.state();assert.equal(p.x,start>=200&&start<400?32:0);assert.equal(p.yaw,0);assert.ok(p.z>previous);previous=p.z;});
  h.buttons.turn.onclick();assert.ok(Math.cos(h.state().yaw)<0);const before=h.state().z;h.buttons.forward.onclick();assert.ok(h.state().z<before);
 }
});

test('conexiones B-C en ambas plantas y escalera continua de ida y vuelta',()=>{
 for(const start of [101,401]){
  const h=setup(start,start===101?15:12);
  for(let i=0;i<7;i++)h.buttons.back.onclick();
  for(let i=0;i<43;i++)h.buttons['strafe-right'].onclick();
  assert.ok(h.state().x>31);assert.equal(h.state().level,start===101?0:3.8);
 }
 const h=setup();for(let i=0;i<13;i++)h.buttons.back.onclick();
 assert.ok(h.state().z<-6);
 for(let i=0;i<43;i++)h.buttons['strafe-right'].onclick();
 assert.equal(h.state().level,3.8);
 for(let i=0;i<43;i++)h.buttons['strafe-left'].onclick();
 assert.equal(h.state().level,0);
});

test('cafetería: acceso central transitable, paredes y mostrador sólidos',()=>{
 const h=setup(101,15,'cafeteria');assert.equal(h.state().z,110);
 for(let i=0;i<14;i++)h.buttons.forward.onclick();assert.ok(h.state().z>118&&h.state().z<121.6);
 for(let i=0;i<40;i++)h.buttons.forward.onclick();assert.ok(h.state().z<121.6,'no atraviesa mostrador');
 h.buttons.reset.onclick();for(let i=0;i<7;i++)h.buttons['strafe-left'].onclick();
 for(let i=0;i<30;i++)h.buttons.forward.onclick();assert.ok(h.state().z<114.8,'no atraviesa fachada');
});
test('patio y bordes: no se atraviesan jardineras ni el límite exterior',()=>{
 const h=setup();for(let i=0;i<16;i++)h.buttons.forward.onclick();
 for(let i=0;i<70;i++)h.buttons['strafe-right'].onclick();assert.ok(h.state().x<9.8,'jardinera bloquea');
 const c=setup(201,13);for(let i=0;i<9;i++)c.buttons.forward.onclick();
 for(let i=0;i<200;i++)c.buttons['strafe-right'].onclick();assert.ok(c.state().x<=37.6);
 const top=setup(401,12);for(let i=0;i<10;i++)top.buttons.forward.onclick();for(let i=0;i<100;i++)top.buttons['strafe-right'].onclick();assert.ok(top.state().x<=1.4,'barandal superior bloquea salida');
});
test('numeraciones originales conservadas y cafetería disponible en POV',()=>{
 const map=require('../web/dist/js/campus-map.js');
 for(const [id,key,start,end] of [['edificio-b','ground',101,115],['edificio-b','upper',401,412],['edificio-c','ground',201,213],['edificio-c','upper',301,315]])assert.deepEqual(map.FLOORS[id][key],Array.from({length:end-start+1},(_,i)=>'Salón '+(start+i)));
 assert.match(map.floorMarkup('cafeteria'),/data-walk="strafe-left"/);
});
test('recorrido continuo desde B hasta cafetería sin teletransporte',()=>{
 const h=setup();for(let i=0;i<140;i++)h.buttons.forward.onclick();
 assert.ok(h.state().z>=105,'llega al extremo');
 for(let i=0;i<3;i++)h.buttons['strafe-right'].onclick();
 for(let i=0;i<7;i++)h.buttons.forward.onclick();
 for(let i=0;i<15;i++)h.buttons['strafe-right'].onclick();
 assert.ok(h.state().x>12&&h.state().z>108,'conexión lateral al patio de cafetería');
 for(let i=0;i<12;i++)h.buttons.forward.onclick();assert.ok(h.state().z>117,'entra por puerta');
});
test('joystick scene adapter preserves collision limits and normalized speed',()=>{
 const h=setup();const before=h.state();h.canvas.cmWalk.walk(0,1,1);assert.ok(h.state().z>before.z);assert.ok(h.state().z-before.z<=2.5);
 for(let i=0;i<20;i++)h.canvas.cmWalk.walk(-1,0,1);assert.ok(h.state().x>=-1.5);
 h.canvas.cmWalk.look(Math.PI/2,.2);assert.ok(Math.abs(h.state().yaw-Math.PI/2)<1e-9);
});
