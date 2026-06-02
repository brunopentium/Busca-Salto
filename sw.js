const CACHE_NAME = "busca-salto-pwa-v3";

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

  if (!html.includes("buscaSaltoPwaAndroidFallback")) {
    const fallbackScript = `<script>
      (() => {
        window.buscaSaltoPwaAndroidFallback = true;
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
        const isAndroid = /android/i.test(window.navigator.userAgent);
        if (isStandalone || !isAndroid) return;
        window.setTimeout(() => {
          const banner = document.getElementById("installBanner");
          const title = document.getElementById("installTitle");
          const text = document.getElementById("installText");
          const button = document.getElementById("installButton");
          if (!banner || !title || !text || !button || !banner.hidden) return;
          if (window.localStorage.getItem("buscaSaltoInstallDismissed") === "1") return;
          title.textContent = "Instale o Guia Salto no Chrome";
          text.textContent = "Se o botao instalar nao aparecer, toque nos tres pontos do Chrome e escolha Adicionar a tela inicial ou Instalar app.";
          button.textContent = "Entendi";
          banner.dataset.installMode = "android-help";
          banner.hidden = false;
        }, 3000);
        document.addEventListener("click", (event) => {
          const button = event.target.closest("#installButton");
          const banner = document.getElementById("installBanner");
          if (!button || banner?.dataset.installMode !== "android-help") return;
          window.localStorage.setItem("buscaSaltoInstallDismissed", "1");
          banner.hidden = true;
        }, true);
      })();
    </script>`;
    html = html.replace("</body>", `${fallbackScript}\n</body>`);
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
