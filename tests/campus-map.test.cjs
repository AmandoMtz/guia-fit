"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const map = require("../web/dist/js/campus-map.js");

test("campus model keeps legible buildings and does not claim room numbers", () => {
  assert.equal(new Set(map.BUILDINGS.map((b) => b.id)).size, 9);
  assert.equal(map.BUILDINGS.find((b) => b.id === "edificio-b").footprint[0][1], 705);
  assert.ok(map.BUILDINGS.find((b) => b.id === "edificio-c").footprint[0][1] > 705);
  assert.ok(map.BUILDINGS.every((b) => Object.isFrozen(b.footprint)));
  assert.ok(!map.BUILDINGS.some((b) => /sal[oó]n \d/i.test(b.name)));
});

test("all footprints fit the initial view for every supported rotation and mode", () => {
  for (const mode of ["2d", "3d"]) {
    for (let angle=-180; angle<=180; angle+=15) {
      const c = { mode, angle };
      const [x,y,w,h] = map.viewBox(c);
      assert.ok([x,y,w,h].every(Number.isFinite));
      for (const b of map.BUILDINGS) for (const p of b.footprint) {
        for (const z of [0,b.height]) {
          const [px,py] = map.project(p,z,c);
          assert.ok(px >= x && px <= x+w && py >= y && py <= y+h, b.id+" "+angle);
        }
      }
    }
  }
});

test("2D ignores symbolic height and rotation; camera rejects non-finite controls", () => {
  assert.deepEqual(map.project([100,200],30,{mode:"2d",angle:120}), map.project([100,200],0,{mode:"2d"}));
  const c = map.camera({zoom:Infinity,angle:NaN,panX:Infinity,panY:-Infinity});
  assert.equal(c.zoom,1);
  assert.ok(Object.values(c).filter((v) => typeof v==="number").every(Number.isFinite));
  assert.equal(map.camera({zoom:100}).zoom,3);
  assert.equal(map.camera({zoom:-1}).zoom,1);
});

test("old croquis coordinates never decide a new building or exact room position", () => {
  const places=[
    {id:"old-room",name:"Sala sin edificio",x:55,y:77,type:"Laboratorio"},
    {id:"wrong",name:"B",building:"Edificio C"},
    {id:"real-b",name:"Sala de prueba",building:"Edificio B"},
    {id:"misleading",name:"Laboratorio",building:"Biblioteca"},
  ];
  assert.deepEqual(map.placesFor("edificio-b",places).map((p)=>p.id),["real-b"]);
  assert.deepEqual(map.placesFor("laboratorios",places),[]);
  assert.deepEqual(map.placesFor("missing",places),[]);
  assert.deepEqual(map.placesFor("edificio-b",null),[]);
});

test("search finds registered spaces only through explicit building association", () => {
  const places=[{id:"one",name:"Salón Prueba",building:"Edificio B"},{id:"two",name:"Salón Sin edificio",x:40,y:80}];
  assert.deepEqual(map.searchBuildings("salon prueba",places).map((b)=>b.id),["edificio-b"]);
  assert.equal(map.searchBuildings("salon sin edificio",places).length,0);
  assert.deepEqual(map.searchBuildings("CAFETERIA",places).map((b)=>b.id),["cafeteria"]);
  assert.equal(map.searchBuildings("",places).length,9);
});

test("place names and IDs cannot inject markup into the detail panel", () => {
  const html=map.detailMarkup("edificio-b",[
    {id:'"><img src=x onerror=alert(1)>',name:'<script>alert("x")</script>',building:"Edificio B"},
  ],"",true);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes('data-place="&quot;&gt;&lt;img'));
});

test("manual location is explicitly labelled and invalid locations are ignored", () => {
  const html=map.scene({mode:"3d"},"edificio-b","edificio-b");
  assert.ok(html.includes("Referencia manual: Edificio B"));
  assert.ok(html.includes("Estoy aquí · manual"));
  assert.ok(!map.scene({},"","unknown").includes('class="cm-location"'));
  assert.ok(!map.scene({},"<script>","<script>").includes("<script>"));
});

test("both views keep nine keyboard-selectable locations and exclude unknown blocks", () => {
  for (const mode of ["2d","3d"]) {
    const html=map.scene({mode},"edificio-b");
    assert.equal((html.match(/role="button"/g)||[]).length,9);
    assert.equal((html.match(/tabindex="0"/g)||[]).length,9);
    assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
    assert.equal(html.includes('class="cm-wall"'),mode==="3d");
    assert.ok(html.includes("No indica rutas ni posición GPS."));
    assert.ok(!html.includes("NaN"));
  }
});


test("Posgrado: edificio contiguo y espacios por planta",()=>{
 assert.equal(map.BUILDINGS[2].id,'posgrado');
 assert.equal(map.BUILDINGS[8].id,'administracion-posgrado');
 const lower=map.floorMarkup('posgrado','ground'),upper=map.floorMarkup('posgrado','upper');
 assert.ok(lower.indexOf('data-room="Auditorio de Posgrado"')<lower.indexOf('data-room="Salón 2"'));
 assert.ok(lower.indexOf('data-room="Salón 2"')<lower.indexOf('data-room="Salón 1"'));
 assert.match(upper,/Recorrido en primera persona/);
 for(const room of [5,6,7,8])assert.match(upper,new RegExp('Salón '+room));
 assert.doesNotMatch(lower,/Salón 5/);
 assert.match(map.floorMarkup('administracion-posgrado','ground'),/Sala A/);
 assert.match(map.floorMarkup('administracion-posgrado','ground'),/Sala B/);
 assert.match(map.floorMarkup('administracion-posgrado','upper'),/Área Administrativa/);
 assert.equal(map.searchBuildings('salon 7',[])[0].id,'posgrado');
});
