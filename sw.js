// Service Worker para Foco PWA — v1.6.0
//
// Estrategia:
//   - HTML: NO se intercepta. Siempre va directo a la red.
//   - Assets estáticos (iconos, manifest): cache-first.
//   - Al activarse SW nuevo: envía postMessage SW_UPDATED.
//     La página escucha 'controllerchange' y recarga automáticamente.

const CACHE_VERSION = "foco-v1.6.0";
const STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      // No llamamos client.navigate() aquí (causa errores de canal cerrado).
      // La página detecta el cambio de controller con el evento 'controllerchange'
      // y recarga sola. Ver registro en index.html.
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // NO interceptar navegación HTML
  if (req.mode === "navigate") return;

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        return res;
      })
    )
  );
});

/* ── Notificaciones ────────────────────────────────────────────────────────── */

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "show-notification") return;
  event.waitUntil(
    self.registration.showNotification(data.title || "Foco", {
      body: data.body || "",
      tag: data.tag || ("foco-" + Date.now()),
      icon: "icon-192.png",
      badge: "icon-192.png",
      data: data.data || {},
      silent: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of all) {
      try { await client.focus(); return; } catch(e) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow("./");
  })());
});
