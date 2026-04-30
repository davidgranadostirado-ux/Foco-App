// Service Worker para Foco PWA
// Estrategia: network-first con cache: 'no-cache' para HTML (siempre código fresco),
//             cache-first para assets estáticos (iconos, manifest).

const CACHE_VERSION = "foco-v1.6.0";
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
    // Precachear assets estáticos (NO el HTML — lo fetcharemos siempre fresco)
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(["./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => {
        // Avisar a todos los clientes que el SW se actualizó — ellos recargarán
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
        });
      })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const isHTML = req.mode === "navigate" || req.destination === "document";

  if (isHTML) {
    // Network-first para HTML: siempre pide al servidor ignorando caché HTTP
    // Esto evita que F5 sirva código viejo del CDN de GitHub Pages
    event.respondWith(
      fetch(new Request(req, { cache: "no-cache" }))
        .then((res) => {
          // Guardar en caché como respaldo offline
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("./index.html"))
        )
    );
  } else {
    // Cache-first para assets estáticos (iconos, manifest)
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      try {
        await client.focus();
        return;
      } catch(e) { /* sigue probando */ }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow("./");
    }
  })());
});
