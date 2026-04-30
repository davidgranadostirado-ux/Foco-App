// Service Worker para Foco PWA — v1.6.0
//
// Estrategia:
//   - HTML (navegación): NUNCA se intercepta. El navegador lo pide directo a la red.
//     Esto evita que F5 sirva código viejo cacheado. GitHub Pages siempre da el JS más nuevo.
//   - Assets estáticos (iconos, manifest): cache-first con respaldo de red.
//   - Notificaciones push: manejadas aquí.

const CACHE_VERSION = "foco-v1.6.0";
const STATIC_ASSETS = [
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable.png"
];

// ── Install: solo cachear assets estáticos (NO el HTML) ──────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: limpiar cachés viejos y tomar control ──────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Avisar a todos los clientes que el SW se actualizó → la página recargará
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
        });
      })
  );
});

// ── Fetch: NO interceptar HTML; cache-first para assets estáticos ─────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Navegación (HTML): dejar que el navegador lo maneje directamente
  // → siempre obtiene el JS más reciente de GitHub Pages sin pasar por caché del SW
  if (req.mode === "navigate") return;

  // Assets estáticos: cache-first con respaldo de red
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

// ── Notificaciones ────────────────────────────────────────────────────────────

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
      try { await client.focus(); return; } catch(e) { /* sigue */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow("./");
  })());
});
