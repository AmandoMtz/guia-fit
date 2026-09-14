/* App shell sin conexión. Las respuestas /api nunca se guardan aquí. */
const CACHE = "guia-fit-shell-v14-campus";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/campus-map.css",
  "/js/campus-map.js",
  "/mapa-campus-demo.html",
  "/js/campus-map-demo.js",
  "/config.js",
  "/assets/logos.png",
  "/assets/guia-fit-mascota.png",
  "/assets/croquis.png",
  "/js/api.js",
  "/js/catalog.js",
  "/js/core.js",
  "/js/offline.js",
  "/js/food-flow.js",
  "/js/food.js",
  "/js/schedule-core.js",
  "/js/schedule-store.js",
  "/js/ocr.js",
  "/js/timetable.js",
  "/js/schedule.js",
  "/js/events.js",
  "/js/chatbot.js",
  "/js/gamification.js",
  "/js/app.js",
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
    caches.match(request).then((cached) => {
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
