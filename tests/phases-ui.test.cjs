const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');const map=require('../web/dist/js/campus-map.js');
test('edificios B y C: 55 salones, búsqueda y selección por planta',()=>{
 for(const [id,floor,start,end] of [['edificio-b','ground',101,115],['edificio-b','upper',401,412],['edificio-c','ground',201,213],['edificio-c','upper',301,315]]){
  assert.equal(map.FLOORS[id][floor].length,end-start+1);assert.ok(map.searchBuildings(String(end),[]).some(b=>b.id===id));const dom=new JSDOM(map.floorMarkup(id,floor));assert.equal(dom.window.document.querySelectorAll('[data-room]').length,end-start+1);dom.window.close();
 }
});
test('GPS: posición actualizada, permisos, parar y limpiar al salir',async()=>{
 const dom=new JSDOM('<body><div id="host"></div></body>',{url:'https://fit.test',runScripts:'outside-only'}),w=dom.window;let success,cleared=0;
 w.navigator.geolocation={watchPosition:fn=>{success=fn;return 17;},clearWatch:id=>{assert.equal(id,17);cleared++;}};
 w.eval(fs.readFileSync(path.join(__dirname,'../web/dist/js/live-location.js'),'utf8'));
 w.FIT_LIVE_LOCATION.mount({state:{admin:false},client:{request:async()=>({data:[]})}},w.document.querySelector('#host'));
 w.document.querySelector('[data-gps-start]').click();success({timestamp:Date.now(),coords:{latitude:22.2771,longitude:-97.8647,accuracy:10}});
 assert.match(w.document.querySelector('[data-gps-status]').textContent,/10 m/);assert.ok(w.document.querySelector('[data-gps-map] svg'));w.FIT_LIVE_LOCATION.clear();assert.equal(cleared,1);dom.window.close();
});
test('colección festiva: IDs únicos y marcos nuevos con diseño',()=>{const {catalog}=require('../server/gamification.cjs');assert.equal(new Set(catalog.map(x=>x.id)).size,catalog.length);for(const x of require('../server/seasonal-frames.cjs')){const item=catalog.find(c=>c.id===x.id);assert.ok(item.design);assert.equal(item.slot,'frame');assert.ok(item.price>=0);}});
