"use strict";
// Ejecuta un navegador real sobre archivos locales; nunca usa la base de datos.
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../web/dist");
const types = { ".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".png":"image/png" };
const server = http.createServer((req,res) => {
  try {
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const filename=path.resolve(root,"."+pathname);
    if(!filename.startsWith(root+path.sep) || !fs.statSync(filename).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type",types[path.extname(filename)]||"application/octet-stream");
    fs.createReadStream(filename).pipe(res);
  } catch { res.writeHead(404).end(); }
});
(async () => {
  await new Promise((resolve)=>server.listen(0,"127.0.0.1",resolve));
  const browser=await chromium.launch();
  const url="http://127.0.0.1:"+server.address().port+"/mapa-campus-demo.html";
  const output=path.resolve(__dirname,"../map-browser-results");
  fs.mkdirSync(output,{recursive:true});
  try {
    for(const viewport of [{width:1365,height:1024},{width:390,height:844}]) {
      const context=await browser.newContext({viewport,reducedMotion:"reduce",hasTouch:viewport.width<500});
      const page=await context.newPage();
      const errors=[];
      page.on("pageerror",(err)=>errors.push(err.message));
      await page.goto(url);
      await page.locator(".cm-svg").waitFor();
      assert.equal(await page.locator("[data-select]").count(),9);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,"horizontal overflow");
      assert.equal(await page.locator(".cm-viewport").evaluate((el)=>getComputedStyle(el).backgroundColor),"rgb(255, 255, 255)");
      await page.locator("[data-search]").fill("cafeteria");
      assert.equal(await page.locator("[data-select]").count(),1);
      await page.locator('[data-select="cafeteria"]').click();
      assert.equal(await page.locator("[data-detail] h3").textContent(),"Cafetería");
      await page.locator('[data-action="origin"]').click();
      assert.match(await page.locator("[data-location]").textContent(),/indicada por ti: Cafetería/);
      assert.equal(await page.locator(".cm-location").count(),1);
      assert.equal(await page.locator(".cm-location-ring").evaluate((el)=>getComputedStyle(el).animationName),"none");
      await page.locator('[data-mode="2d"]').click();
      assert.equal(await page.locator(".cm-wall").count(),0);
      assert.equal(await page.locator('[data-action="left"]').isDisabled(),true);
      await page.locator('[data-mode="3d"]').click();
      assert.ok(await page.locator(".cm-wall").count()>0);
      await page.locator("[data-search]").fill("");
      const building=page.locator('[data-building="edificio-c"]');
      await building.focus();
      await page.keyboard.press("Enter");
      assert.equal(await page.locator("[data-detail] h3").textContent(),"Edificio C");
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.building),"edificio-c");
      await page.locator('[data-action="in"]').click();
      assert.equal(await page.locator("[data-zoom]").textContent(),"125%");
      const before=await page.locator(".cm-svg").getAttribute("viewBox");
      await page.locator("[data-scene]").focus();
      await page.keyboard.press("ArrowRight");
      assert.notEqual(await page.locator(".cm-svg").getAttribute("viewBox"),before);
      const box=await page.locator("[data-scene]").boundingBox();
      const dragBefore=await page.locator(".cm-svg").getAttribute("viewBox");
      if(viewport.width<500) {
        const client=await context.newCDPSession(page);
        await client.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:box.x+35,y:box.y+35}]});
        await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+65,y:box.y+50}]});
        await client.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:box.x+85,y:box.y+60}]});
        await client.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        await client.detach();
      } else {
        await page.mouse.move(box.x+35,box.y+35);
        await page.mouse.down();
        await page.mouse.move(box.x+85,box.y+60,{steps:5});
        await page.mouse.up();
      }
      assert.notEqual(await page.locator(".cm-svg").getAttribute("viewBox"),dragBefore);
      await page.locator('[data-action="reset"]').click();
      assert.equal(await page.locator("[data-zoom]").textContent(),"100%");
      await page.locator('[data-select="posgrado"]').click();
      assert.match(await page.locator('.cm-room-plan').textContent(),/Auditorio de Posgrado.*Salón 2.*Salón 1/);
      await page.locator('[data-floor="upper"]').click();
      assert.match(await page.locator('.cm-room-plan').textContent(),/Salón 5.*Salón 6.*Salón 7.*Salón 8/);
      assert.equal(await page.locator('.cm-room-plan').evaluate(el=>getComputedStyle(el).flexDirection),'row-reverse');
      await page.locator('[data-select="administracion-posgrado"]').click();
      assert.match(await page.locator('.cm-room-plan').textContent(),/Sala A.*Sala B/);
      await page.locator('[data-floor="upper"]').click();
      assert.match(await page.locator('.cm-room-plan').textContent(),/Área Administrativa de Posgrado/);
      // Render again after a real drag to ensure the first next control click works.
      await page.locator('[data-select="edificio-b"]').click();
      await page.locator('[data-action="origin"]').click();
      await page.screenshot({path:path.join(output,"campus-"+viewport.width+".png"),fullPage:true});
      assert.deepEqual(errors,[]);
      console.log("Mapa: selección, búsqueda, 2D/3D, referencia, zoom, teclado, arrastre y diseño "+viewport.width+"px: OK");
      await context.close();
    }
  } finally {
    await browser.close();
    await new Promise((resolve)=>server.close(resolve));
  }
})().catch((err)=>{ console.error(err); server.close(); process.exitCode=1; });
