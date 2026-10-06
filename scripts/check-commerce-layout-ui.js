const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TAXONOMY } = require("../api/_lib/taxonomy");

const root = path.join(__dirname, "..");
const chromePath = process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for admin layout");
}

async function main() {
  const items = Array.from({ length: 18 }, (_, index) => ({
    id: String(index + 1), rowNumber: index + 3,
    nome: index === 0 ? "Palma de Ouro Dedetizadora" : `Comercio de exemplo ${index + 1}`,
    categoria: "Casa e Construção", subcategoria: "Dedetização; Limpeza de Caixas D'água",
    bairro: "Centro", endereco: "Rua das Flores, 100 - Salto - SP",
    whatsapp: "(11) 4000-0000", telefone: "(11) 4028-0000",
    plano: "gratuito", status: "ativo", prioridade: "0", verificado: "não",
  }));
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (["/admin.html", "/commerce-duplicates.js"].includes(pathname)) {
      res.setHeader("Content-Type", pathname.endsWith(".html") ? "text/html" : "text/javascript");
      res.end(fs.readFileSync(path.join(root, pathname.slice(1))));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/api/admin/session") res.end(JSON.stringify({ ok: true }));
    else if (pathname === "/api/admin/taxonomia") res.end(JSON.stringify({ ok: true, taxonomia: TAXONOMY }));
    else if (pathname === "/api/admin/comercios") res.end(JSON.stringify({ ok: true, items, total: items.length, hasMore: false }));
    else if (pathname === "/api/admin/patrocinadores") res.end(JSON.stringify({ ok: true, config: {} }));
    else { res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: "Not mocked" })); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-layout-"));
  const chrome = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*",
    `--user-data-dir=${profile}`, "about:blank",
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
    const screenshot = async (name) => {
      if (!process.env.SCREENSHOT_DIR) return;
      fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
      const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR, `${name}.png`), Buffer.from(result.data, "base64"));
    };
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/admin.html` });
    await until(() => evaluate("document.querySelector('#adminPanel')?.classList.contains('active')"));
    await evaluate("switchAdminTab('comercios')");
    await until(() => evaluate("document.querySelectorAll('#commerceRows .record-card').length === 18"));

    for (const [width, height] of [[1440, 900], [1051, 768], [1024, 768], [601, 844], [600, 844], [390, 844], [320, 700]]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await wait(120);
      await evaluate("setCommercePane('list')");
      const layout = await evaluate(`(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        listVisible: getComputedStyle(document.querySelector('.commerce-list-panel')).display !== 'none',
        editorVisible: getComputedStyle(document.querySelector('.commerce-editor')).display !== 'none',
        listWidth: document.querySelector('.commerce-list-panel').getBoundingClientRect().width,
        editorWidth: document.querySelector('.commerce-editor').getBoundingClientRect().width
      }))()`);
      assert.ok(layout.scrollWidth <= layout.viewport + 1, `${width}px horizontal overflow: ${JSON.stringify(layout)}`);
      assert.equal(layout.listVisible, true);
      assert.equal(layout.editorVisible, width > 1050);
      await screenshot(`${width}-list`);
      await evaluate("document.querySelector('[data-edit-id=\"1\"]').click()");
      assert.equal(await evaluate("commerceId.value"), "1");
      const editorVisible = await evaluate("getComputedStyle(document.querySelector('.commerce-editor')).display !== 'none'");
      assert.equal(editorVisible, true);
      const photoControlsFit = await evaluate(`(() => {
        const slot = document.querySelector('.commerce-editor .image-slot').getBoundingClientRect();
        return [...document.querySelectorAll('.commerce-editor .image-slot:first-of-type input, .commerce-editor .image-slot:first-of-type button')]
          .every((control) => control.getBoundingClientRect().right <= slot.right + 1);
      })()`);
      assert.equal(photoControlsFit, true, `${width}px photo controls overflow`);
      await screenshot(`${width}-editor`);
      if (width === 1440 || width === 390) {
        await evaluate("document.querySelector('.commerce-editor .image-slots').scrollIntoView({ block: 'start' })");
        await wait(100);
        await screenshot(`${width}-photos`);
      }
      if (width <= 1050) {
        await evaluate("document.querySelector('#returnToCommerceList').click()");
        assert.equal(await evaluate("commerceLayout.dataset.commercePane"), "list");
        await evaluate("document.querySelector('#newCommerceTopButton').click()");
        assert.equal(await evaluate("commerceId.value"), "");
        assert.equal(await evaluate("commerceLayout.dataset.commercePane"), "editor");
      }
    }
    console.log("Commerce layout UI: desktop/mobile visibility, editing and overflow passed.");
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
