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
  throw new Error("Timed out waiting for sponsor editor");
}

async function main() {
  const items = [
    { id: "1", nome: "Patrocinador Centro", status: "ativo", ordem: "1", inicio: "2026-10-01", fim: "2026-12-31", link_url: "https://example.com/centro", texto_alt: "Campanha Centro", imagem_url: "", imagem_mobile_1: "" },
    { id: "2", nome: "Loja do Bairro", status: "ativo", ordem: "2", inicio: "2026-10-01", fim: "2026-11-30", link_url: "", texto_alt: "Campanha Bairro", imagem_url: "", imagem_mobile_1: "" },
    { id: "3", nome: "Servicos em Salto", status: "inativo", ordem: "3", inicio: "", fim: "", link_url: "https://example.com/servicos", texto_alt: "Campanha Servicos", imagem_url: "", imagem_mobile_1: "" },
  ];
  let submitted;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (["/admin.html", "/commerce-duplicates.js"].includes(url.pathname)) {
      res.setHeader("Content-Type", url.pathname.endsWith(".html") ? "text/html" : "text/javascript");
      res.end(fs.readFileSync(path.join(root, url.pathname.slice(1))));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/admin/session") res.end(JSON.stringify({ ok: true }));
    else if (url.pathname === "/api/admin/taxonomia") res.end(JSON.stringify({ ok: true, taxonomia: TAXONOMY }));
    else if (url.pathname === "/api/admin/patrocinadores" && req.method === "PUT") {
      let body = "";
      for await (const chunk of req) body += chunk;
      submitted = JSON.parse(body);
      const item = { ...items[0], ...submitted };
      items[0] = item;
      res.end(JSON.stringify({ ok: true, item }));
    } else if (url.pathname === "/api/admin/patrocinadores" && url.searchParams.has("mode")) {
      res.end(JSON.stringify({ ok: true, config: {} }));
    } else if (url.pathname === "/api/admin/patrocinadores") {
      res.end(JSON.stringify({ ok: true, items }));
    } else if (url.pathname === "/api/admin/comercios") {
      res.end(JSON.stringify({ ok: true, items: [], total: 0, hasMore: false }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: "Not mocked" }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-sponsor-layout-"));
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
    await evaluate("switchAdminTab('patrocinadores')");
    await until(() => evaluate("document.querySelectorAll('#sponsorRows .record-card').length === 3"));
    assert.equal(await evaluate("document.querySelectorAll('#sponsorForm [data-adjust-target]').length"), 2);

    for (const [width, height] of [[1440, 900], [1181, 768], [1051, 768], [1024, 768], [601, 844], [390, 844], [320, 700]]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await wait(100);
      await evaluate("setSponsorPane('list')");
      const layout = await evaluate(`(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        listVisible: getComputedStyle(document.querySelector('.sponsor-list-panel')).display !== 'none',
        editorVisible: getComputedStyle(document.querySelector('.sponsor-editor')).display !== 'none'
      }))()`);
      assert.ok(layout.scrollWidth <= layout.viewport + 1, `${width}px horizontal overflow: ${JSON.stringify(layout)}`);
      assert.equal(layout.listVisible, true);
      assert.equal(layout.editorVisible, width > 1180);
      assert.equal(await evaluate("document.querySelector('#sponsorCount').textContent"), "(3)");
      assert.equal(await evaluate("newSponsorTopButton.scrollWidth <= newSponsorTopButton.clientWidth + 1"), true, `${width}px new button text clipped`);
      await screenshot(`${width}-list`);
      await evaluate("document.querySelector('[data-sponsor-id=\"1\"]').click()");
      assert.equal(await evaluate("sponsorId.value"), "1");
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.sponsor-editor')).display !== 'none'"), true);
      const controlsFit = await evaluate(`(() => {
        const group = document.querySelector('.sponsor-view .media-group').getBoundingClientRect();
        return [...document.querySelectorAll('.sponsor-view .media-group:first-of-type input, .sponsor-view .media-group:first-of-type button')]
          .every((control) => control.getBoundingClientRect().right <= group.right + 1);
      })()`);
      assert.equal(controlsFit, true, `${width}px banner controls overflow`);
      await screenshot(`${width}-editor`);
      if (width <= 1180) {
        await evaluate("document.querySelector('#returnToSponsorList').click()");
        assert.equal(await evaluate("sponsorLayout.dataset.sponsorPane"), "list");
        await evaluate("document.querySelector('#newSponsorTopButton').click()");
        assert.equal(await evaluate("sponsorId.value"), "");
        assert.equal(await evaluate("sponsorLayout.dataset.sponsorPane"), "editor");
      }
    }
    await evaluate("document.querySelector('[data-sponsor-id=\"1\"]').click(); document.querySelector('#sponsorForm [name=\"ordem\"]').value = '4'; document.querySelector('#saveSponsorTopButton').click()");
    await until(() => submitted?.ordem === "4");
    assert.equal(submitted.nome, "Patrocinador Centro");
    assert.equal(submitted.link_url, "https://example.com/centro");
    assert.equal(submitted.inicio, "2026-10-01");
    assert.equal(submitted.texto_alt, "Campanha Centro");
    await until(() => evaluate("document.querySelector('#sponsorEditorStatus').textContent === 'Patrocinador salvo.'"));
    assert.equal(await evaluate("document.querySelector('#sponsorForm [name=\"ordem\"]').value"), "4");
    console.log("Sponsor layout UI: desktop/mobile panes, save, status and overflow passed.");
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
