/* Castor Runner: minijuego local disponible sin conexión. No otorga recompensas del servidor. */
(function (root) {
  "use strict";

  const BEST_KEY = "fit-castor-runner-best-v1";
  const PLAYER_IMAGE = "/assets/guia-fit-mascota.png";
  let context = null;
  let overlay = null;
  let launcher = null;
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let lastTime = 0;
  let worldWidth = 960, worldHeight = 430;
  let resizeObserver;
  let audio = null;
  let muted = false;
  let listenersReady = false;
  let state = freshState();
  const mascot = new Image();
  mascot.src = PLAYER_IMAGE;

  function freshState() {
    return {
      phase: "ready",
      elapsed: 0,
      distance: 0,
      bonus: 0,
      score: 0,
      speed: 305,
      nextObstacle: 1.2,
      nextCollectible: 1.7,
      flash: 0,
      shake: 0,
      milestone: 0,
      player: { x: 112, y: 268, w: 76, h: 82, vy: 0, jumps: 0, tilt: 0 },
      obstacles: [],
      collectibles: [],
      particles: [],
      clouds: [
        { x: 80, y: 58, scale: 0.8 },
        { x: 420, y: 92, scale: 1.1 },
        { x: 780, y: 45, scale: 0.65 },
      ],
    };
  }

  function bestScore() {
    try {
      return Math.max(0, Number(localStorage.getItem(BEST_KEY) || 0));
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(Math.max(bestScore(), value)));
    } catch {}
  }

  function icon(path) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
  }

  function makeOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "offline-game-overlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="offline-game-shell" role="dialog" aria-modal="true" aria-labelledby="runner-title">
        <header class="offline-game-head">
          <div class="offline-game-brand">
            <span class="offline-game-logo"><img src="${PLAYER_IMAGE}" alt=""></span>
            <div><span>MINIJUEGO SIN CONEXIÓN</span><h2 id="runner-title">Castor Runner</h2></div>
          </div>
          <div class="offline-game-head-actions">
            <span class="offline-network-chip" data-network><i></i><span>Sin internet</span></span>
            <button class="offline-icon-button" type="button" data-sound aria-label="Desactivar sonido" title="Sonido">${icon("M5 9v6h4l5 4V5L9 9H5zm12 1a3 3 0 010 4m2-7a7 7 0 010 10")}</button>
            <button class="offline-icon-button" type="button" data-fullscreen aria-label="Pantalla completa" title="Pantalla completa">⛶</button>
            <button class="offline-icon-button" type="button" data-close aria-label="Cerrar juego" title="Cerrar">${icon("M6 6l12 12M18 6 6 18")}</button>
          </div>
        </header>
        <div class="offline-game-stage">
          <div class="offline-game-hud" aria-live="polite">
            <div><span>PUNTOS</span><strong data-score>0000</strong></div>
            <div><span>RÉCORD</span><strong data-best>${String(bestScore()).padStart(4, "0")}</strong></div>
            <div class="offline-speed"><span>RITMO</span><strong data-speed>1×</strong></div>
          </div>
          <canvas class="offline-game-canvas" width="960" height="430" tabindex="0" aria-label="Castor Runner. Pulsa espacio, flecha arriba o toca la pantalla para saltar."></canvas>
          <div class="offline-game-panel" data-panel>
            <span class="offline-game-kicker">UNA CARRERA POR LA FIT</span>
            <h3 data-panel-title>¡Que no te agarre el aburrimiento!</h3>
            <p data-panel-copy>Ayuda al Castor FIT a saltar libros, mochilas y conos. Recoge estrellas para aumentar tu puntuación.</p>
            <div class="offline-game-record" data-result hidden></div>
            <button class="offline-game-play" type="button" data-play>${icon("M8 5l11 7-11 7V5z")} <span>Comenzar carrera</span></button>
            <small>Doble salto disponible · Tu récord se guarda solamente en este dispositivo</small>
          </div>
        </div>
        <footer class="offline-game-controls">
          <div><kbd>ESPACIO</kbd><kbd>↑</kbd><span>o toca el juego para saltar</span></div>
          <div class="offline-game-actions">
            <button type="button" data-reconnect>${icon("M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0114 6M18 18A8 8 0 014 12")} Revisar conexión</button>
            <span>Sin premios oficiales: juega solo por diversión</span>
          </div>
        </footer>
      </section>`;
    document.body.append(overlay);
    canvas = overlay.querySelector("canvas");
    ctx = canvas.getContext("2d", { alpha: false });
    overlay.querySelector("[data-close]").onclick = close;
    overlay.querySelector("[data-play]").onclick = start;
    overlay.querySelector("[data-sound]").onclick = toggleSound;
    overlay.querySelector("[data-reconnect]").onclick = reconnect;
    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (state.phase === "running") jump();
      else if (state.phase === "over") start();
    });
    overlay.querySelector('[data-fullscreen]').onclick = async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await overlay.requestFullscreen?.();
      } catch {}
      resize();
    };
    if (root.ResizeObserver) {
      resizeObserver = new root.ResizeObserver(resize);
      resizeObserver.observe(overlay.querySelector('.offline-game-stage'));
    }
    updateNetwork();
    draw();
    return overlay;
  }

  function open() {
    makeOverlay();
    overlay.hidden = false;
    document.body.classList.add("offline-game-open");
    resetReady();
    updateLauncher();
    requestAnimationFrame(() => overlay.classList.add("visible"));
    overlay.querySelector("[data-play]").focus();
  }

  function close() {
    if (!overlay) return;
    if (document.fullscreenElement === overlay) document.exitFullscreen?.().catch(() => {});
    cancelAnimationFrame(raf);
    raf = 0;
    state.phase = "ready";
    overlay.classList.remove("visible");
    document.body.classList.remove("offline-game-open");
    setTimeout(() => {
      if (overlay && !overlay.classList.contains("visible")) overlay.hidden = true;
      updateLauncher();
    }, 220);
  }

  function resetReady() {
    cancelAnimationFrame(raf);
    raf = 0;
    state = freshState();
    resize();
    const panel = overlay.querySelector("[data-panel]");
    panel.hidden = false;
    panel.classList.remove("game-over");
    state.player.y = groundY() - state.player.h;
    overlay.querySelector("[data-panel-title]").textContent = "¡Que no te agarre el aburrimiento!";
    overlay.querySelector("[data-panel-copy]").textContent =
      "Ayuda al Castor FIT a saltar libros, mochilas y conos. Recoge estrellas para aumentar tu puntuación.";
    overlay.querySelector("[data-result]").hidden = true;
    overlay.querySelector("[data-play] span").textContent = "Comenzar carrera";
    updateHud();
    draw();
  }

  function start() {
    initAudio();
    state = freshState();
    resize();
    state.phase = "running";
    state.player.y = groundY() - state.player.h;
    overlay.querySelector("[data-panel]").hidden = true;
    lastTime = performance.now();
    canvas.focus({ preventScroll: true });
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function endGame() {
    if (state.phase !== "running") return;
    state.phase = "over";
    state.shake = 0.5;
    sound("crash");
    burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, "#ff4d5d", 18);
    saveBest(state.score);
    updateHud();
    const panel = overlay.querySelector("[data-panel]");
    panel.hidden = false;
    panel.classList.add("game-over");
    overlay.querySelector("[data-panel-title]").textContent = "¡Buena carrera!";
    overlay.querySelector("[data-panel-copy]").textContent =
      state.score >= bestScore() && state.score > 0
        ? "Lograste tu mejor recorrido. ¿Puedes superarlo otra vez?"
        : "El Castor está listo para volver a intentarlo.";
    const result = overlay.querySelector("[data-result]");
    result.hidden = false;
    result.innerHTML = `<div><span>Tu puntuación</span><strong>${state.score}</strong></div><div><span>Estrellas</span><strong>${Math.floor(state.bonus / 35)}</strong></div>`;
    overlay.querySelector("[data-play] span").textContent = "Jugar otra vez";
    overlay.querySelector("[data-play]").focus({ preventScroll: true });
  }

  function groundY() {
    return worldHeight - 80;
  }

  function jump() {
    if (state.phase !== "running" || state.player.jumps >= 2) return;
    state.player.vy = state.player.jumps === 0 ? -690 : -610;
    state.player.jumps += 1;
    state.player.tilt = -0.15;
    sound(state.player.jumps === 1 ? "jump" : "double");
    burst(state.player.x + 30, groundY() - 5, "#fff3bd", 7);
  }

  function spawnObstacle() {
    const difficulty = Math.min(1, state.elapsed / 50);
    const options = [
      { type: "cone", w: 38, h: 58 },
      { type: "books", w: 54, h: 45 },
      { type: "backpack", w: 51, h: 62 },
      ...(difficulty > 0.35 ? [{ type: "puddle", w: 76, h: 20 }] : []),
    ];
    const item = options[Math.floor(Math.random() * options.length)];
    state.obstacles.push({ ...item, x: worldWidth + 40 + Math.random() * 80, y: groundY() - item.h });
  }

  function spawnCollectible() {
    const high = Math.random() > 0.55;
    state.collectibles.push({
      x: worldWidth + 40,
      y: groundY() - (high ? 145 : 92),
      r: 15,
      spin: Math.random() * Math.PI,
      taken: false,
    });
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      state.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -60 - Math.random() * 260,
        life: 0.45 + Math.random() * 0.45,
        max: 0.9,
        size: 3 + Math.random() * 6,
        color,
      });
    }
  }

  function hit(a, b, padX = 10, padY = 7) {
    return (
      a.x + padX < b.x + b.w &&
      a.x + a.w - padX > b.x &&
      a.y + padY < b.y + b.h &&
      a.y + a.h - padY > b.y
    );
  }

  function collect(player, item) {
    const cx = Math.max(player.x, Math.min(item.x, player.x + player.w));
    const cy = Math.max(player.y, Math.min(item.y, player.y + player.h));
    return (cx - item.x) ** 2 + (cy - item.y) ** 2 < (item.r + 4) ** 2;
  }

  function update(dt) {
    const s = state;
    s.elapsed += dt;
    s.speed = Math.min(675, 305 + s.elapsed * 8.3) * Math.min(1, worldWidth / 800);
    s.distance += s.speed * dt;
    s.score = Math.floor(s.distance / 12) + s.bonus;
    s.flash = Math.max(0, s.flash - dt * 2.8);
    s.shake = Math.max(0, s.shake - dt);
    s.player.vy += 1900 * dt;
    s.player.y += s.player.vy * dt;
    s.player.tilt += (Math.min(0.2, s.player.vy / 1500) - s.player.tilt) * Math.min(1, dt * 9);
    if (s.player.y + s.player.h >= groundY()) {
      s.player.y = groundY() - s.player.h;
      s.player.vy = 0;
      s.player.jumps = 0;
      s.player.tilt *= 0.55;
    }

    s.nextObstacle -= dt;
    if (s.nextObstacle <= 0) {
      spawnObstacle();
      const spacing = 1.05 + Math.random() * 0.9;
      s.nextObstacle = spacing * Math.max(0.63, 330 / s.speed);
    }
    s.nextCollectible -= dt;
    if (s.nextCollectible <= 0) {
      spawnCollectible();
      s.nextCollectible = 1.45 + Math.random() * 2.3;
    }

    for (const obstacle of s.obstacles) obstacle.x -= s.speed * dt;
    for (const item of s.collectibles) {
      item.x -= s.speed * dt;
      item.spin += dt * 5;
      if (!item.taken && collect(s.player, item)) {
        item.taken = true;
        s.bonus += 35;
        s.flash = 0.35;
        sound("coin");
        burst(item.x, item.y, "#ffd84d", 13);
      }
    }
    for (const obstacle of s.obstacles) {
      if (hit(s.player, obstacle, obstacle.type === "puddle" ? 16 : 13, 10)) {
        endGame();
        break;
      }
    }
    s.obstacles = s.obstacles.filter((x) => x.x + x.w > -40);
    s.collectibles = s.collectibles.filter((x) => !x.taken && x.x + x.r > -30);
    for (const p of s.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
    }
    s.particles = s.particles.filter((p) => p.life > 0);
    for (const cloud of s.clouds) {
      cloud.x -= s.speed * dt * 0.055 * cloud.scale;
      if (cloud.x < -170) cloud.x = 1030 + Math.random() * 250;
    }
    const milestone = Math.floor(s.score / 250);
    if (milestone > s.milestone) {
      s.milestone = milestone;
      sound("level");
    }
    updateHud();
  }

  function frame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    if (state.phase === "running") update(dt);
    else {
      state.shake = Math.max(0, state.shake - dt);
      for (const p of state.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      state.particles = state.particles.filter(p => p.life > 0);
    }
    draw();
    if (state.phase === "running" || state.shake > 0 || state.particles.length)
      raf = requestAnimationFrame(frame);
  }

  function resize() {
    if (!canvas || !ctx) return;
    const box = canvas.parentElement.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const previousGround = groundY();
    const aspect = box.width / box.height;
    worldWidth = Math.max(540, 430 * aspect);
    worldHeight = worldWidth / aspect;
    const scale = box.width / worldWidth;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const shift = groundY() - previousGround;
    state.player.y += shift;
    state.obstacles.forEach(o => { o.y += shift; });
    state.collectibles.forEach(o => { o.y += shift; });
    draw();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawCloud(cloud) {
    ctx.save();
    ctx.translate(cloud.x, cloud.y);
    ctx.scale(cloud.scale, cloud.scale);
    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.beginPath();
    ctx.arc(25, 25, 22, 0, Math.PI * 2);
    ctx.arc(54, 17, 31, 0, Math.PI * 2);
    ctx.arc(88, 27, 23, 0, Math.PI * 2);
    ctx.roundRect(15, 25, 87, 29, 15);
    ctx.fill();
    ctx.restore();
  }

  function drawBackground() {
    ctx.save();
    ctx.scale(worldWidth / 960, worldHeight / 430);
    const sky = ctx.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, "#7157e8");
    sky.addColorStop(0.5, "#6fbcff");
    sky.addColorStop(1, "#d8f5ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 430);
    ctx.fillStyle = "rgba(255,224,100,.92)";
    ctx.beginPath();
    ctx.arc(840, 75, 39, 0, Math.PI * 2);
    ctx.fill();
    for (const cloud of state.clouds) drawCloud(cloud);

    const far = -(state.distance * 0.08) % 190;
    ctx.fillStyle = "rgba(51,70,132,.25)";
    for (let x = far - 190; x < 1100; x += 190) {
      ctx.fillRect(x, 218, 132, 132);
      ctx.fillRect(x + 24, 188, 84, 35);
      ctx.fillStyle = "rgba(255,245,183,.48)";
      for (let wx = x + 15; wx < x + 120; wx += 28)
        for (let wy = 237; wy < 330; wy += 27) ctx.fillRect(wx, wy, 13, 13);
      ctx.fillStyle = "rgba(51,70,132,.25)";
    }

    const near = -(state.distance * 0.22) % 125;
    ctx.fillStyle = "#58b67d";
    ctx.beginPath();
    ctx.moveTo(0, 330);
    for (let x = near - 125; x <= 1085; x += 125)
      ctx.quadraticCurveTo(x + 62, 290 + (Math.floor(x / 125) % 2) * 18, x + 125, 330);
    ctx.lineTo(960, 370);
    ctx.lineTo(0, 370);
    ctx.fill();

    ctx.fillStyle = "#26314f";
    ctx.fillRect(0, 350, 960, 80);
    ctx.fillStyle = "#3b486a";
    ctx.fillRect(0, 350, 960, 8);
    ctx.fillStyle = "#ffdf66";
    const road = -(state.distance * 0.82) % 95;
    for (let x = road - 95; x < 1050; x += 95) {
      ctx.beginPath();
      ctx.roundRect(x, 392, 54, 6, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = state.player;
    const grounded = p.jumps === 0 && p.vy === 0;
    const bob = grounded && state.phase === "running" ? Math.sin(state.elapsed * 14) * 2.4 : 0;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2 + bob);
    ctx.rotate(p.tilt);
    const squash = grounded && state.phase === "running" ? 1 + Math.sin(state.elapsed * 14) * 0.018 : 1;
    ctx.scale(1 / squash, squash);
    ctx.shadowColor = "rgba(20,20,45,.28)";
    ctx.shadowBlur = 13;
    ctx.shadowOffsetY = 7;
    if (mascot.complete && mascot.naturalWidth) ctx.drawImage(mascot, -p.w / 2, -p.h / 2, p.w, p.h);
    else {
      ctx.fillStyle = "#a55a2d";
      ctx.beginPath();
      ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.shadowColor = "rgba(14,19,42,.22)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 5;
    if (o.type === "cone") {
      ctx.fillStyle = "#ff6b35";
      ctx.beginPath();
      ctx.moveTo(o.w / 2, 0);
      ctx.lineTo(o.w - 5, o.h - 10);
      ctx.lineTo(5, o.h - 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff7e8";
      ctx.fillRect(11, 29, o.w - 22, 9);
      ctx.fillStyle = "#f04b22";
      ctx.roundRect(0, o.h - 11, o.w, 11, 5);
      ctx.fill();
    } else if (o.type === "books") {
      const colors = ["#ff4d5d", "#ffd34e", "#20c997"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = colors[i];
        ctx.beginPath();
        ctx.roundRect(i % 2 ? 5 : 0, o.h - 15 * (i + 1), o.w - 5, 13, 4);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.75)";
        ctx.fillRect(i % 2 ? 10 : 5, o.h - 11 - 15 * i, o.w - 18, 3);
      }
    } else if (o.type === "backpack") {
      ctx.strokeStyle = "#26314f";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(o.w / 2, 13, 13, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#ff3b6b";
      ctx.beginPath();
      ctx.roundRect(2, 10, o.w - 4, o.h - 10, 14);
      ctx.fill();
      ctx.fillStyle = "#ffc2d1";
      ctx.beginPath();
      ctx.roundRect(10, 33, o.w - 20, 20, 8);
      ctx.fill();
    } else {
      const puddle = ctx.createRadialGradient(o.w / 2, o.h / 2, 2, o.w / 2, o.h / 2, o.w / 2);
      puddle.addColorStop(0, "#70e0ff");
      puddle.addColorStop(1, "#3877d9");
      ctx.fillStyle = puddle;
      ctx.beginPath();
      ctx.ellipse(o.w / 2, o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function starPath(x, y, r, rotation) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = rotation - Math.PI / 2 + (i * Math.PI) / 5;
      const radius = i % 2 ? r * 0.47 : r;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (!i) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawCollectible(item) {
    ctx.save();
    ctx.shadowColor = "rgba(255,213,54,.72)";
    ctx.shadowBlur = 16;
    starPath(item.x, item.y, item.r, item.spin * 0.25);
    ctx.fillStyle = "#ffd84d";
    ctx.fill();
    ctx.strokeStyle = "#fff4a8";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.save();
    const amount = state.shake > 0 ? state.shake * 9 : 0;
    if (amount) ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    drawBackground();
    for (const item of state.collectibles) if (!item.taken) drawCollectible(item);
    for (const obstacle of state.obstacles) drawObstacle(obstacle);
    drawPlayer();
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,235,97,${state.flash * 0.28})`;
      ctx.fillRect(0, 0, worldWidth, worldHeight);
    }
    ctx.restore();
  }

  function updateHud() {
    if (!overlay) return;
    overlay.querySelector("[data-score]").textContent = String(state.score).padStart(4, "0");
    overlay.querySelector("[data-best]").textContent = String(Math.max(bestScore(), state.score)).padStart(4, "0");
    overlay.querySelector("[data-speed]").textContent = `${(state.speed / 305).toFixed(1)}×`;
  }

  function initAudio() {
    if (muted || audio) return;
    const AudioContext = root.AudioContext || root.webkitAudioContext;
    if (!AudioContext) return;
    try {
      audio = new AudioContext();
    } catch {}
  }

  function sound(kind) {
    if (muted) return;
    initAudio();
    if (!audio) return;
    const notes = {
      jump: [420, 0.07, "sine"],
      double: [610, 0.08, "sine"],
      coin: [880, 0.11, "triangle"],
      level: [720, 0.16, "triangle"],
      crash: [115, 0.22, "sawtooth"],
    };
    const [frequency, duration, type] = notes[kind] || notes.jump;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    if (kind === "crash") oscillator.frequency.exponentialRampToValueAtTime(55, audio.currentTime + duration);
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function toggleSound() {
    muted = !muted;
    const button = overlay.querySelector("[data-sound]");
    button.classList.toggle("muted", muted);
    button.setAttribute("aria-label", muted ? "Activar sonido" : "Desactivar sonido");
    button.innerHTML = muted
      ? icon("M5 9v6h4l5 4V5L9 9H5zm12 1l4 4m0-4l-4 4")
      : icon("M5 9v6h4l5 4V5L9 9H5zm12 1a3 3 0 010 4m2-7a7 7 0 010 10");
  }

  function reconnect() {
    if (navigator.onLine) {
      close();
      location.reload();
      return;
    }
    context?.toast?.("Todavía no hay internet. Puedes seguir jugando mientras regresa.");
    const chip = overlay?.querySelector("[data-network]");
    chip?.classList.add("checking");
    setTimeout(() => chip?.classList.remove("checking"), 900);
  }

  function updateNetwork() {
    const online = navigator.onLine;
    if (overlay) {
      const chip = overlay.querySelector("[data-network]");
      chip.classList.toggle("online", online);
      chip.querySelector("span").textContent = online ? "Conexión recuperada" : "Sin internet";
      overlay.querySelector("[data-reconnect]").innerHTML = online
        ? `${icon("M4 12l5 5L20 6")} Volver a la página`
        : `${icon("M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0114 6M18 18A8 8 0 014 12")} Revisar conexión`;
    }
    updateLauncher();
  }

  function eligible() {
    const user = context?.state?.user;
    if (!user) return !navigator.onLine || !!root.FIT_OFFLINE?.getSession?.()?.user;
    const type = String(user.account_type || "").toLowerCase();
    return ["student", "teacher", "admin"].includes(type) || /@(alumnos\.)?uat\.edu\.mx$/i.test(user.email || "") || /@docentes\.uat\.edu\.mx$/i.test(user.email || "");
  }

  function updateLauncher() {
    const show = (context?.state?.offline || !navigator.onLine) && eligible() && !overlay?.classList.contains("visible");
    if (!show) {
      launcher?.remove();
      launcher = null;
      return;
    }
    if (launcher) return;
    launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "offline-game-launcher";
    launcher.innerHTML = `<img src="${PLAYER_IMAGE}" alt=""><span><b>Sin internet</b><small>Jugar Castor Runner</small></span>${icon("M8 5l11 7-11 7V5z")}`;
    launcher.onclick = open;
    document.body.append(launcher);
  }

  function render(c) {
    context = c;
    const host = c.$("#view");
    if (!host) return;
    host.innerHTML = `
      <section class="offline-game-teaser">
        <div class="offline-game-teaser-art"><span class="runner-sun"></span><span class="runner-cloud one"></span><span class="runner-cloud two"></span><img src="${PLAYER_IMAGE}" alt="Castor FIT listo para correr"></div>
        <div class="offline-game-teaser-copy">
          <span class="eyebrow">DIVIÉRTETE SIN CONEXIÓN</span>
          <h2>Castor Runner</h2>
          <p>Salta los obstáculos de la facultad, recoge estrellas y supera tu propio récord mientras regresa el internet.</p>
          <ul><li>Doble salto</li><li>Dificultad progresiva</li><li>Récord guardado en este dispositivo</li></ul>
          <div class="button-row"><button class="btn" type="button" data-start-offline-game>Jugar ahora</button><button class="btn secondary" type="button" data-check-offline-network>Revisar conexión</button></div>
          <small>El juego es solo por diversión y no agrega monedas ni EXP a tu cuenta.</small>
        </div>
      </section>`;
    host.querySelector("[data-start-offline-game]").onclick = open;
    host.querySelector("[data-check-offline-network]").onclick = reconnect;
  }

  function mount(c) {
    context = c || context;
    document.querySelectorAll("[data-offline-game]").forEach((button) => (button.onclick = open));
    updateLauncher();
    if (listenersReady) return;
    listenersReady = true;
    root.addEventListener("offline", updateNetwork);
    root.addEventListener("online", updateNetwork);
    document.addEventListener("fullscreenchange", resize);
    root.visualViewport?.addEventListener("resize", resize);
    root.addEventListener("resize", () => overlay && !overlay.hidden && resize());
    root.addEventListener("keydown", (event) => {
      if (!overlay || overlay.hidden) return;
      if (["Space", "ArrowUp", "KeyW"].includes(event.code)) {
        event.preventDefault();
        if (state.phase === "running") jump();
        else start();
      } else if (event.code === "Escape") close();
    });
  }

  root.FIT_OFFLINE_GAME = { mount, render, open, close };
})(window);
