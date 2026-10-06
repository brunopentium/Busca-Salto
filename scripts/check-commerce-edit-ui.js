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
    const result = await check();
    if (result) return result;
    await wait(50);
  }
  throw new Error("Timed out waiting for commerce editor");
}

async function main() {
  let item = {
    id: "108", nome: "Palma de Ouro Dedetizadora", categoria: "Casa e Construção",
    subcategoria: "Dedetização; Limpeza de Caixas D'água", endereco: "Salto - SP",
    telefone: "", plano: "gratuito", status: "ativo", prioridade: "0", verificado: "não",
    rowNumber: 109,
  };
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
    else if (url.pathname === "/api/admin/patrocinadores") res.end(JSON.stringify({ ok: true, config: {} }));
    else if (url.pathname === "/api/admin/comercios" && req.method === "PUT") {
      let body = "";
      for await (const chunk of req) body += chunk;
      submitted = JSON.parse(body);
      item = { ...item, ...submitted };
      res.end(JSON.stringify({ ok: true, item }));
    } else if (url.pathname === "/api/admin/comercios") {
      res.end(JSON.stringify({ ok: true, items: [item], total: 1, hasMore: false }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, error: "Not mocked" }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-edit-"));
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
    await call("Page.enable");
    await call("Runtime.enable");
    await call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/admin.html` });
    await until(() => evaluate("document.querySelector('#adminPanel')?.classList.contains('active')"));
    await evaluate("switchAdminTab('comercios')");
    await until(() => evaluate("!!document.querySelector('[data-edit-id=\"108\"]')"));
    await evaluate("document.querySelector('[data-edit-id=\"108\"]').click()");
    assert.equal(await evaluate("document.querySelector('#commerceForm [name=\"telefone\"]').value"), "");
    await evaluate(`(() => {
      const form = document.querySelector('#commerceForm');
      form.elements.telefone.value = '+55 (11) 4028-0000';
      document.querySelector('#saveCommerceTopButton').click();
    })()`);
    await until(() => submitted?.telefone === "+55 (11) 4028-0000");
    await until(() => evaluate("document.querySelector('#panelStatus').textContent.includes('Cadastro salvo na planilha.')"));
    assert.equal(await evaluate("document.querySelector('#commerceEditorStatus').textContent"), "Cadastro salvo na planilha.");
    assert.equal(await evaluate("document.querySelector('#commerceForm [name=\"telefone\"]').value"), item.telefone);
    await evaluate("document.querySelector('#newCommerceButton').click(); document.querySelector('[data-edit-id=\"108\"]').click()");
    assert.equal(await evaluate("document.querySelector('#commerceForm [name=\"telefone\"]').value"), item.telefone);
    console.log("Commerce editor UI: phone submitted, saved response shown and re-edit passed.");
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
