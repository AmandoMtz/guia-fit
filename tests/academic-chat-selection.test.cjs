const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('cambia entre chats vacíos, separa borradores y descarta respuestas anteriores',async()=>{
  let html='',form=null;
  const input=()=>({value:'',isConnected:true,focus(){}});
  const host={get innerHTML(){return html;},set innerHTML(value){html=value;form=value.includes('<form')?{elements:{text:input()},querySelector:()=>({disabled:false})}:null;},querySelector(selector){return selector==='#academic-message-form'?form:{scrollTop:0,scrollHeight:0};}};
  const document={activeElement:null,addEventListener(){},querySelector(selector){if(selector==='#academic-chat-main')return host;if(selector==='#academic-message-form')return form;if(selector==='#academic-message-form textarea')return form?.elements.text;return null;}};
  const sandbox={window:{},document,clearInterval,clearTimeout};
  let source=fs.readFileSync(path.join(__dirname,'../web/dist/js/academic-chat.js'),'utf8');
  source=source.replace('root.FIT_ACADEMIC_CHAT={','root.refreshAll=refreshAll;root.select=(c,id)=>{activeChat=id;return loadDetail(c,id);};root.FIT_ACADEMIC_CHAT={');
  vm.runInNewContext(source,sandbox);
  const sent=[];let pending=null;
  const c={state:{user:{id:'student',account_type:'student'},view:'messages'},esc:String,icon:()=>'',toast:message=>{throw Error(message);},client:{async request(url,method,body){
    if(url.endsWith('/messages')){sent.push({url,body});return {data:{}};}
    if(url==='/api/academic-chat/chats')return {data:{items:[]}};
    const id=url.split('/').pop();
    if(pending?.id===id)return new Promise(resolve=>{pending.resolve=resolve;});
    return {data:{id,counterpart_name:id==='a'?'Alejandro':'Andrea',messages:[]}};
  }}};
  await sandbox.window.select(c,'a');assert.match(html,/Alejandro/);
  form.elements.text.value='Borrador Alejandro';
  await sandbox.window.select(c,'b');assert.match(html,/Andrea/);assert.equal(form.elements.text.value,'');
  form.elements.text.value='Hola Andrea';
  await sandbox.window.select(c,'b');assert.equal(form.elements.text.value,'Hola Andrea');
  await form.onsubmit({preventDefault(){}});assert.equal(sent[0].url,'/api/academic-chat/chats/b/messages');
  await sandbox.window.select(c,'a');assert.match(html,/Alejandro/);
  pending={id:'b'};const old=sandbox.window.select(c,'b');assert.equal(form,null);
  await sandbox.window.select(c,'a');
  pending.resolve({data:{id:'b',counterpart_name:'Andrea',messages:[]}});await old;
  assert.match(html,/Alejandro/);
  const notices=[];c.toast=message=>notices.push(message);
  let refreshed=0;c.client.request=async url=>({data:url.endsWith('/chats')?{items:[]}:{id:'a',counterpart_name:'Alejandro actualizado',messages:[{id:'new',body:'Mensaje recibido',created_at:new Date().toISOString()}]}});
  sandbox.window.FIT_PRESENCE={badge:()=>'',refresh:async()=>{refreshed++;}};
  const button={disabled:false,textContent:'Actualizar',setAttribute(){},removeAttribute(){}};
  form.elements.text.value='Borrador sin enviar';
  await sandbox.window.refreshAll(c,button);
  assert.match(html,/Mensaje recibido/);assert.match(html,/Alejandro actualizado/);
  assert.equal(form.elements.text.value,'Borrador sin enviar');assert.equal(refreshed,1);
  assert.equal(button.disabled,false);assert.match(notices.pop(),/actualizados/);
  c.client.request=async()=>({error:{message:'Sin conexión'}});
  await sandbox.window.refreshAll(c,button);
  assert.equal(notices.pop(),'Sin conexión');assert.equal(button.disabled,false);
  assert.equal(form.elements.text.value,'Borrador sin enviar');
});
