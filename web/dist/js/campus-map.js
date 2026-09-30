/* Guía FIT · Modelo esquemático del plano de planta alta, conjunto oriente.
 * Coordenadas de trazado en la imagen 815 × 943; NO son GPS ni metros.
 * Altura uniforme de dibujo, sin afirmar pisos, accesos ni rutas verificadas.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FIT_CAMPUS_MAP = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const rect = (x, y, w, h) => [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const BUILDINGS = [
    { id:"campo", name:"Campo de futbol", short:"Futbol", type:"Deportivo", anchor:[259,230], footprint:rect(118,64,282,356), height:0, placeIds:["campo-futbol"], aliases:[], note:"Campo de futbol al norte del conjunto." },
    { id:"laboratorios", name:"Laboratorios", short:"Lab", type:"Académico", anchor:[214,442], footprint:rect(134,420,159,44), height:30, placeIds:[], aliases:["laboratorios",'edificio laboratorios'], note:"Bloque identificado como Laboratorios en el plano, al sur del campo de futbol." },
    { id:"posgrado", name:"Salones de Posgrado", short:"Posgrado", type:"Académico", anchor:[514,315], footprint:[[482,213],[522,213],[522,334],[548,334],[548,401],[482,401]], height:30, placeIds:[], aliases:["posgrado","salones de posgrado","edificio posgrado"], note:"Edificio 3 · Auditorio de Posgrado y salones distribuidos en dos plantas.", floors:{ "planta_baja":["Área administrativa de posgrado"], "planta_alta":["Área administrativa de posgrado"] } },
    { id:"administrativo", name:"Edificio Administrativo", short:"Adm", type:"Servicios", anchor:[365,482], footprint:[[322,420],[382,420],[382,500],[460,500],[460,484],[519,484],[519,505],[555,505],[555,457],[590,457],[590,555],[430,555],[430,526],[322,526]], height:30, placeIds:[], aliases:["administrativo","edificio administrativo"], note:"Conjunto central identificado como Administrativo. Las oficinas y entradas interiores requieren confirmación." },
    { id:"cancha", name:"Cancha de la facultad", short:"Cancha", type:"Deportivo", anchor:[653,490], footprint:rect(600,421,102,138), height:0, placeIds:[], aliases:[], note:"Cancha de la facultad, al oriente del conjunto central." },
    { id:"cafeteria", name:"Cafetería", short:"Café", type:"Servicios", anchor:[685,623], footprint:[[676,583],[702,583],[702,662],[667,662],[667,593],[676,593]], height:30, placeIds:["cafeteria"], aliases:["cafeteria","edificio cafeteria"], note:"Edificio identificado como Cafetería, al norte del extremo oriente del edificio B." },
    { id:"edificio-b", name:"Edificio B", short:"B", type:"Académico", anchor:[430,734], footprint:rect(177,705,507,58), height:30, placeIds:[], aliases:["b","edificio b"], note:"Bloque B con salones registrados.", floors:{ "planta_baja":["101","102","103","104","105","106","107","108","109","110","111","112","113","114","115"], "planta_alta":["401","402","403","404","405","406","407","408","409","410","411","412"] } },
    { id:"edificio-c", name:"Edificio C", short:"C", type:"Académico", anchor:[430,837], footprint:rect(171,813,515,47), height:30, placeIds:[], aliases:["c","edificio c"], note:"Bloque C con salones registrados.", floors:{ "planta_baja":["201","202","203","204","205","206","207","208","209","210","211","212","213"], "planta_alta":["301","302","303","304","305","306","307","308","309","310","311","312","313","314","315"] } },
    { id:"administracion-posgrado", name:"Área Administrativa de Posgrado", short:"Adm. Posgrado", type:"Posgrado", anchor:[576,280], footprint:rect(558,230,37,105), height:30, placeIds:[], aliases:["administracion de posgrado","area administrativa de posgrado"], note:"Junto al edificio 3. Sala A y Sala B en planta baja; área administrativa en planta alta." },
  ];
  const UNKNOWN = [
    { footprint:rect(465,587,79,76), height:30 },
    { footprint:rect(679,892,38,47), height:20 },
  ];
  for (const b of [...BUILDINGS, ...UNKNOWN]) {
    b.footprint.forEach(Object.freeze); Object.freeze(b.footprint);
    if (b.anchor) Object.freeze(b.anchor);
    if (b.placeIds) Object.freeze(b.placeIds);
    if (b.aliases) Object.freeze(b.aliases);
    Object.freeze(b);
  }
  Object.freeze(BUILDINGS); Object.freeze(UNKNOWN);
  const byId = (id) => BUILDINGS.find((b) => b.id === id) || null;
  function placesFor(id, places) {
    const b = byId(id);
    if (!b || !Array.isArray(places)) return [];
    return places.filter((p) => p && typeof p.id === "string" &&
      (b.placeIds.includes(p.id) || b.aliases.includes(norm(p.building))));
  }
  function searchBuildings(query, places) {
    const q = norm(query);
    return BUILDINGS.filter((b) => !q || norm(b.name + " " + b.type + " " + (FLOORS[b.id]?Object.values(FLOORS[b.id]).flat().join(" "):"")).includes(q) ||
      placesFor(b.id, places).some((p) => norm(p.name).includes(q)));
  }
  function camera(value = {}) {
    const number = (v, fallback, min, max) => Number.isFinite(v) ? Math.max(min,Math.min(max,v)) : fallback;
    return {
      mode:value.mode === "2d" ? "2d" : "3d",
      angle:number(value.angle,-22,-180,180), zoom:number(value.zoom,1,1,3),
      panX:number(value.panX,0,-900,900), panY:number(value.panY,0,-900,900),
    };
  }
  function project(point, height = 0, value = {}) {
    const c = camera(value);
    const a = (c.mode === "2d" ? 0 : c.angle) * Math.PI / 180;
    const x = point[0]-390, y = point[1]-480;
    return [x*Math.cos(a)-y*Math.sin(a),
      (x*Math.sin(a)+y*Math.cos(a))*(c.mode === "2d" ? 1 : 0.64)-(c.mode === "2d" ? 0 : height)];
  }
  function viewBox(value = {}) {
    const c = camera(value);
    const corners = rect(35,20,730,930).flatMap((p) => [project(p,0,c),project(p,45,c)]);
    const xs=corners.map((p)=>p[0]), ys=corners.map((p)=>p[1]);
    const left=Math.min(...xs)-42, top=Math.min(...ys)-42;
    const width=(Math.max(...xs)-left+42)/c.zoom, height=(Math.max(...ys)-top+42)/c.zoom;
    return [left+width*(c.zoom-1)/2+c.panX,top+height*(c.zoom-1)/2+c.panY,width,height];
  }
  const points = (poly,h,c) => poly.map((p)=>project(p,h,c).map((v)=>v.toFixed(2)).join(",")).join(" ");
  const polygon = (poly,h,c,cls) => '<polygon class="'+cls+'" points="'+points(poly,h,c)+'"/>';
  function volume(b,c,selected,floor) {
    const cls = b.id ? "cm-building"+(selected===b.id?" is-selected":"") : "cm-unknown";
    let sides = "";
    const screenPoly=(ps,cls)=>'<polygon class="'+cls+'" points="'+ps.map(p=>p.join(',')).join(' ')+'"/>';
    if (c.mode === "3d" && b.height) {
      const faces = b.footprint.map((p,i) => {
        const q = b.footprint[(i+1)%b.footprint.length];
        const at=(t,z)=>project([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t],z,c);
        const quad=(a,d,z,h,cls)=>screenPoly([at(a,z),at(d,z),at(d,h),at(a,h)],cls);
        const len=Math.hypot(q[0]-p[0],q[1]-p[1]);
        const front=at(1,0)[0]<at(0,0)[0];
        if(!front) return {depth:-Infinity,svg:''};
        let svg=quad(0,1,0,b.height,'cm-wall');
        svg+=quad(0,1,0,4,'cm-plinth')+quad(0,1,b.height-4,b.height,'cm-cornice');
        if(b.id) {
          const n=Math.max(1,Math.floor(len/23));
          for(let j=0;j<n;j++) {
            const t=(j+.5)/n, w=Math.min(.23,6/len);
            svg+=quad(t-w,t+w,11,b.height-9,'cm-window');
          }
          if(len>55) svg+=quad(.47,.53,0,17,'cm-door');
        }
        return {depth:(at(0,0)[1]+at(1,0)[1])/2,svg};
      });
      sides=faces.sort((a,b)=>a.depth-b.depth).map(f=>f.svg).join('');
    }
    let outline='';
    if(selected===b.id && b.height) {
      const ground=FLOORS[b.id] && floor!=="upper";
      if(ground && c.mode==='3d') {
        outline=b.footprint.map((p,i)=>{
          const q=b.footprint[(i+1)%b.footprint.length];
          return project(q,0,c)[0]<project(p,0,c)[0] ? '<polyline class="cm-floor-outline" points="'+points([p,q],0,c)+'"/>' : '';
        }).join('');
      } else outline=polygon(b.footprint,ground?0:b.height,c,'cm-floor-outline');
    }
    const rim=b.height?polygon(b.footprint,b.height,c,'cm-roof-rim'):'';
    return '<g class="'+cls+'"'+(b.id ? ' data-building="'+b.id+'" role="button" tabindex="0" aria-label="'+esc(b.name)+'" aria-pressed="'+(selected===b.id)+'"' : ' aria-hidden="true"')+'>'+
      (b.id ? '<title>'+esc(b.name)+'</title>' : '')+sides+
      polygon(b.footprint,b.height,c,b.height?"cm-roof":"cm-ground cm-"+b.id)+rim+outline+'</g>';
  }
  function line(poly,c,cls="cm-court-line") {
    return '<polyline class="'+cls+'" points="'+points(poly,0,c)+'"/>';
  }
  function circlePath(cx,cy,r,c) {
    return line(Array.from({length:37},(_,i)=>[cx+Math.cos(i*Math.PI/18)*r,cy+Math.sin(i*Math.PI/18)*r]),c);
  }
  // Cuatro coches especiales, dibujados en coordenadas del estacionamiento.
  function specialCar(x,y,kind,c) {
    const part=(poly,z,cls)=>polygon(poly.map(p=>[x+p[0],y+p[1]]),z,c,cls);
    const box=(a,b,w,h,z,cls)=>part(rect(a,b,w,h),z,cls);
    const beetle=kind==='beetle';
    let html='<g class="cm-special-car cm-special-'+kind+'"><title>'+({gold:'Superdeportivo dorado',silver:'Gran turismo plateado',black:'Superdeportivo negro',beetle:'Bochito rojo'}[kind])+'</title>';
    html+=box(4,0,7,3,1,'cm-tire')+box(23,0,7,3,1,'cm-tire')+box(4,12,7,3,1,'cm-tire')+box(23,12,7,3,1,'cm-tire');
    html+=part(beetle?[[1,5],[4,2],[10,1],[25,1],[31,4],[33,7],[31,11],[25,14],[10,14],[4,12],[1,9]]:[[0,4],[5,1],[28,1],[35,4],[35,11],[28,14],[5,14],[0,11]],3,'cm-special-body');
    html+=part(beetle?[[9,4],[13,2],[22,2],[26,5],[26,10],[22,13],[13,13],[9,10]]:[[12,3],[23,3],[27,5],[27,10],[23,12],[12,12],[9,10],[9,5]],5,'cm-special-glass');
    html+=box(14,3,7,9,6,'cm-special-body');
    html+=box(31,3,2,3,4,'cm-headlight')+box(31,10,2,3,4,'cm-headlight');
    html+=box(2,3,2,3,4,'cm-taillight')+box(2,10,2,3,4,'cm-taillight');
    if(!beetle) html+=box(4,0,2,15,5,'cm-spoiler');
    if(kind==='gold') html+=box(27,6,6,3,4,'cm-racing-stripe');
    return html+'</g>';
  }
  function scene(value = {}, selected = "", origin = "", floor = "ground") {
    const c=camera(value);
    const surfaces=polygon([[66,70],[112,40],[417,40],[417,197],[610,197],[730,410],[730,880],[150,880],[150,780],[66,780]],0,c,"cm-site")+
      polygon(rect(70,469,255,222),0,c,"cm-curb")+polygon(rect(76,475,243,210),0,c,"cm-parking");
    let parking='';
    for(let row=0;row<10;row++) {
      const y=485+row*19;
      for(const x of [83,174,267]) {
        parking+=line([[x,y],[x+43,y],[x+43,y+19]],c,'cm-parking-line');
        if(x===174 && row<4) {
          parking+=specialCar(x+4,y+2,['gold','silver','black','beetle'][row],c);
        } else if((row+x)%3!==0) {
          parking+=polygon(rect(x+6,y+4,29,11),2,c,'cm-car cm-car-'+row%3);
          parking+=polygon(rect(x+14,y+5,12,9),3,c,'cm-car-glass');
        }
      }
    }
    for(const x of [148,244]) parking+=line([[x,492],[x,669]],c,'cm-lane');
    const shadow=c.mode==='3d'?[...BUILDINGS,...UNKNOWN].filter(b=>b.height).map(b=>polygon(b.footprint.map(p=>[p[0]+12,p[1]+16]),0,c,'cm-shadow')).join(''):'';
    const objects=[...BUILDINGS,...UNKNOWN].sort((a,b)=>{
      const depth=(o)=>Math.max(...o.footprint.map((p)=>project(p,0,c)[1]));
      return depth(a)-depth(b);
    }).map((b)=>volume(b,c,selected,floor)).join("");
    const grass=Array.from({length:8},(_,i)=>polygon(rect(126,72+i*42,266,42),0,c,i%2?'cm-grass-dark':'cm-grass-light')).join('');
    const courts = grass+line([...rect(134,82,250,319),[134,82]],c)+line([[134,242],[384,242]],c)+circlePath(259,242,34,c)+
      line([[190,82],[190,132],[328,132],[328,82]],c)+line([[224,82],[224,102],[294,102],[294,82]],c)+
      line([[190,401],[190,351],[328,351],[328,401]],c)+line([[224,401],[224,381],[294,381],[294,401]],c)+
      line([...rect(238,74,42,8),[238,74]],c,'cm-goal')+line([...rect(238,401,42,8),[238,401]],c,'cm-goal')+
      polygon(rect(612,433,78,114),0,c,'cm-court-surface')+
      line([...rect(616,437,70,106),[616,437]],c)+line([[616,490],[686,490]],c)+circlePath(651,490,14,c)+
      line([[632,437],[632,457],[670,457],[670,437]],c)+line([[632,543],[632,523],[670,523],[670,543]],c);
    const labels=BUILDINGS.map((b,i)=>{
      const p=project(b.anchor,b.height+3,c);
      return '<g class="cm-label'+(selected===b.id?' is-selected':'')+'" transform="translate('+p.join(" ")+')" aria-hidden="true"><circle r="17"/><text y="5">'+(i+1)+'</text></g>';
    }).join("");
    const current=byId(origin);
    let marker="";
    if(current) {
      const p=project(current.anchor,current.height+3,c);
      marker='<g class="cm-location" transform="translate('+p.join(" ")+')" aria-label="Referencia manual: '+esc(current.name)+'"><circle class="cm-location-ring" r="24"/><path d="M0 -22v-28"/><rect x="-76" y="-76" width="152" height="27" rx="13"/><text y="-58">Estoy aquí · manual</text></g>';
    }
    const n=project([390,360],0,c), center=project([390,480],0,c);
    const angle=Math.atan2(n[1]-center[1],n[0]-center[0])*180/Math.PI+90;
    return '<svg class="cm-svg" xmlns="http://www.w3.org/2000/svg" viewBox="'+viewBox(c).join(" ")+'" role="group" aria-label="Mapa esquemático del campus. Selecciona un edificio o usa la lista." preserveAspectRatio="xMidYMid meet">'+
      '<desc>Contornos aproximados del plano de planta alta, conjunto oriente. Alturas simbólicas. No indica rutas ni posición GPS.</desc>'+
      '<g aria-hidden="true">'+surfaces+parking+shadow+'</g>'+objects+'<g class="cm-courts" aria-hidden="true">'+courts+'</g>'+labels+marker+'</svg>'+
      '<div class="cm-compass" aria-label="Norte del plano"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26"/><g transform="rotate('+angle+' 30 30)"><path d="M30 9l9 27-9-5-9 5z"/><text x="30" y="49">N</text></g></svg></div>';
  }
  const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>'Salón '+(a+i));
  const FLOORS={
    'edificio-b':{ground:range(101,115),upper:range(401,412)},
    'edificio-c':{ground:range(201,213),upper:range(301,315)},
    posgrado:{ground:['Auditorio de Posgrado','Salón 2','Salón 1'],upper:['Salón 5','Salón 6','Salón 7','Salón 8']},
    'administracion-posgrado':{ground:['Sala A','Sala B'],upper:['Área Administrativa de Posgrado']}
  };
  function originalFloorMarkup(id,floor='ground'){
    const rooms=FLOORS[id];
    floor=floor==='upper'?'upper':'ground';
    const names=rooms?rooms[floor]:[];
    return '<section class="cm-floors cm-interior"><h4>Recorrido en primera persona</h4>'+(rooms?'<div class="cm-floor-tabs">'+['ground','upper'].map(key=>'<button type="button" data-floor="'+key+'" aria-pressed="'+(floor===key)+'">'+(key==='ground'?'Planta baja':'Planta alta')+'</button>').join('')+'</div>':'')+'<canvas class="cm-walk" width="900" height="560" tabindex="0" aria-label="Recorrido interior. Flechas o WASD para caminar; arrastra para mirar."></canvas><div class="cm-walk-controls"><button type="button" data-walk="left" aria-label="Mirar a la izquierda">↶</button><button type="button" data-walk="forward">Avanzar</button><button type="button" data-walk="back">Retroceder</button><button type="button" data-walk="right" aria-label="Mirar a la derecha">↷</button><button type="button" data-walk="reset">Entrada</button></div><p class="cm-small">Arrastra para mirar alrededor. Usa los botones o las flechas / WASD para caminar.</p><div class="cm-walk-rooms">'+names.map(name=>'<button type="button" data-room="'+esc(name)+'">'+esc(name)+'</button>').join('')+'</div><p data-room-selection role="status">Entrada · '+esc(byId(id).name)+'</p><p class="cm-small">Recorrido ilustrativo: pasillos, puertas y distancias aproximados. No representa una ruta interior verificada.</p></section>';
  }
  function floorMarkup(id,floor='ground'){
    if(!['edificio-b','edificio-c','cafeteria'].includes(id))return originalFloorMarkup(id,floor);
    const rooms=FLOORS[id];
    floor=floor==='upper'?'upper':'ground';
    const names=rooms?rooms[floor]:[];
    return '<section class="cm-floors cm-interior"><h4>Recorrido en primera persona</h4>'+(rooms?'<div class="cm-floor-tabs">'+['ground','upper'].map(key=>'<button type="button" data-floor="'+key+'" aria-pressed="'+(floor===key)+'">'+(key==='ground'?'Planta baja':'Planta alta')+'</button>').join('')+'</div>':'')+'<canvas class="cm-walk" width="900" height="560" tabindex="0" aria-label="Recorrido al aire libre. Flechas o WASD para caminar; arrastra para mirar."></canvas><div class="cm-walk-controls"><button type="button" data-walk="left" aria-label="Mirar a la izquierda">↶</button><button type="button" data-walk="forward">Avanzar</button><button type="button" data-walk="back">Retroceder</button><button type="button" data-walk="right" aria-label="Mirar a la derecha">↷</button><button type="button" data-walk="strafe-left">Paso izquierdo</button><button type="button" data-walk="strafe-right">Paso derecho</button><button type="button" data-walk="turn">Dar la vuelta</button><button type="button" data-walk="reset">Entrada</button></div><p class="cm-small">Arrastra para mirar alrededor. Mantén pulsados los botones o W/S para caminar; A/D para moverte de lado y las flechas para girar. Usa Dar la vuelta para regresar. En ambos extremos hay conexiones B–C; las escaleras están junto a ellas.</p><div class="cm-walk-rooms">'+names.map(name=>'<button type="button" data-room="'+esc(name)+'">'+esc(name)+'</button>').join('')+'</div><p data-room-selection role="status">Entrada · '+esc(byId(id).name)+'</p><p class="cm-small">Recorre B, C, el patio y la cafetería. Las escaleras conectan ambas plantas. Los botones de salón te llevan al edificio y planta seleccionados. Recreación basada en los videos; distancias aproximadas.</p></section>';
  }
  function walkInterior(section,names,selectedId){
    if(!names.some(name=>/^Salón [1-4]\d{2}$/.test(name))&&selectedId!=='cafeteria')return walkOriginalInterior(section,names);
    const cafeStart=selectedId==='cafeteria';
    if(cafeStart)names=FLOORS['edificio-b'].ground;
    const canvas=section.querySelector('canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const length= 15*6+8;
    let x=0,z=2,yaw=0,pitch=0,drag=null;
    const surfaces=[], locations=[],obstacles=[];
    const quad=(points,color,label,material=0)=>surfaces.push({points:points.map(p=>[p[0]+offset,p[1],p[2]]),color,label,material});
    function box(x0,y0,z0,x1,y1,z1,color){
      quad([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],color);
      quad([[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],[x1,y0,z1]],color);
      quad([[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]],color);
      quad([[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],color);
      quad([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],'#bec1c1');
      quad([[x0,y0,z0],[x0,y0,z1],[x1,y0,z1],[x1,y0,z0]],'#e4e2da');
    }
    let upper=Number(names[0].split(' ').pop())>=300;
    let level=upper?3.8:0;
    const firstNumber=Number(names[0].split(' ').pop());
    const building=firstNumber<200||firstNumber>=400?'b':'c';
    x=cafeStart?14:building==='b'?0:32;
    if(cafeStart)z=110;
    const startX=x,startZ=z,startLevel=level;
    let offset=0;
    for(const block of ['b','c']){
    offset=block==='b'?0:32;
    const allFloors=FLOORS['edificio-'+block];
    // Un único bloque con dos corredores superpuestos. Fachada a la izquierda (+Z).
    for(let d=0;d<length;d+=6){

      for(const floorY of [0,3.8]){
        box(-8,floorY+.025,d,-2,floorY+3.5,d+6,'#b04d40');
        quad([[-1.99,floorY+.04,d],[-1.99,floorY+3.48,d],[-1.99,floorY+3.48,d+6],[-1.99,floorY+.04,d+6]],'#b45242',null,1);
        box(-1.92,floorY,d,-1.68,floorY+3.5,d+.24,'#e7e5de');
        box(-8.22,floorY,d,-8.02,floorY+3.5,d+.4,'#e7e5de');
        quad([[-8.025,floorY+1.65,d+1],[-8.025,floorY+2.85,d+1],[-8.025,floorY+2.85,d+4.5],[-8.025,floorY+1.65,d+4.5]],'#485c5c');
        box(-8.06,floorY+1.57,d+.95,-8.015,floorY+1.66,d+4.55,'#dadbd3');
        box(-2,floorY-.12,d,2,floorY,d+6,'#d8d6cf');
        quad([[-1.99,floorY+.006,d],[1.99,floorY+.006,d],[1.99,floorY+.006,d+6],[-1.99,floorY+.006,d+6]],'#d3cbc0',null,2);
        box(-.45,floorY+3.39,d+2,.15,floorY+3.46,d+3.4,'#f7f0d2');
        box(-8,floorY+3.5,d,2.3,floorY+3.7,d+6,'#ecece6');
        box(1.8,floorY,d,2.05,floorY+3.5,d+.25,'#f4f2e9');
        if(floorY>0)for(const h of [.35,.7,1.05])box(1.85,floorY+h,d,1.98,floorY+h+.10,d+6,'#faf9f2');
      }
    }
    for(const [floorKey,floorY] of [['ground',0],['upper',3.8]]){
      allFloors[floorKey].forEach((name,i)=>{
        const depth=5+i*6;
        quad([[-1.97,floorY,depth-1],[-1.97,floorY+2.6,depth-1],[-1.97,floorY+2.6,depth+.3],[-1.97,floorY,depth+.3]],'#614f43');
        quad([[-1.94,floorY+2.7,depth-1.3],[-1.94,floorY+3.15,depth-1.3],[-1.94,floorY+3.15,depth+.7],[-1.94,floorY+2.7,depth+.7]],'#fff',name);
        quad([[-1.95,floorY+2.05,depth+1],[-1.95,floorY+2.8,depth+1],[-1.95,floorY+2.8,depth+3.5],[-1.95,floorY+2.05,depth+3.5]],'#405961');
        box(-1.92,floorY+1.98,depth+1,-1.87,floorY+2.06,depth+3.5,'#dfe2df');
        for(const zz of [depth+1,depth+2.25,depth+3.5])box(-1.91,floorY+2.05,zz,-1.87,floorY+2.85,zz+.04,'#dadedd');
        if(block===building&&floorKey===(upper?'upper':'ground'))locations[i]={x:offset,z:depth-2,yaw:0};
      });
    }
    }
    offset=0;
    // Acceso de biblioteca y bebedero vistos en las referencias, sin reasignar salones.
    quad([[30.04,3.82,.6],[30.04,6.4,.6],[30.04,6.4,2.8],[30.04,3.82,2.8]],'#54706c');
    quad([[30.07,6.48,.4],[30.07,6.98,.4],[30.07,6.98,3],[30.07,6.48,3]],'#fff','Biblioteca');
    for(const dz of [.6,1.7,2.8])box(30.07,3.8,dz,30.12,6.4,dz+.05,'#dfe1da');
    box(30.04,3.8,12.3,30.19,4.75,12.9,'#b6bfbc');box(30.04,4.75,12.3,30.19,5.2,12.9,'#6593a6');
    for(const cx of [0,32])for(let d=0;d<98;d+=6)obstacles.push([cx+1.8,d,cx+2.05,d+.25]);
    // Patio observado en los videos: pavimento rojizo, jardines y mobiliario sin personas.
    quad([[-12,-.04,-12],[54,-.04,-12],[54,-.04,128],[-12,-.04,128]],'#73855e',null,4);
    const paving=(x0,z0,x1,z1,color='#ba8273')=>quad([[x0,-.018,z0],[x1,-.018,z0],[x1,-.018,z1],[x0,-.018,z1]],color,null,3);
    paving(2,0,9,98);paving(2,98,24,126);paving(30,0,38,98);
    function cylinder(cx,cy,cz,r,h,color,n=12){
      const top=[];
      for(let i=0;i<n;i++){
        const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
        const p=[cx+Math.cos(a)*r,cy,cz+Math.sin(a)*r],q=[cx+Math.cos(b)*r,cy,cz+Math.sin(b)*r];
        quad([p,q,[q[0],cy+h,q[2]],[p[0],cy+h,p[2]]],color);top.push([p[0],cy+h,p[2]]);
      }quad(top,color);
    }
    function crown(cx,cy,cz,rx,ry,rz,color){
      for(let j=0;j<5;j++)for(let i=0;i<10;i++){
        const point=(a,b)=>[cx+Math.sin(a)*Math.cos(b)*rx,cy+Math.cos(a)*ry,cz+Math.sin(a)*Math.sin(b)*rz];
        const a=j*Math.PI/5,b=i*Math.PI*2/10;
        quad([point(a,b),point(a+Math.PI/5,b),point(a+Math.PI/5,b+Math.PI/5),point(a,b+Math.PI/5)],color);
      }
    }
    function palm(cx,cz,h=5){
      cylinder(cx,0,cz,.16,h,'#8b7960');
      for(let j=0;j<9;j++){
        const angle=j*Math.PI*2/9;
        for(let k=0;k<7;k++){
          const r=k*.46,r2=(k+1)*.46;
          const y=h+.50*Math.sin(k*.5)-k*k*.035,y2=h+.50*Math.sin((k+1)*.5)-(k+1)*(k+1)*.035;
          const side=.22*Math.sin((k+1)*Math.PI/8),side2=.22*Math.sin((k+2)*Math.PI/9),c=Math.cos(angle),t=Math.sin(angle);
          quad([[cx+c*r-t*side,y,cz+t*r+c*side],[cx+c*r2-t*side2,y2,cz+t*r2+c*side2],[cx+c*r2+t*side2,y2,cz+t*r2-c*side2],[cx+c*r+t*side,y,cz+t*r-c*side]],j%2?'#4d713e':'#587c46');
          for(const sign of [-1,1])quad([[cx+c*r,y,cz+t*r],[cx+c*r-t*sign*.48,y-.15,cz+t*r+c*sign*.48],[cx+c*r2,y2,cz+t*r2]],'#5e7e43');
        }
      }
      obstacles.push([cx-.4,cz-.4,cx+.4,cz+.4]);
    }
    for(let d=14;d<95;d+=20){
      paving(9,d+5,24,d+8,'#d6bba6');
      box(10,0,d-3,15,.35,d+2,'#b96250');obstacles.push([10,d-3,15,d+2]);
      crown(12.5,.65,d-.5,2,.5,1.8,'#71874b');palm(12.5,d,5.3);
      cylinder(20,0,d+1,.24,3.8,'#82776a');crown(20,4.5,d+1,1.7,1.8,1.8,'#537448');
      for(let j=0;j<5;j++){const angle=j*1.256;crown(20+Math.cos(angle)*1.25,4.4+(j%2)*.6,d+1+Math.sin(angle)*1.25,1.1,1.3,1.2,j%2?'#587b49':'#4b6d40');}obstacles.push([19.5,d+.5,20.5,d+1.5]);
      box(18,.5,d+4,22,.65,d+5,'#78847e');box(18,.65,d+4,22,1.1,d+4.1,'#78847e');
      for(const bx of [18.15,21.7])box(bx,0,d+4,bx+.14,.5,d+5,'#4b5353');obstacles.push([18,d+4,22,d+5]);
      cylinder(7.8,0,d-4,.055,3.2,'#8a8c85',8);cylinder(7.8,3.2,d-4,.15,.7,'#f2ddaa',8);obstacles.push([7.65,d-4.15,7.95,d-3.85]);
    }
    // Fachada de cafetería, franja naranja/gris, acceso central y ventanillas.
    box(4,0,115,11.8,3.5,115.25,'#e0dfd5');box(15.4,0,115,24,3.5,115.25,'#e0dfd5');
    box(4,3.5,115,24,4,125,'#f2efdf');box(4,0,124.8,24,3.5,125,'#e0dfd5');
    box(4,0,115,4.25,3.5,125,'#dad8d1');box(23.75,0,115,24,3.5,125,'#dad8d1');
    box(4,3.4,114.9,24,3.8,115,'#575b59');box(4,3.8,114.85,24,4.3,115,'#cf6636');
    quad([[11,3.8,114.82],[17,3.8,114.82],[17,4.3,114.82],[11,4.3,114.82]],'#fff','Cafetería');
    for(const wx of [5.5,17.5]){
      box(wx,1.2,114.91,wx+4,2.8,114.98,'#435759');
      box(wx-.1,1.12,114.6,wx+4.1,1.22,115.05,'#b9bbb1');
      for(let t=0;t<5;t++)box(wx+t,1.2,114.86,wx+t+.045,2.8,114.90,'#dadfd7');
    }
    quad([[4.25,.01,115.3],[23.75,.01,115.3],[23.75,.01,124.8],[4.25,.01,124.8]],'#dad1c1',null,2);
    box(5,0,121.8,22,1.1,123,'#777c76');obstacles.push([5,121.8,22,123]);
    obstacles.push([4,115,11.8,115.3],[15.4,115,24,115.3],[4,115,4.25,125],[23.75,115,24,125],[4,124.8,24,125]);
    // Mesas circulares y velarias triangulares como en el video de cafetería.
    for(const [tx,tz] of [[7,103],[20,103]]){
      cylinder(tx,.78,tz,1.2,.12,'#747c75');cylinder(tx,0,tz,.13,3.7,'#505853');
      for(let j=0;j<3;j++){
        const angle=j*Math.PI*2/3;
        const bx=tx+Math.cos(angle)*1.65,bz=tz+Math.sin(angle)*1.65;
        cylinder(bx,.42,bz,.55,.12,'#747c75');cylinder(bx,0,bz,.06,.42,'#505853');
        quad([[tx,3.8,tz],[tx+Math.cos(angle)*3,3,tz+Math.sin(angle)*3],[tx+Math.cos(angle+2.094)*3,3,tz+Math.sin(angle+2.094)*3]],'#cbb991');
      }obstacles.push([tx-2,tz-2,tx+2,tz+2]);
    }
    for(const [tx,tz] of [[36,16],[36,56],[36,90],[26,114]])palm(tx,tz,5.7);
    for(const [tx,tz] of [[12.5,14],[12.5,34],[12.5,54],[36,16],[36,56]]){
      for(let j=0;j<18;j++){const angle=j*Math.PI/9;crown(tx+Math.cos(angle)*1.8,.10,tz+Math.sin(angle)*1.8,.16,.1,.12,'#e7e6d9');}
    }
    // Señalética sin alterar los rangos de salones de la aplicación.
    box(8.9,0,8,9.2,2.8,9.4,'#333d39');
    quad([[8.86,.4,8],[8.86,2.6,8],[8.86,2.6,9.4],[8.86,.4,9.4]],'#fff','GUÍA FIT');
    obstacles.push([8.85,8,9.25,9.4]);
    for(const [cx,col] of [[17,'#3d6e9c'],[18,'#c79942'],[19,'#52865a']]){box(cx,0,96,cx+.7,1.1,96.7,col);obstacles.push([cx,96,cx+.7,96.7]);}
    // Conexiones transversales en ambos extremos; escalera junto a cada conexión.
    for(const end of [0,104]){
      for(const y of [0,3.8]){
        box(-2,y-.16,end-6,34,y,end,'#ddd8cf');
        for(const railZ of (y>0?[end-.1,end-6]:[]))for(const h of [.4,.8,1.1]){
          box(2,y+h,railZ,28,y+h+.08,railZ+.08,'#f5f3e9');
        }
      }
      const stairZ=end===0?-10:104;
      // Dos tramos de doce peldaños y descanso, según la referencia de video.
      box(-2,-.15,stairZ,4,0,stairZ+4,'#d8d4cb');
      box(12.7,3.65,stairZ,34,3.8,stairZ+4,'#d8d4cb');
      box(7.6,1.75,stairZ,9.1,1.9,stairZ+4,'#d8d4cb');
      for(let i=0;i<24;i++){
        const run=i<12?4:9.1,xx=run+(i%12)*.3,h=(i+1)*3.8/24;
        box(xx,-.15,stairZ,xx+.3,h,stairZ+4,'#c5c5bf');
        // Banda antideslizante separada del peldaño; no hay caras coplanares.
        quad([[xx+.015,h+.005,stairZ+.1],[xx+.06,h+.005,stairZ+.1],[xx+.06,h+.005,stairZ+3.9],[xx+.015,h+.005,stairZ+3.9]],'#666b68');
        for(const zz of [stairZ,stairZ+4]){
          box(xx,h+.88,zz,xx+.3,h+.95,zz+.065,'#eeeade');
          if(i%4===0)box(xx,h,zz,xx+.06,h+.88,zz+.065,'#e0e1d7');
        }
      }
    }

    // GPU depth buffer: las losas ocultan la planta inferior y sus rótulos.
    const sceneCanvas=document.createElement('canvas');sceneCanvas.width=900;sceneCanvas.height=560;
    const gl=sceneCanvas.getContext('webgl',{alpha:false,antialias:true});
    let renderDepth=null;
    let releaseGraphics=()=>{};
    if(gl){
      try{
      const shader=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
      const program=gl.createProgram();
      const vertexSource='attribute vec3 pos;attribute vec2 uv;uniform vec3 eye;uniform float yaw;uniform float pitch;varying vec2 tex;varying vec3 world;varying float dist;void main(){vec3 d=pos-eye;float c=cos(yaw),s=sin(yaw);float z=d.x*s+d.z*c;float vy=d.y;float cp=cos(pitch),sp=sin(pitch);float depth=z*cp+vy*sp;vy=vy*cp-z*sp;gl_Position=vec4((d.x*c-d.z*s)*1.0666667,vy*1.7142857,1.002002*depth-0.4004004,depth);tex=uv;world=pos;dist=length(d);}';
      const fragmentSource='precision highp float;uniform vec4 color;uniform sampler2D label;uniform float textured;uniform float material;varying vec2 tex;varying vec3 world;varying float dist;void main(){vec3 col=color.rgb;if(textured>0.5){col=texture2D(label,tex).rgb;}else if(material>0.5){vec2 p=material<1.5?vec2(world.z*2.5+mod(floor(world.y*5.0),2.0)*0.5,world.y*5.0):world.xz*(material<2.5?1.65:2.8);vec2 f=fract(p);float edge=min(min(f.x,1.0-f.x),min(f.y,1.0-f.y));float fade=1.0-smoothstep(12.0,40.0,dist);float joint=1.0-smoothstep(0.015,0.04+dist*0.0015,edge);if(material<3.5){col=mix(col,col*0.64,joint*fade*0.55);}else{col*=0.97+0.03*sin(world.x*2.0)*sin(world.z*2.0);}}float fog=smoothstep(55.0,160.0,dist)*0.45;gl_FragColor=vec4(mix(col,vec3(0.76,0.82,0.82),fog),1.0);}';
      const precision=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
      const vs=shader(gl.VERTEX_SHADER,vertexSource),fs=shader(gl.FRAGMENT_SHADER,precision&&precision.precision>0?fragmentSource:fragmentSource.replace('precision highp float','precision mediump float'));
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      const groups=new Map(),textures=[];
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      surfaces.forEach(face=>{
        const aa=face.points[0],bb=face.points[1],cc=face.points[2];
        const ab=bb.map((n,i)=>n-aa[i]),ac=cc.map((n,i)=>n-aa[i]);
        const normal=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
        const norm=Math.hypot(...normal)||1,shade=.79+.21*Math.abs((normal[0]*.35+normal[1]*.86+normal[2]*.37)/norm);
        const hex=face.color.replace('#',''),colorHex=hex.length===3?hex.split('').map(c=>c+c).join(''):hex;
        const color=[0,2,4].map(i=>parseInt(colorHex.slice(i,i+2),16)/255*shade);
        const key=face.label||[face.color,face.material,shade.toFixed(2)].join(':');
        if(!groups.has(key)){
          let texture=null;
          if(face.label){
            const plate=document.createElement('canvas');plate.width=512;plate.height=128;const c=plate.getContext('2d');
            c.fillStyle='#f7f4e9';c.fillRect(0,0,512,128);c.fillStyle='#2c3534';c.font='bold 54px sans-serif';c.textAlign='center';c.fillText(face.label,256,84);
            texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,plate);
            gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
          }
          groups.set(key,{vertices:[],texture,color,material:face.material});
        }
        const batch=groups.get(key),axis=Math.abs(normal[0])>Math.abs(normal[2])?2:0;
        const u0=Math.min(...face.points.map(p=>p[axis])),u1=Math.max(...face.points.map(p=>p[axis]));
        const y0=Math.min(...face.points.map(p=>p[1])),y1=Math.max(...face.points.map(p=>p[1]));
        for(let i=1;i<face.points.length-1;i++)for(const j of [0,i,i+1]){const p=face.points[j];batch.vertices.push(...p,(p[axis]-u0)/(u1-u0||1),(p[1]-y0)/(y1-y0||1));}
      });
      const points=[],batches=[];
      groups.forEach(batch=>{batch.start=points.length/5;batch.count=batch.vertices.length/5;for(const n of batch.vertices)points.push(n);delete batch.vertices;batches.push(batch);});
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
      for(const [name,size,offset] of [['pos',3,0],['uv',2,12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,20,offset);}
      const uniforms=Object.fromEntries(['eye','yaw','pitch','color','textured','material'].map(n=>[n,gl.getUniformLocation(program,n)]));
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.clearColor(.70,.80,.84,1);gl.viewport(0,0,900,560);
      renderDepth=()=>{
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform3f(uniforms.eye,x,level+1.65,z);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,-pitch/280);
        for(const batch of batches){gl.uniform4f(uniforms.color,...batch.color,1);gl.uniform1f(uniforms.textured,batch.texture?1:0);gl.uniform1f(uniforms.material,batch.material);if(batch.texture)gl.bindTexture(gl.TEXTURE_2D,batch.texture);gl.drawArrays(gl.TRIANGLES,batch.start,batch.count);}
        ctx.drawImage(sceneCanvas,0,0);
      };
      releaseGraphics=()=>{textures.forEach(t=>gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();};
      sceneCanvas.addEventListener('webglcontextlost',()=>{renderDepth=null;if(canvas.isConnected)draw();});
      canvas.dataset.renderer='webgl-depth';
      }catch(error){canvas.dataset.renderer='unavailable';console.error('No se pudo iniciar el recorrido 3D',error);}
    }
    const view=([px,py,pz])=>{const dx=px-x,dz=pz-z;return [dx*Math.cos(yaw)-dz*Math.sin(yaw),py-level-1.65,dx*Math.sin(yaw)+dz*Math.cos(yaw)];};
    function draw(){
      if(renderDepth)renderDepth();
      else {ctx.fillStyle='#eaf1f5';ctx.fillRect(0,0,900,560);ctx.fillStyle='#263442';ctx.font='20px sans-serif';ctx.fillText('Activa la aceleración gráfica para ver el recorrido 3D.',30,260);}
      canvas.dataset.position=JSON.stringify({x,z,yaw,level});
      ctx.fillStyle='#ffffffdd';ctx.fillRect(720,12,168,135);
      ctx.fillStyle='#44663c';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText((level>0&&level<3.8)?'ESCALERA':(upper?'PLANTA ALTA':'PLANTA BAJA'),730,29);
      ctx.fillStyle='#b97478';ctx.fillRect(732,48,12,69);ctx.fillRect(828,48,12,69);ctx.fillRect(744,45,96,3);ctx.fillRect(744,117,96,3);ctx.fillRect(756,130,60,7);
      ctx.fillStyle='#343f36';ctx.font='11px sans-serif';ctx.fillText('B',732,42);ctx.fillText('C',828,42);ctx.fillText('Cafetería',762,129);
      ctx.fillStyle='#ff0000';ctx.beginPath();ctx.arc(744+x*3,42+(z+10)*.7,4,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ff0000';ctx.beginPath();ctx.moveTo(744+x*3,42+(z+10)*.7);ctx.lineTo(744+x*3+Math.sin(yaw)*10,42+(z+10)*.7+Math.cos(yaw)*10);ctx.stroke();
      ctx.fillStyle='#ffffffdd';ctx.fillRect(12,12,345,32);ctx.fillStyle='#243244';ctx.font='16px sans-serif';ctx.textAlign='left';
      const inCorridor=[0,32].some(cx=>Math.abs(x-cx)<1.7)&&z>=0&&z<=98;
      ctx.fillText(inCorridor?(Math.cos(yaw)>=0?'Menor → mayor · salones a la izquierda':'Mayor → menor · salones a la derecha'):(z>108?'Cafetería · patio de mesas':level>0&&level<3.8?'Escalera · continúa caminando':'Patio y conexiones B–C'),22,34);
    }
    function clearSelection(){section.querySelectorAll('[data-room]').forEach(b=>b.setAttribute('aria-pressed','false'));section.querySelector('[data-room-selection]').textContent='Recorrido conectado B–C · '+(level>0&&level<3.8?'Escalera':upper?'Planta alta':'Planta baja');}
    function heightAt(nx,nz){
      if(!Number.isFinite(nx)||!Number.isFinite(nz)||nx< -1.5||nx>37.6||nz< -9.6||nz>124.4)return null;
      if(level<.05&&obstacles.some(r=>nx>r[0]-.28&&nx<r[2]+.28&&nz>r[1]-.28&&nz<r[3]+.28))return null;
      if([0,32].some(cx=>nx>=cx-1.5&&nx<=cx+1.4)&&nz>=0&&nz<=98)return level<1.9?0:3.8;
      for(const end of [0,104]){
        if(nx>=-1.5&&nx<=33.4&&nz>=end-6&&nz<=end){if((z<end-6||z>end)&&nx>2&&nx<28&&level>3.6)return null;return level<1.9?0:3.8;}
        if(end===0?(nz>=-9.6&&nz< -6):(nz>104&&nz<=107.6)){
          if(z>=end-6&&z<=end&&nx>2&&nx<28&&level>3.6)return null;
          if(nx>=-1.5&&nx<=4)return 0;
          if(nx>4&&nx<7.6)return (nx-4)/3.6*1.9;
          if(nx>=7.6&&nx<=9.1)return 1.9;
          if(nx>9.1&&nx<12.7)return 1.9+(nx-9.1)/3.6*1.9;
          if(nx>=12.7&&nx<=33.4)return 3.8;
        }
      }
      if(level<.05){
        if(nx>=1.1&&nx<=23.4&&nz>=.4&&nz<=97.6)return 0;
        if(nx>=0&&nx<=3.5&&nz>=104&&nz<=114)return 0;
        if(nx>=2.4&&nx<=23.4&&nz>=108.1&&nz<=124.4)return 0;
        if(nx>=33.0&&nx<=37.6&&nz>=0&&nz<=104)return 0;
      }
      return null;
    }
    function step(nx,nz){const h=heightAt(nx,nz);if(h!==null&&Math.abs(h-level)<=.2){x=nx;z=nz;level=h;upper=level>=1.9;}}

    function move(action,amount=1){
      clearSelection();
      if(action==='turn')yaw+=Math.PI;
      if(action==='left')yaw-=.22*amount;if(action==='right')yaw+=.22*amount;
      if(action==='reset'){x=startX;level=startLevel;upper=level>0;z=startZ;yaw=0;pitch=0;}
      const forward=(action==='forward'?1:action==='back'?-1:0)*.75*amount;
      const side=(action==='strafe-right'?1:action==='strafe-left'?-1:0)*.75*amount;
      const nx=x+Math.sin(yaw)*forward+Math.cos(yaw)*side,nz=z+Math.cos(yaw)*forward-Math.sin(yaw)*side;
      const dx=nx-x,dz=nz-z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
      for(let i=0;i<steps;i++){step(x+dx/steps,z);step(x,z+dz/steps);}
      draw();
    }
    const held=new Set();let frame=0,last=0;
    function tick(time){
      if(!canvas.isConnected){held.clear();frame=0;return;}
      const dt=Math.min((time-last)/1000,.04);last=time;
      held.forEach(action=>move(action,dt*5));
      frame=held.size?requestAnimationFrame(tick):0;
    }
    function start(action){held.add(action);if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}}
    function stop(){held.clear();if(frame)cancelAnimationFrame(frame);frame=0;}
    section.querySelectorAll('[data-walk]').forEach(b=>{
      let pointerUsed=false;
      b.onclick=(e={detail:0})=>{if(e.detail===0||!pointerUsed)move(b.dataset.walk);pointerUsed=false;};
      b.onpointerdown=e=>{if(['reset','turn'].includes(b.dataset.walk))return;e.preventDefault();pointerUsed=true;b.setPointerCapture(e.pointerId);move(b.dataset.walk,.3);start(b.dataset.walk);};
      b.onpointerup=b.onpointercancel=b.onlostpointercapture=stop;
    });
    const keyAction=e=>({ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back',ArrowLeft:'left',a:'strafe-left',ArrowRight:'right',d:'strafe-right'})[e.key.toLowerCase()]||({ArrowUp:'forward',ArrowDown:'back',ArrowLeft:'left',ArrowRight:'right'})[e.key];
    canvas.onkeydown=e=>{const action=keyAction(e);if(action){e.preventDefault();e.stopPropagation();if(!e.repeat)move(action,.3);start(action);}};
    canvas.onkeyup=e=>{const action=keyAction(e);if(action){e.preventDefault();e.stopPropagation();held.delete(action);}};
    canvas.onblur=stop;
    canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});};
    canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.007;pitch=Math.max(-150,Math.min(150,pitch+(e.clientY-drag[1])*1.2));drag=[e.clientX,e.clientY];draw();};
    canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{drag=null;};
    section.querySelectorAll('[data-room]').forEach((b,i)=>b.addEventListener('click',()=>{stop();const place=locations[i];if(place){x=place.x;z=place.z;yaw=place.yaw;level=startLevel;upper=level>0;}pitch=0;draw();}));
    const pause=()=>{stop();drag=null;};
    window.addEventListener('blur',pause);document.addEventListener('visibilitychange',pause);
    draw();
    return ()=>{stop();window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',pause);renderDepth=null;releaseGraphics();};
  }

  function walkOriginalInterior(section,names){
    const canvas=section.querySelector('canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const length=Math.max(14,Math.ceil(names.length/2)*4+4);
    let x=0,z=1.8,yaw=0,pitch=0,drag=null;
    const surfaces=[];
    const quad=(points,color,label)=>surfaces.push({points,color,label});
    quad([[-3,0,0],[3,0,0],[3,0,length],[-3,0,length]],'#cbd5df');
    quad([[-3,3.5,0],[-3,3.5,length],[3,3.5,length],[3,3.5,0]],'#f6f4ed');
    quad([[-3,0,0],[-3,0,length],[-3,3.5,length],[-3,3.5,0]],'#eee6dc');
    quad([[3,0,length],[3,0,0],[3,3.5,0],[3,3.5,length]],'#e0e7ef');
    for(const depth of [0,length])quad([[-3,0,depth],[3,0,depth],[3,3.5,depth],[-3,3.5,depth]],'#b9c8d7');
    names.forEach((name,i)=>{const side=i%2?1:-1,depth=4+Math.floor(i/2)*4,wall=side*2.98;
      quad([[wall,0,depth-0.65],[wall,0,depth+0.65],[wall,2.5,depth+0.65],[wall,2.5,depth-0.65]],i%2?'#754838':'#8d5744');
      quad([[wall*.998,2.55,depth-.7],[wall*.998,2.55,depth+.7],[wall*.998,3,depth+.7],[wall*.998,3,depth-.7]],'#fff',name);
    });
    for(let d=2;d<length;d+=4)quad([[-.6,3.48,d],[.6,3.48,d],[.6,3.48,d+1],[-.6,3.48,d+1]],'#ffffff');
    const view=([px,py,pz])=>{const dx=px-x,dz=pz-z;return [dx*Math.cos(yaw)-dz*Math.sin(yaw),py-1.65,dx*Math.sin(yaw)+dz*Math.cos(yaw)];};
    function draw(){
      ctx.fillStyle='#e6edf3';ctx.fillRect(0,0,900,560);
      const faces=surfaces.map(f=>({...f,points:f.points.map(view)})).sort((a,b)=>b.points.reduce((n,p)=>n+p[2],0)-a.points.reduce((n,p)=>n+p[2],0));
      for(const face of faces){let clipped=[];const ps=face.points;for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],inside=a[2]>=.08,next=b[2]>=.08;if(inside)clipped.push(a);if(inside!==next){const t=(.08-a[2])/(b[2]-a[2]);clipped.push(a.map((v,j)=>v+(b[j]-v)*t));}}if(clipped.length<3)continue;
        const points=clipped.map(p=>[450+p[0]*480/p[2],280+pitch-p[1]*480/p[2]]);
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();ctx.strokeStyle='#718096';ctx.lineWidth=1;ctx.stroke();
        if(face.label&&ps.every(p=>p[2]>.2)){const center=ps.reduce((a,p)=>a.map((v,j)=>v+p[j]/4),[0,0,0]);ctx.fillStyle='#222';ctx.font='bold '+Math.max(10,Math.min(30,150/center[2]))+'px sans-serif';ctx.textAlign='center';ctx.fillText(face.label,450+center[0]*480/center[2],280+pitch-center[1]*480/center[2]);}
      }
      ctx.fillStyle='#ffffffdd';ctx.fillRect(12,12,225,32);ctx.fillStyle='#243244';ctx.font='16px sans-serif';ctx.textAlign='left';ctx.fillText('Pasillo · '+Math.round(z)+' m desde entrada',22,34);
    }
    function move(action){section.querySelectorAll("[data-room]").forEach(b=>b.setAttribute("aria-pressed","false"));section.querySelector("[data-room-selection]").textContent="Recorriendo el pasillo";if(action==='left')yaw-=.22;if(action==='right')yaw+=.22;if(action==='reset'){x=0;z=1.8;yaw=0;pitch=0;}if(action==='forward'||action==='back'){const step=action==='forward'?.75:-.75;x=Math.max(-2.4,Math.min(2.4,x+Math.sin(yaw)*step));z=Math.max(.6,Math.min(length-.6,z+Math.cos(yaw)*step));}draw();}
    section.querySelectorAll('[data-walk]').forEach(b=>b.onclick=()=>move(b.dataset.walk));
    canvas.onkeydown=e=>{const action={ArrowUp:'forward',w:'forward',ArrowDown:'back',s:'back',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'}[e.key];if(action){e.preventDefault();e.stopPropagation();move(action);}};
    canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});};
    canvas.onpointermove=e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.007;pitch=Math.max(-150,Math.min(150,pitch+(e.clientY-drag[1])*1.2));drag=[e.clientX,e.clientY];draw();};
    canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;};
    section.querySelectorAll('[data-room]').forEach((b,i)=>b.addEventListener('click',()=>{z=4+Math.floor(i/2)*4;x=0;yaw=i%2?Math.PI/2:-Math.PI/2;pitch=0;draw();}));
    draw();
  }

  function detailMarkup(id, places, origin, canOpen, floor='ground') {
    const b=byId(id);
    if(!b) return '<h3>Explora tu facultad</h3><p>Toca un edificio en el mapa o búscalo por su nombre.</p>';
    const related=placesFor(b.id,places);
    return '<p class="cm-kicker">'+esc(b.type)+'</p><h3>'+esc(b.name)+'</h3><p>'+esc(b.note)+'</p>'+floorMarkup(id,floor)+
      '<button type="button" class="cm-primary" data-action="origin" aria-pressed="'+(origin===b.id)+'">'+(origin===b.id?'Quitar mi referencia':'Estoy en este lugar')+'</button>'+
      '<p class="cm-small">La referencia la eliges tú; no se detecta tu ubicación.</p>'+
      (related.length ? '<h4>Fichas del directorio</h4><p class="cm-small">Asociación por edificio; ubicación interior por confirmar.</p><ul class="cm-places">'+related.map((p)=>
        '<li>'+(canOpen?'<button type="button" data-place="'+esc(p.id)+'">'+esc(p.name)+' <span aria-hidden="true">↗</span></button>':'<span>'+esc(p.name)+'</span>')+'</li>').join("")+'</ul>' :
        '<p class="cm-small">Aún no hay fichas del directorio vinculadas a este lugar.</p>');
  }
  function mount(host, options = {}) {
    if(!host || typeof host.querySelector !== "function") throw new TypeError("Se necesita un contenedor HTML.");
    const places=Array.isArray(options.places)?options.places:[];
    let c=camera(), selected="posgrado", floor="ground", origin="", query="", gesture=null, suppressClick=false;
    host.innerHTML='<section class="cm-campus" aria-label="Explorador del campus">'+
      '<div class="cm-heading"><div><p class="cm-kicker">Conoce tu facultad</p><h2>Explora el campus</h2><p>Encuentra un edificio y reconoce los espacios que lo rodean.</p></div><span class="cm-version">Basado en tu plano</span></div>'+
      '<div class="cm-toolbar"><div class="cm-modes" role="group" aria-label="Vista del mapa"><button type="button" data-mode="3d" aria-pressed="true">Vista 3D</button><button type="button" data-mode="2d" aria-pressed="false">Plano 2D</button></div>'+
      '<div class="cm-controls" role="group" aria-label="Controles del mapa"><button type="button" data-action="left" aria-label="Girar a la izquierda">↶</button><button type="button" data-action="right" aria-label="Girar a la derecha">↷</button><button type="button" data-action="out" aria-label="Alejar">−</button><span data-zoom>100%</span><button type="button" data-action="in" aria-label="Acercar">+</button><button type="button" data-action="reset">Restablecer</button></div></div>'+
      '<div class="cm-layout"><div class="cm-map-column"><div class="cm-viewport" data-scene tabindex="0" aria-label="Mapa. Usa las flechas para desplazarlo al acercar; más y menos cambian el zoom."></div>'+
      '<p class="cm-caption">Selecciona un número para ver el edificio. Acerca y arrastra para explorar.</p>'+
      '<div class="cm-legend"><span><i class="cm-dot cm-dot-selected"></i>Selección</span><span><i class="cm-dot cm-dot-building"></i>Edificio</span><span><i class="cm-dot cm-dot-sport"></i>Cancha</span><span><i class="cm-dot cm-dot-unknown"></i>Sin identificar</span></div>'+
      '<p class="cm-disclaimer">Esquema del plano de planta alta, conjunto oriente. Los contornos son aproximados y las alturas ilustrativas. Selecciona un edificio para abrir su recorrido interior ilustrativo.</p></div>'+
      '<aside class="cm-sidebar"><label class="cm-search-label">Buscar edificio o espacio<input type="search" data-search placeholder="Edificio B, cafetería…" maxlength="100" autocomplete="off"></label>'+
      '<div class="cm-list" data-list aria-label="Edificios del plano"></div><div class="cm-detail" data-detail></div></aside></div>'+
      '<div class="cm-bottom"><p data-location role="status">Puedes indicar en qué edificio estás desde su ficha.</p>'+
      (typeof options.onOriginal==="function"?'<button type="button" class="cm-link" data-action="original">Ver croquis anterior</button>':'')+
      '</div><div class="cm-sr-only" data-status role="status" aria-live="polite"></div></section>';
    const q=(s)=>host.querySelector(s), viewport=q("[data-scene]");
    function announce(message) { q("[data-status]").textContent=message; }
    function drawScene() {
      viewport.innerHTML=scene(c,selected,origin,floor);
      q("[data-zoom]").textContent=Math.round(c.zoom*100)+"%";
      host.querySelectorAll("[data-mode]").forEach((el)=>el.setAttribute("aria-pressed",String(el.dataset.mode===c.mode)));
      q('[data-action="left"]').disabled=c.mode==="2d";
      q('[data-action="right"]').disabled=c.mode==="2d";
      q('[data-action="out"]').disabled=c.zoom<=1;
      q('[data-action="in"]').disabled=c.zoom>=3;
      viewport.classList.toggle("is-zoomed",c.zoom>1);
    }
    function drawList() {
      const found=searchBuildings(query,places);
      q("[data-list]").innerHTML=found.length?found.map((b)=>
        '<button type="button" data-select="'+b.id+'" aria-pressed="'+(selected===b.id)+'"><span class="cm-number">'+(BUILDINGS.indexOf(b)+1)+'</span><span>'+esc(b.name)+'</span></button>').join(""):
        '<p class="cm-empty">No encontramos ese nombre en el plano. Prueba con el nombre del edificio.</p>';
    }
    let disposeWalk=null;
    function drawDetail() {
      disposeWalk?.();disposeWalk=null;
      q("[data-detail]").innerHTML=detailMarkup(selected,places,origin,typeof options.onDetails==="function",floor);
      disposeWalk=walkInterior(q("[data-detail]"),FLOORS[selected]?.[floor]||[],selected);
      q("[data-location]").textContent=origin?"Referencia indicada por ti: "+byId(origin).name+". No es una posición GPS.":"Puedes indicar en qué edificio estás desde su ficha.";
    }
    function choose(id,keyboard) {
      if(!byId(id)) return;
      host.classList.add("cm-walking"); selected=id; floor="ground"; drawScene(); drawList(); drawDetail(); q(".cm-interior")?.scrollIntoView({block:"center",behavior:"smooth"}); announce("Seleccionaste "+byId(id).name+".");
      if(keyboard) {
        const target=viewport.querySelector('[data-building="'+id+'"]');
        if(target) target.focus({preventScroll:true});
      }
    }
    host.querySelector(".cm-campus").addEventListener("input",(event)=>{
      if(event.target.matches('[data-interior-angle]'))q('.cm-interior-model').style.setProperty('--interior-angle',event.target.value+'deg');
      if(event.target.matches("[data-search]")) { query=event.target.value; drawList(); }
    });
    host.querySelector(".cm-campus").addEventListener("click",(event)=>{
      if(suppressClick) {
        suppressClick=false;
        if(viewport.contains(event.target)) return;
      }
      const target=event.target.closest("[data-building],[data-select],[data-action],[data-mode],[data-place],[data-floor],[data-room]");
      if(!target || !host.contains(target)) return;
      if(target.dataset.building || target.dataset.select) {
        const isKeyboard=event.detail===0;
        choose(target.dataset.building||target.dataset.select,isKeyboard && !!target.dataset.building);
        if(isKeyboard && target.dataset.select) q('[data-select="'+selected+'"]')?.focus({preventScroll:true});
        return;
      }
      if(target.dataset.place && typeof options.onDetails==="function") {
        const item=placesFor(selected,places).find((p)=>p.id===target.dataset.place);
        if(item) options.onDetails(item.id);
        return;
      }
      if(target.dataset.room){
        host.querySelectorAll('[data-room]').forEach(el=>el.setAttribute('aria-pressed',String(el===target)));
        q('[data-room-selection]').textContent=byId(selected).name+' · '+(floor==='upper'?'Planta alta':'Planta baja')+' · '+target.dataset.room;
        return;
      }
      if(target.dataset.floor){floor=target.dataset.floor==='upper'?'upper':'ground';drawDetail();drawScene();q('[data-floor="'+floor+'"]').focus({preventScroll:true});return;}
      if(target.dataset.mode) { c={...c,mode:target.dataset.mode,panX:0,panY:0}; drawScene(); return; }
      switch(target.dataset.action) {
        case "left": c.angle=c.angle<=-180?165:c.angle-15; break;
        case "right": c.angle=c.angle>=180?-165:c.angle+15; break;
        case "in": c.zoom=Math.min(3,c.zoom+0.25); break;
        case "out": c.zoom=Math.max(1,c.zoom-0.25); if(c.zoom===1) c.panX=c.panY=0; break;
        case "reset": c=camera(); break;
        case "origin":
          origin=origin===selected?"":selected; drawDetail(); drawScene();
          q('[data-action="origin"]').focus({preventScroll:true}); return;
        case "original": if(typeof options.onOriginal==="function") options.onOriginal(); return;
        default:return;
      }
      c=camera(c); drawScene();
    });
    viewport.addEventListener("keydown",(event)=>{
      const building=event.target.closest("[data-building]");
      if(building && (event.key==="Enter"||event.key===" ")) {
        event.preventDefault(); choose(building.dataset.building,true); return;
      }
      if(building) return;
      const moves={ArrowLeft:[-40,0],ArrowRight:[40,0],ArrowUp:[0,-40],ArrowDown:[0,40]};
      if(moves[event.key] && c.zoom>1) {
        event.preventDefault(); c=camera({...c,panX:c.panX+moves[event.key][0],panY:c.panY+moves[event.key][1]}); drawScene();
      } else if(event.key==="+" || event.key==="=" || event.key==="-") {
        event.preventDefault(); c.zoom=Math.max(1,Math.min(3,c.zoom+(event.key==="-"?-0.25:0.25)));
        if(c.zoom===1) c.panX=c.panY=0; drawScene();
      }
    });
    viewport.addEventListener("pointerdown",(event)=>{
      suppressClick=false;
      if(c.zoom<=1 || event.button!==0 || !event.isPrimary) return;
      const svg=viewport.querySelector("svg"), matrix=svg.getScreenCTM();
      if(!matrix) return;
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,panX:c.panX,panY:c.panY,scale:matrix.a,moved:false};
    });
    viewport.addEventListener("pointermove",(event)=>{
      if(!gesture || gesture.id!==event.pointerId) return;
      const dx=event.clientX-gesture.x, dy=event.clientY-gesture.y;
      if(!gesture.moved && Math.hypot(dx,dy)<6) return;
      if(!gesture.moved) { gesture.moved=true; viewport.setPointerCapture(event.pointerId); }
      c=camera({...c,panX:gesture.panX-dx/gesture.scale,panY:gesture.panY-dy/gesture.scale}); drawScene();
    });
    function endGesture(event) {
      if(!gesture || gesture.id!==event.pointerId) return;
      suppressClick=gesture.moved; gesture=null;
      if(viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    }
    viewport.addEventListener("pointerup",endGesture);
    viewport.addEventListener("pointercancel",endGesture);
    viewport.addEventListener("lostpointercapture",()=>{gesture=null;});
    drawScene(); drawList(); drawDetail();
    return { destroy() { disposeWalk?.();host.replaceChildren(); } };
  }
  return Object.freeze({ BUILDINGS, FLOORS, project, viewBox, camera, placesFor, searchBuildings, scene, floorMarkup, detailMarkup, mount });
});
