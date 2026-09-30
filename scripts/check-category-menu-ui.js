const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TAXONOMY } = require("../api/_lib/taxonomy");

const chromePath = process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for category menu");
}

function makeCdp(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  const live = process.argv.includes("--live");
  const server = live ? null : http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/" || pathname === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }
    if (pathname === "/imagens/logo.png") {
      res.setHeader("Content-Type", "image/png");
      res.end(fs.readFileSync(path.join(__dirname, "..", "imagens", "logo.png")));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/api/comercios") {
      const mode = new URL(req.url, "http://localhost").searchParams.get("mode");
      res.end(JSON.stringify(mode === "filters"
        ? { filters: { categoriasAgrupadas: TAXONOMY, bairros: [] } }
        : { items: [], total: 0, page: 1, limit: 30, hasMore: false }));
    } else if (pathname === "/api/patrocinadores") {
      res.end(JSON.stringify({ items: [], config: { banner: { url: "/imagens/logo.png" }, logo: { url: "/imagens/logo.png" } } }));
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  if (server) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-menu-"));
  const chrome = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let socket;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    const port = await until(() => {
      try { return fs.existsSync(portFile) && Number(fs.readFileSync(portFile, "utf8").split("\n")[0]); }
      catch (error) { return false; }
    });
    const tab = await until(async () => {
      const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()).catch(() => []);
      return tabs.find((item) => item.type === "page");
    });
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const call = makeCdp(socket);
    await call("Page.enable");
    await call("Runtime.enable");
    const evaluate = async (expression) => {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };

    for (const { width, height } of [{ width: 1280, height: 800 }, { width: 390, height: 800 }, { width: 390, height: 600 }]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 680 });
      await call("Page.navigate", { url: live ? "https://www.buscasalto.com/" : `http://127.0.0.1:${server.address().port}/` });
      await until(() => evaluate("document.querySelectorAll('.category-choice').length > 100 && !document.querySelector('#siteHero').classList.contains('hero-pending')"));
      const before = await evaluate("({ scrollY, heroScrollTop: document.querySelector('#siteHero').scrollTop, image: getComputedStyle(document.querySelector('#heroImage')).backgroundImage })");
      await evaluate("document.querySelector('#categoryButton').click()");
      await until(() => evaluate("!document.querySelector('#categoryMenu').hidden"));
      await wait(100);
      const state = await evaluate(`(() => {
        const menu = document.querySelector('#categoryMenu');
        const hero = document.querySelector('#siteHero');
        const first = menu.querySelector('.category-choice');
        menu.scrollTop = menu.scrollHeight;
        const last = [...menu.querySelectorAll('.category-choice')].at(-1);
        const rect = menu.getBoundingClientRect();
        const lastRect = last.getBoundingClientRect();
        return {
          menuTop: rect.top, menuBottom: rect.bottom, viewportHeight: innerHeight,
          lastBottom: lastRect.bottom, lastVisible: lastRect.top >= rect.top + 2 && lastRect.bottom <= Math.min(rect.bottom, innerHeight) - 2,
          menuInBody: menu.parentElement === document.body,
          heroImageVisible: !document.querySelector('#heroImage').hidden,
          heroBackground: getComputedStyle(document.querySelector('#heroImage')).backgroundImage,
          scrollY, heroScrollTop: hero.scrollTop, pageWidth: document.documentElement.scrollWidth,
          first: first.textContent, last: last.textContent,
        };
      })()`);
      if (process.argv.includes("--screenshots")) {
        const shot = await call("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(os.tmpdir(), `busca-salto-menu-${width}x${height}.png`), Buffer.from(shot.data, "base64"));
      }
      if (process.argv.includes("--inspect")) {
        console.log(width, JSON.stringify(state));
        continue;
      }
      assert.equal(state.menuInBody, true, JSON.stringify(state));
      assert.ok(state.menuTop >= 0 && state.menuBottom <= height, JSON.stringify(state));
      assert.equal(state.lastVisible, true, JSON.stringify(state));
      assert.equal(state.heroImageVisible, true, JSON.stringify(state));
      assert.equal(state.heroBackground, before.image, JSON.stringify(state));
      assert.equal(state.scrollY, before.scrollY, JSON.stringify(state));
      assert.equal(state.heroScrollTop, before.heroScrollTop, JSON.stringify(state));
      assert.ok(state.pageWidth <= width + 1, JSON.stringify(state));
      await evaluate("document.querySelector('.category-menu-search').click()");
      assert.equal(await evaluate("document.querySelector('#categoryMenu').hidden"), false);
      await evaluate("(() => { const input = document.querySelector('.category-menu-search'); input.value = 'transporte'; input.dispatchEvent(new Event('input', { bubbles: true })); })()");
      assert.equal(await evaluate("document.querySelectorAll('#categoryMenu .category-group').length"), 1);
      await evaluate("[...document.querySelectorAll('#categoryMenu .category-choice')].at(-1).click()");
      assert.equal(await evaluate("document.querySelector('#categoryMenu').hidden"), true);
      assert.equal(await evaluate("document.querySelector('#categoryFilter').value"), "Transportadoras");
      await evaluate("document.querySelector('#categoryButton').click()");
      await evaluate("document.querySelector('.category-menu-close').click()");
      assert.equal(await evaluate("document.querySelector('#categoryMenu').hidden"), true);
      assert.equal(await evaluate("document.activeElement.id"), "categoryButton");
    }
    console.log("Category menu: desktop and mobile viewport, full scroll, hero stability passed.");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 99999, method: "Browser.close" }));
      await wait(300);
    }
    socket?.close();
    chrome.kill();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
      catch (error) { console.warn(`Could not remove Chrome test profile: ${profile}`); }
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
