const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TAXONOMY } = require("../api/_lib/taxonomy");
const { mergeTaxonomy } = require("../api/_lib/taxonomy-store");

const chromePath = process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome");
const html = fs.readFileSync(path.join(__dirname, "..", "admin.html"));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for taxonomy UI");
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
  const additions = [];
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/admin.html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/api/admin/session") {
      res.end(JSON.stringify({ ok: true }));
    } else if (pathname === "/api/admin/taxonomia" && req.method === "GET") {
      res.end(JSON.stringify({ ok: true, taxonomia: mergeTaxonomy(additions) }));
    } else if (pathname === "/api/admin/taxonomia" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const item = JSON.parse(body);
      additions.push([item.categoria, item.subcategoria || ""]);
      res.end(JSON.stringify({ ok: true, taxonomia: mergeTaxonomy(additions) }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: "Not mocked" }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-taxonomy-"));
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
    const metrics = async (width) => call("Emulation.setDeviceMetricsOverride", {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 680,
    });

    await metrics(1280);
    await call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/admin.html` });
    await until(() => evaluate("document.querySelector('#adminPanel')?.classList.contains('active')"));
    await evaluate("document.querySelector('[data-admin-tab=categorias]').click()");
    await until(() => evaluate("document.querySelectorAll('#taxonomyList details').length === 16"));
    assert.equal(await evaluate("document.querySelector('#taxonomyCount').textContent"), "16 categorias · 191 subcategorias");
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    if (process.argv.includes("--screenshots")) {
      const shot = await call("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(os.tmpdir(), "busca-salto-taxonomy-desktop.png"), Buffer.from(shot.data, "base64"));
    }

    await evaluate(`(() => { const form = document.querySelector('#categoryCreateForm'); form.elements.categoria.value = 'Saúde da Mulher'; form.requestSubmit(); })()`);
    await until(() => evaluate("document.querySelector('#taxonomyStatus').textContent === 'Categoria adicionada.'"));
    assert.equal(await evaluate("document.querySelector('#taxonomyParentCategory').value"), "Saúde da Mulher");
    await evaluate(`(() => { const form = document.querySelector('#subcategoryCreateForm'); form.elements.subcategoria.value = 'Ginecologia'; form.requestSubmit(); })()`);
    await until(() => evaluate("document.querySelector('#taxonomyStatus').textContent === 'Subcategoria adicionada.'"));
    assert.equal(await evaluate("document.querySelector('#taxonomyCount').textContent"), "17 categorias · 192 subcategorias");
    assert.equal(await evaluate("[...document.querySelectorAll('#categoriaSelect option')].some((item) => item.value === 'Saúde da Mulher')"), true);

    await metrics(390);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    assert.equal(await evaluate("(() => { const a = document.querySelector('#categoryCreateForm').getBoundingClientRect(); const b = document.querySelector('#subcategoryCreateForm').getBoundingClientRect(); return b.top >= a.bottom; })()"), true);
    if (process.argv.includes("--screenshots")) {
      const shot = await call("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(os.tmpdir(), "busca-salto-taxonomy-mobile.png"), Buffer.from(shot.data, "base64"));
    }
    console.log("Admin taxonomy UI: desktop, mobile, category and subcategory forms passed.");
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
