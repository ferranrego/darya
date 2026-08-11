/* Darya service worker: offline shell + cached reading.
 * - static assets (fonts, JS, icons): cache-first
 * - navigations & API reads: network-first with cache fallback
 * Push handling arrives in Phase 3 (Declarative Web Push payloads). */

const VERSION = "darya-v1.3";
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Bypass cache completely during local development to avoid stale Turbopack chunks
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return; // Fall through to standard network fetch
  }

  // Immutable build assets, fonts, icons.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // App pages: fresh when online, cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const title = data.title || "Darya";
    const options = {
      body: data.body || "It's time for your daily review!",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: data.data || { url: "/" },
      vibrate: [100, 50, 100],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error("Error parsing push payload", e);
  }
});

/* Push services rotate endpoints — Apple does so on its own schedule, without
 * the app being opened. Without this handler the old endpoint stays in the
 * database, every later send returns 410, and the user silently stops
 * receiving anything forever. Re-subscribe with the same server key and tell
 * the backend about the new endpoint. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey =
          event.oldSubscription?.options?.applicationServerKey ||
          (await self.registration.pushManager.getSubscription())?.options?.applicationServerKey;
        if (!applicationServerKey) return;

        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const keys = sub.toJSON().keys;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: { p256dh: keys?.p256dh, auth: keys?.auth },
            platform: "web",
          }),
        });
      } catch (e) {
        console.error("pushsubscriptionchange re-subscribe failed", e);
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  // Payloads carry a path; compare against absolute URLs so an already-open
  // window is reused instead of spawning a second copy of the PWA.
  const urlToOpen = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }

      // Already open, but elsewhere in the app: focus it and navigate.
      const existing = windowClients[0];
      if (existing && "focus" in existing) {
        await existing.focus();
        if ("navigate" in existing) return existing.navigate(urlToOpen);
        return;
      }

      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })()
  );
});
