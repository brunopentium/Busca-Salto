const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const chromePath = process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome");
const html = fs.readFileSync(path.join(root, "index.html"));
const image = fs.readFileSync(path.join(root, "imagens", "MP.png"));
const config = {
  banner: { url: "/hero-desktop.png", ajuste: { fit: "cover", zoom: 1.2, x: 34, y: 61 }, visual: { brightness: 66, vignette: 45 } },
  bannerMobile: { url: "/hero-mobile.png", ajuste: { fit: "contain", zoom: 1.1, x: 77, y: 90 }, visual: { brightness: 103, vignette: 88 } },
  logo: { url: "/hero-logo.png", ajuste: { fit: "height", zoom: 1, x: 62, y: 5 } },
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for the hero");
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
  const expectedConfig = live
    ? (await fetch("https://www.buscasalto.com/api/patrocinadores").then((res) => res.json())).config
    : config;
  const requestedImages = [];
  const server = live ? null : http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/" || pathname === "/index.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    } else if (pathname === "/api/patrocinadores") {
      await wait(800);
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, config, patrocinadores: [] }));
    } else if (pathname.endsWith(".png")) {
      requestedImages.push(pathname);
      await wait(250);
      res.setHeader("Content-Type", "image/png");
      res.end(image);
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  if (server) await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-hero-"));
  const chrome = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*",
    `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let socket, call;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    const port = await until(() => fs.existsSync(portFile) && Number(fs.readFileSync(portFile, "utf8").split("\n")[0]));
    const tab = await until(async () => {
      const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) => res.json()).catch(() => []);
      return tabs.find((item) => item.type === "page");
    });
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    call = makeCdp(socket);
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Network.enable");
    await call("Network.setCacheDisabled", { cacheDisabled: true });
    const state = async () => {
      const response = await call("Runtime.evaluate", {
        expression: `(() => { const hero = document.querySelector("#siteHero"); const image = document.querySelector("#heroImage"); const logo = document.querySelector("#siteLogo"); return hero && { pending: hero.classList.contains("hero-pending"), visibility: getComputedStyle(hero).visibility, image: image.style.backgroundImage, imageHidden: image.hidden, position: image.style.backgroundPosition, fit: image.className, brightness: hero.style.getPropertyValue("--hero-brightness"), logo: logo.style.backgroundImage }; })()`,
        returnByValue: true,
      });
      return response.result.value;
    };
    const metrics = async (width) => call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 680 });
    const assertReady = (value, banner) => {
      assert.equal(value.pending, false);
      assert.equal(value.visibility, "visible");
      assert.equal(value.imageHidden, false);
      assert.ok(value.image.includes(banner.url));
      assert.equal(value.position, `${banner.ajuste.x}% ${banner.ajuste.y}%`);
      assert.equal(value.brightness, `${banner.visual.brightness}%`);
      assert.ok(value.logo.includes(expectedConfig.logo.url));
    };

    await metrics(1280);
    await call("Network.emulateNetworkConditions", { offline: false, latency: live ? 100 : 300, downloadThroughput: live ? 2000000 : 200000, uploadThroughput: 200000 });
    await call("Page.navigate", { url: live ? "https://www.buscasalto.com/" : `http://127.0.0.1:${server.address().port}/` });
    await until(state);
    const initial = await state();
    assert.equal(initial.pending, true);
    assert.equal(initial.visibility, "hidden");
    assert.equal(initial.imageHidden, true);
    const desktop = await until(async () => { const value = await state(); return !value.pending && value; }, 45000);
    assertReady(desktop, expectedConfig.banner);
    if (!live) assert.equal(requestedImages.includes("/hero-mobile.png"), false);

    await metrics(390);
    const mobilePending = await state();
    assert.equal(mobilePending.visibility, "hidden");
    const mobile = await until(async () => { const value = await state(); return value.visibility === "visible" && value.image.includes(expectedConfig.bannerMobile.url) && value; }, 45000);
    assertReady(mobile, expectedConfig.bannerMobile);

    requestedImages.length = 0;
    await call("Page.reload", { ignoreCache: true });
    await until(async () => { const value = await state(); return value?.pending && value; });
    const mobileReload = await until(async () => { const value = await state(); return !value.pending && value; }, 45000);
    assertReady(mobileReload, expectedConfig.bannerMobile);
    if (!live) assert.equal(requestedImages.includes("/hero-desktop.png"), false);
    console.log(`Hero boot (${live ? "production" : "mock"}): desktop, mobile, resize and empty-cache reload passed.`);
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
