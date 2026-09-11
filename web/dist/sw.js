/* App shell sin conexión. Las respuestas /api nunca se guardan aquí. */
const CACHE = "guia-fit-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/config.js",
  "/assets/logos.png",
  "/js/api.js",
  "/js/catalog.js",
  "/js/core.js",
  "/js/offline.js",
  "/js/food-flow.js",
  "/js/food.js",
  "/js/schedule-core.js",
  "/js/schedule-store.js",
  "/vendor/tesseract/tesseract.min.js",
  "/js/ocr.js",
  "/js/timetable.js",
  "/js/schedule.js",
  "/js/events.js",
  "/js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("guia-fit-shell-") && key !== CACHE).map((key) => caches.delete(key))),
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
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
