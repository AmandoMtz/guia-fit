"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const worker=fs.readFileSync(path.join(__dirname,"../web/dist/sw.js"),"utf8");
function harness() {
  const handlers={}, saved=new Map(); let offline=false;
  const caches={
    open:async()=>({put:async(key,response)=>saved.set(key,response)}),
    match:async(key)=>saved.get(key),
  };
  const self={location:{origin:"https://campus.test"},addEventListener:(name,fn)=>{handlers[name]=fn;}};
  vm.runInNewContext(worker,{self,caches,URL,importScripts:(url)=>assert.equal(url,"/push-worker.js?v=3"),fetch:async(req)=>{
    if(offline) throw new Error("offline");
    return {ok:true,body:typeof req==="string"?req:req.url,clone(){return {...this};}};
  }});
  async function navigate(pathname) {
    const pending=[]; let response;
    handlers.fetch({
      request:{method:"GET",mode:"navigate",url:"https://campus.test"+pathname},
      respondWith:(promise)=>{response=promise;},
      waitUntil:(promise)=>pending.push(promise),
    });
    const result=await response;
    await Promise.all(pending);
    return result;
  }
  return {navigate,saved,goOffline:()=>{offline=true;}};
}
test("campus demo navigation keeps the main offline shell separate",async()=>{
  const h=harness();
  await h.navigate("/");
  const main=h.saved.get("/index.html").body;
  await h.navigate("/mapa-campus-demo.html");
  assert.equal(h.saved.get("/index.html").body,main);
  assert.match(h.saved.get("/mapa-campus-demo.html").body,/mapa-campus-demo/);
  h.goOffline();
  assert.equal((await h.navigate("/")).body,main);
  assert.match((await h.navigate("/mapa-campus-demo.html")).body,/mapa-campus-demo/);
});
test("unknown navigation pages do not overwrite the main shell",async()=>{
  const h=harness();
  await h.navigate("/");
  const main=h.saved.get("/index.html").body;
  await h.navigate("/not-in-the-shell");
  assert.equal(h.saved.has("/not-in-the-shell"),false);
  assert.equal(h.saved.get("/index.html").body,main);
});
