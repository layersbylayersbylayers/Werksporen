const CACHE = "werksporen-admin-v2";
const SHELL = ["/admin", "/portfolio-admin.html", "/manifest.webmanifest", "/werksporen-admin-icon.svg"];
const ADMIN_PATHS = new Set(SHELL);
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("werksporen-admin-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // The worker is only an offline fallback for Admin. Never cache public portfolio pages.
  if (event.request.method !== "GET" || !ADMIN_PATHS.has(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === "basic") caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
