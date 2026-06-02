const CACHE_NAME = "busca-salto-pwa-v1";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/comerciantes.html",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/imagens/logo.png",
  "/imagens/MP.png"
];

async function cacheStaticAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(
    STATIC_ASSETS.map(async (asset) => {
      const response = await fetch(asset, { cache: "reload" });
      if (response.ok) {
        await cache.put(asset, response);
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheStaticAssets());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return cache.match("/index.html");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(networkFirst(request));
});
