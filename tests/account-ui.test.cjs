const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const {JSDOM}=require('jsdom');
test('Registro: nombres y apellidos, sin opciones retiradas; offline abre solo la cuenta guardada',async t=>{
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://fit.example.test',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.scrollTo=()=>{};
 const read=n=>fs.readFileSync(path.join(__dirname,'../web/dist/js',n),'utf8');w.eval(read('core.js'));w.eval(read('catalog.js'));w.eval(read('offline.js'));w.FIT_CONFIG={};let signup;
 w.FIT_CLIENT=class{constructor(){this.auth={getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{},signUp:async value=>{signup=value;return {data:{}}}};}async request(){return {data:{enabled:true}}}async processLink(){return null}};
 w.eval(read('app.js'));await new Promise(r=>setImmediate(r));
 w.document.querySelector('[data-mode="register"]').click();assert.ok(w.document.querySelector('[name=first_name]'));assert.ok(w.document.querySelector('[name=last_name]'));assert.ok(!w.document.querySelector('[name=seller]'));assert.ok(!w.document.querySelector('.teacher-register-hint'));
 for(const [name,value] of Object.entries({first_name:'María Elena',last_name:'García López',email:'maria@docentes.uat.edu.mx',password:'Prueba123!',confirm:'Prueba123!'}))w.document.querySelector('[name='+name+']').value=value;
 w.document.querySelector('#auth-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));assert.equal(signup.options.data.full_name,'María Elena García López');assert.equal(signup.email,'maria@docentes.uat.edu.mx');
});
test('Sin internet: abre horario guardado de alumno sin autenticar ni conceder admin',async t=>{
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div>',{url:'https://fit.example.test',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.scrollTo=()=>{};
 for(const n of ['core.js','catalog.js','offline.js'])w.eval(fs.readFileSync(path.join(__dirname,'../web/dist/js',n),'utf8'));
 w.FIT_CONFIG={};w.FIT_CLIENT=class{};Object.defineProperty(w.navigator,'onLine',{value:false});
 w.FIT_OFFLINE.saveSession({user:{id:'student-1',email:'a2213332179@alumnos.uat.edu.mx',account_type:'student'},profile:{full_name:'Alumno Apellidos'}});
 w.FIT_OFFLINE.saveSchedule('student-1',{userId:'student-1',classes:[{subject:'Matemáticas'}]});
 let state;w.FIT_SCHEDULE={render:c=>{state=c.state;w.document.querySelector('#view').textContent=w.FIT_OFFLINE.getSchedule(c.state.user.id).schedule.classes[0].subject}};
 w.eval(fs.readFileSync(path.join(__dirname,'../web/dist/js/app.js'),'utf8'));
 w.document.querySelector('#offline-login').click();assert.equal(state.offline,true);assert.equal(state.admin,false);assert.equal(w.document.querySelector('#view').textContent,'Matemáticas');
 w.document.querySelector('#logout').click();await new Promise(r=>setImmediate(r));assert.equal(w.FIT_OFFLINE.getSession().user.id,'student-1');assert.ok(w.document.querySelector('#offline-login'));
});
