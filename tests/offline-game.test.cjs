const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.join(__dirname, "../web/dist/js/offline-game.js"),
  "utf8",
);

function fakeCanvas() {
  const gradient = { addColorStop() {} };
  return {
    setTransform() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    fillRect() {},
    beginPath() {},
    roundRect() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    drawImage() {},
  };
}

test("Castor Runner aparece sin internet y abre con toque o teclado", () => {
  const dom = new JSDOM('<main id="view"></main>', {
    url: "https://fit.example.test",
    runScripts: "outside-only",
  });
  const w = dom.window;
  Object.defineProperty(w.navigator, "onLine", { configurable: true, value: false });
  const transforms = [];
  const drawing = fakeCanvas();
  drawing.setTransform = (...args) => transforms.push(args);
  w.HTMLCanvasElement.prototype.getContext = () => drawing;
  let viewport = { width: 390, height: 650 };
  w.HTMLElement.prototype.getBoundingClientRect = () => viewport;
  w.requestAnimationFrame = () => 1;
  w.cancelAnimationFrame = () => {};
  w.eval(source);

  const c = {
    state: { user: { id: "teacher", account_type: "teacher", email: "docente@uat.edu.mx" } },
    toast() {},
    $: (selector) => w.document.querySelector(selector),
  };
  w.FIT_OFFLINE_GAME.mount(c);
  const launcher = w.document.querySelector(".offline-game-launcher");
  assert.ok(launcher);
  assert.match(launcher.textContent, /Jugar Castor Runner/);

  launcher.click();
  const overlay = w.document.querySelector(".offline-game-overlay");
  assert.equal(overlay.hidden, false);
  assert.match(overlay.textContent, /Doble salto disponible/);
  overlay.querySelector("[data-play]").click();
  assert.equal(overlay.querySelector("[data-panel]").hidden, true);
  for (const size of [{width:390,height:650},{width:844,height:290},{width:1920,height:960}]) {
    viewport = size;
    w.dispatchEvent(new w.Event("resize"));
    const canvas = overlay.querySelector("canvas");
    assert.equal(canvas.width, size.width);
    assert.equal(canvas.height, size.height);
    const transform = transforms.at(-1);
    assert.equal(transform[0], transform[3], "escala uniforme, sin deformar el personaje");
    assert.ok(Number.isFinite(transform[0]) && transform[0] > 0);
  }
  assert.ok(overlay.querySelector("[data-fullscreen]"));
  w.dispatchEvent(new w.KeyboardEvent("keydown", { code: "Space" }));
  overlay.querySelector("[data-close]").click();
  assert.equal(w.document.body.classList.contains("offline-game-open"), false);
  dom.window.close();
});

test("el modo offline incorpora juego, estilos y archivos en la caché", () => {
  const app = fs.readFileSync(path.join(__dirname, "../web/dist/js/app.js"), "utf8");
  const index = fs.readFileSync(path.join(__dirname, "../web/dist/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(__dirname, "../web/dist/sw.js"), "utf8");
  const standalone = fs.readFileSync(path.join(__dirname, "../web/dist/juego-castor.html"), "utf8");
  const standaloneScript = fs.readFileSync(path.join(__dirname, "../web/dist/js/offline-game-page.js"), "utf8");

  assert.match(app, /\["game", "star", "Castor Runner"\]/);
  assert.match(app, /FIT_OFFLINE_GAME\.render/);
  assert.match(index, /offline-game\.css/);
  assert.match(index, /offline-game\.js/);
  assert.match(worker, /offline-game\.css/);
  assert.match(worker, /offline-game\.js/);
  assert.match(worker, /juego-castor\.html/);
  assert.match(standalone, /offline-game-page\.js/);
  assert.doesNotMatch(standalone, /<script>\s*window\./);
  assert.match(standaloneScript, /FIT_OFFLINE_GAME\.render/);
});
