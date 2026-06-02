const CACHE_NAME = "busca-salto-pwa-v2";

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
      const preparedResponse = await prepareResponse(request, response.clone());
      cache.put(request, preparedResponse.clone());
      return preparedResponse;
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

async function prepareResponse(request, response) {
  const url = new URL(request.url);
  const isHtml =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith("/index.html");

  if (!isHtml || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  let html = await response.text();
  if (!html.includes('id="installBanner"')) {
    const banner =
      '<section id="installBanner" class="install-banner container" hidden aria-live="polite"><div><strong id="installTitle">Instale o Guia Salto</strong><p id="installText">Acesse o Busca Salto pela tela inicial, como um aplicativo.</p></div><div class="install-banner-actions"><button id="installButton" class="install-button" type="button">Instalar</button><button id="installDismiss" class="install-close" type="button">Agora nao</button></div></section>';
    html = html.replace("</header>", `</header>\n  ${banner}`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
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
