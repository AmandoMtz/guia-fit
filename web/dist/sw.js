/* App shell sin conexión. Las respuestas /api nunca se guardan aquí. */
importScripts('/push-worker.js?v=3');
const CACHE = "guia-fit-shell-styles-20260926a";
const SHELL = [
  "/js/food-delivery.js?v=20260926a",
  "/js/live-location.js?v=20260926a",
  '/assets/guia-fit-mascota.png',
  '/assets/guia-fit-mascota.png',
  '/styles.css?v=20260926a',
  '/campus-map.css?v=20260926a',
  '/offline-game.css?v=20260918b',
  '/config.js',
  '/js/api.js',
  '/js/catalog.js',
  '/js/core.js',
  '/js/offline.js?v=20260918c',
  '/js/food-flow.js',
  '/js/food.js?v=20260926a',
  '/js/schedule-core.js?v=19',
  '/js/schedule-store.js',
  '/vendor/tesseract/tesseract.min.js',
  '/js/ocr.js?v=19',
  '/js/timetable.js',
  '/js/schedule.js?v=20260918c',
  '/js/attendance-security.js',
  '/js/events.js',
  '/js/chatbot.js?v=20260916d',
  '/js/purchase-rating.js?v=20260926a',
  '/js/gamification.js?v=20260926a',
  '/js/push-notifications.js?v=20260926a',
  '/js/offline-game.js?v=20260926a',
  '/js/presence.js?v=20260923c',
  '/chat-presence.css?v=20260923c',
  '/js/academic-chat.js?v=20260926a',
  '/js/campus-map.js?v=20260926a',
  '/js/audit.js?v=20260918c',
  '/js/app.js?v=20260926a',
  '/contrast-fix.css?v=1',
  '/photo-color-fix.css?v=1',
  '/manifest.webmanifest',
  '/account-updates.css?v=2',
  '/assets/guia-fit-mascota.png',
  '/styles.css?v=20260917a',
  '/offline-game.css?v=20260918b',
  '/js/offline-game.js?v=20260926a',
  '/js/offline-game-page.js?v=20260918a',

  "/assets/frames/halloween.svg",
  "/assets/frames/mexico.svg",
  "/assets/frames/christmas.svg",
  "/assets/frames/muertos.svg",
  "/assets/frames/newyear.svg",
  "/assets/frames/valentine.svg",

  "/styles.css?v=20260924a",
  "/campus-map.css",
  "/offline-game.css?v=20260918b",
  "/config.js",
  "/js/api.js",
  "/js/catalog.js",
  "/js/core.js",
  "/js/offline.js?v=20260918c",
  "/js/food-flow.js",
  "/js/food.js?v=20260924a",
  "/js/schedule-core.js?v=19",
  "/js/schedule-store.js",
  "/vendor/tesseract/tesseract.min.js",
  "/js/ocr.js?v=19",
  "/js/timetable.js",
  "/js/schedule.js?v=20260918c",
  "/js/attendance-security.js",
  "/js/events.js",
  "/js/chatbot.js?v=20260916d",
  "/js/purchase-rating.js?v=20260924a",
  "/js/gamification.js",
  "/js/push-notifications.js?v=20260924a",
  "/js/offline-game.js?v=20260918b",
  "/js/offline-game-page.js?v=20260918a",
  "/js/academic-chat.js?v=20260924a",
  "/js/campus-map.js",
  "/js/audit.js?v=20260918c",
  "/js/app.js?v=20260924a",
  "/contrast-fix.css?v=1",
  "/photo-color-fix.css?v=1",
  "/account-updates.css?v=2",

  "/account-updates.css?v=2",
  "/js/audit.js?v=1",
  "/js/attendance-security.js",
  "/js/push-notifications.js?v=20260924a",
  "/js/academic-chat.js?v=20260924a",
  "/manifest.webmanifest",
  "/assets/push-icon-192.png",
  "/assets/push-icon-512.png",
  "/photo-color-fix.css?v=1",
  "/contrast-fix.css?v=1",
  "/",
  "/index.html",
  "/styles.css?v=20260924a",
  "/campus-map.css",
  "/offline-game.css",
  "/js/campus-map.js",
  "/mapa-campus-demo.html",
  "/juego-castor.html",
  "/js/campus-map-demo.js",
  "/config.js",
  "/assets/brand/correcaminos.png",
  "/assets/brand/fit.png",
  "/assets/brand/ingenieria-hoy.png",
  "/assets/brand/textura.png",
  "/assets/brand/uat.png",
  "/assets/fonts/VisbyCF-Bold.otf",
  "/assets/fonts/VisbyCF-BoldOblique.otf",
  "/assets/fonts/VisbyCF-DemiBold.otf",
  "/assets/fonts/VisbyCF-DemiBoldOblique.otf",
  "/assets/fonts/VisbyCF-ExtraBold.otf",
  "/assets/fonts/VisbyCF-ExtraBoldOblique.otf",
  "/assets/fonts/VisbyCF-Heavy.otf",
  "/assets/fonts/VisbyCF-HeavyOblique.otf",
  "/assets/fonts/VisbyCF-Light.otf",
  "/assets/fonts/VisbyCF-LightOblique.otf",
  "/assets/fonts/VisbyCF-Medium.otf",
  "/assets/fonts/VisbyCF-MediumOblique.otf",
  "/assets/fonts/VisbyCF-Regular.otf",
  "/assets/fonts/VisbyCF-RegularOblique.otf",
  "/assets/fonts/VisbyCF-Thin.otf",
  "/assets/fonts/VisbyCF-ThinOblique.otf",
  "/styles.css?v=20260924a",
  "/js/app.js?v=20260924a",
  "/assets/guia-fit-mascota.png",
  "/assets/croquis.png",
  "/js/api.js",
  "/js/catalog.js",
  "/js/core.js",
  "/js/offline.js",
  "/js/food-flow.js",
  "/js/food.js?v=20260924a",
  "/js/schedule-core.js",
  "/js/schedule-store.js",
  "/js/ocr.js",
  "/js/timetable.js",
  "/js/schedule.js",
  "/js/events.js",
  "/js/chatbot.js?v=20260916d",
  "/js/chatbot.js",
  "/js/gamification.js",
  "/js/purchase-rating.js?v=20260924a",
  "/js/offline-game.js",
  "/js/offline-game-page.js",
  "/js/app.js?v=20260924a",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Un recurso opcional no debe impedir que se instale todo el modo offline.
      await Promise.allSettled(
        SHELL.map(async (path) => {
          const response = await fetch(path, { cache: "reload" });
          if (response.ok) await cache.put(path, response);
        }),
      );
      // Nunca activar una instalación incompleta del juego: conservar la versión anterior.
      await cache.addAll(['/index.html','/juego-castor.html','/js/offline-game.js?v=20260926a','/js/offline-game-page.js?v=20260918a','/offline-game.css?v=20260918b','/assets/guia-fit-mascota.png']);
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("guia-fit-shell-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    const navigationPath = url.pathname === "/" ? "/index.html" : url.pathname;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && SHELL.includes(navigationPath)) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE)
              .then((cache) => cache.put(navigationPath, copy))
              .catch(() => {}));
          }
          return response;
        })
        .catch(async () => (await caches.match(navigationPath)) || (await caches.match("/index.html")) || caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async cache => (await cache.match(request)) || (await cache.match(request, {ignoreSearch:true}))).then((cached) => {
      if (cached) {
        // Refresca en segundo plano cuando sí hay red, sin bloquear la apertura offline.
        event.waitUntil(
          fetch(request)
            .then((response) => {
              if (response.ok && response.type === "basic")
                return caches.open(CACHE).then((cache) => cache.put(request, response));
            })
            .catch(() => {}),
        );
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
