const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for PWA metrics");
}

async function main() {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const installScript = index.match(/<script>\s*\(\(\) => \{\s*const banner = document\.getElementById\("installBanner"\);[\s\S]*?<\/script>/)?.[0];
  assert.ok(installScript, "Install script not found in index.html");
  const events = [];
  const page = `<!doctype html><html><body>
    <section id="installBanner" hidden><strong id="installTitle"></strong><p id="installText"></p><button id="installButton">Instalar</button><button id="installDismiss">Agora nao</button></section>
    <script src="/metrics-client.js"></script><script>window.BuscaSaltoMetrics.track("page_view")</script>${installScript}
  </body></html>`;
  const server = http.createServer(async (req, res) => {
    if (req.url === "/test.html") {
      res.setHeader("Content-Type", "text/html");
      res.end(page);
    } else if (req.url === "/metrics-client.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(fs.readFileSync(path.join(root, "metrics-client.js")));
    } else if (req.url === "/api/metricas" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      events.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      res.setHeader("Content-Type", "application/json");
      res.end('{"ok":true}');
    } else { res.statusCode = 404; res.end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-pwa-metrics-"));
  const chrome = spawn(chromePath, ["--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  let socket;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    const port = await until(() => fs.existsSync(portFile) && Number(fs.readFileSync(portFile, "utf8").split("\n")[0]));
    const tab = await until(async () => {
      const tabs = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()).catch(() => []);
      return tabs.find((candidate) => candidate.type === "page");
    });
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let nextId = 0;
    const pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
    const count = (event) => events.filter((item) => item.event === event).length;
    const url = `http://127.0.0.1:${server.address().port}/test.html`;
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Page.navigate", { url });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await until(() => evaluate("!document.querySelector('#installBanner').hidden"));
    await until(() => count("pwa_prompt_shown") === 1);
    assert.equal(count("visit"), 1);
    await evaluate("document.querySelector('#installDismiss').click()");
    await until(() => count("pwa_prompt_dismiss") === 1);
    assert.equal(count("pwa_visit_no_notice"), 0);

    await evaluate("localStorage.setItem('buscaSaltoMetricsLastActivity', String(Date.now() - 31 * 60 * 1000))");
    await call("Page.reload", { ignoreCache: true });
    await until(() => count("pwa_visit_no_notice") === 1);
    assert.equal(events.find((item) => item.event === "pwa_visit_no_notice")?.payload.motivo, "dismissed_this_session");
    assert.equal(count("pwa_prompt_shown"), 1);

    await evaluate("sessionStorage.removeItem('buscaSaltoInstallDismissedSession'); localStorage.setItem('buscaSaltoInstalled', '1'); localStorage.setItem('buscaSaltoMetricsLastActivity', String(Date.now() - 31 * 60 * 1000))");
    await call("Page.reload", { ignoreCache: true });
    await until(() => count("pwa_visit_no_notice") === 2);
    assert.equal(events.filter((item) => item.event === "pwa_visit_no_notice")[1].payload.motivo, "installed");
    assert.equal(await evaluate("document.querySelector('#installBanner').hidden"), true);

    await evaluate("localStorage.removeItem('buscaSaltoInstalled'); localStorage.setItem('buscaSaltoMetricsLastActivity', String(Date.now() - 31 * 60 * 1000))");
    await call("Page.reload", { ignoreCache: true });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await evaluate(`(() => { const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = () => Promise.resolve(); event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event); })()`);
    await until(() => evaluate("document.querySelector('#installBanner').dataset.installMode === 'prompt'"));
    await evaluate("document.querySelector('#installButton').click()");
    await until(() => count("pwa_native_accept") === 1);
    assert.equal(count("pwa_install_click"), 1);
    await evaluate("window.dispatchEvent(new Event('appinstalled'))");
    await until(() => count("pwa_installed") === 1);
    assert.equal(count("pwa_visit_no_notice"), 2);
    await call("Page.reload", { ignoreCache: true });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await wait(1400);
    assert.equal(count("pwa_visit_no_notice"), 2, "Reload within the same visit must not add a no-notice visit");

    await evaluate("localStorage.removeItem('buscaSaltoInstalled'); localStorage.setItem('buscaSaltoMetricsLastActivity', String(Date.now() - 31 * 60 * 1000))");
    await call("Page.reload", { ignoreCache: true });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await evaluate(`(() => { const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = () => Promise.resolve(); event.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(event); })()`);
    await evaluate("document.querySelector('#installButton').click()");
    await until(() => count("pwa_native_dismiss") === 1);
    assert.equal(count("pwa_install_click"), 2);

    await call("Page.reload", { ignoreCache: true });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await until(() => evaluate("!document.querySelector('#installBanner').hidden"));
    await evaluate("document.querySelector('#installButton').click()");
    await until(() => count("pwa_install_click") === 3);
    assert.equal(await evaluate("document.querySelector('#installButton').textContent"), "Entendi");
    await evaluate("document.querySelector('#installButton').click()");
    await wait(100);
    assert.equal(count("pwa_install_click"), 3, "Help acknowledgement must not count as a second install click");
    assert.equal(count("pwa_prompt_dismiss"), 1, "Help acknowledgement must not count as rejecting the warning");

    await call("Emulation.setUserAgentOverride", { userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36" });
    await evaluate("sessionStorage.removeItem('buscaSaltoInstallDismissedSession'); localStorage.setItem('buscaSaltoMetricsLastActivity', String(Date.now() - 31 * 60 * 1000))");
    await call("Page.reload", { ignoreCache: true });
    await until(() => evaluate("document.readyState === 'complete' && !!window.BuscaSaltoMetrics"));
    await evaluate("window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))");
    await until(() => evaluate("document.querySelector('#installBanner').dataset.installMode === 'samsung-manual'"));
    await evaluate("document.querySelector('#installButton').click()");
    await until(() => count("pwa_install_click") === 4);
    assert.equal(events.filter((item) => item.event === "pwa_install_click")[3].payload.modo, "samsung-manual");
    assert.equal(count("pwa_installed"), 1, "Manual help must not be reported as a confirmed install");
    await evaluate("Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: () => false }); window.BuscaSaltoMetrics.track('pwa_prompt_dismiss', { modo: 'fallback-test' })");
    await until(() => count("pwa_prompt_dismiss") === 2);
    console.log("PWA metrics UI: prompt, manual and Samsung help, dismiss, no-notice visits, native decisions and install passed.");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 99999, method: "Browser.close" }));
      await wait(300);
    }
    socket?.close();
    chrome.kill();
    await new Promise((resolve) => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); }
      catch (error) { console.warn(`Could not remove Chrome test profile: ${profile}`); }
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
