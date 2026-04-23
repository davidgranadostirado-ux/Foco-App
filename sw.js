// Service Worker para Foco PWA
// Estrategia: cache-first para los assets core, network-first para el HTML (para recibir actualizaciones)

const CACHE_VERSION = "foco-v1.1.0";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isHTML = req.mode === "navigate" || req.destination === "document";

  if (isHTML) {
    // Network-first for HTML: tries to fetch fresh, falls back to cache
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
  } else {
    // Cache-first for static assets
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        return res;
      }))
    );
  }
});

/* ---------------- Notificaciones ---------------- */

// Mensaje desde la página: { type: "show-notification", title, body, tag, data }
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "show-notification") return;
  const opts = {
    body: data.body || "",
    tag: data.tag || ("foco-" + Date.now()),
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: data.data || {},
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(data.title || "Foco", opts));
});

// Al tocar la notificación: abre o foca la PWA
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      // Si ya hay una pestaña/PWA abierta, foca esa
      try {
        await client.focus();
        return;
      } catch(e) { /* sigue probando */ }
    }
    // Si no hay ninguna, ábrela
    if (self.clients.openWindow) {
      await self.clients.openWindow("./");
    }
  })());
});
