const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");
const chromePath = process.env.CHROME_PATH || (process.platform === "win32"
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "/usr/bin/google-chrome");
const csv = [
  "nome,categoria,subcategoria,bairro,endereco,whatsapp,telefone,instagram,facebook,site,descricao,palavras_chave,oferta,fonte_url,data_verificacao,status,plano",
  'Santa Esfiha Salto,Alimentação,Esfiharia;Pizzaria,Vila Teixeira,"Avenida Dom Pedro II, 1226, Box 230, Salto/SP",,(11) 2840-0053,,,https://santaesfihasalto.alloy.al/santaesfihasalto,Esfihas e pizzas com pedidos online.,"esfiha, pizza, delivery",,https://santaesfihasalto.alloy.al/santaesfihasalto,2026-09-29,ativo,gratuito',
].join("\r\n");
const existing = {
  id: "539", nome: "Santa Esfiha Salto", categoria: "Alimentação", subcategoria: "Esfiharia",
  bairro: "Vila Teixeira", endereco: "Av. Dom Pedro II, 1226, Box 230, Salto/SP",
  telefone: "", site: "", descricao: "Esfiharia em Salto com esfihas e pizzas.",
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await wait(50);
  }
  throw new Error("Timed out waiting for import preview");
}

async function main() {
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/admin.html" || pathname === "/commerce-duplicates.js") {
      res.setHeader("Content-Type", pathname.endsWith(".html") ? "text/html" : "text/javascript");
      res.end(fs.readFileSync(path.join(root, pathname.slice(1))));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (pathname === "/api/admin/session") res.end(JSON.stringify({ ok: true }));
    else if (pathname === "/api/admin/comercios") res.end(JSON.stringify({ ok: true, items: [existing], total: 1 }));
    else if (pathname === "/api/admin/taxonomia") res.end(JSON.stringify({ ok: true, taxonomia: [{ categoria: "Alimentação", subcategorias: ["Esfiharia", "Pizzaria"] }] }));
    else { res.statusCode = 404; res.end(JSON.stringify({ ok: false })); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-import-"));
  const chrome = spawn(chromePath, [
    "--headless=new", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--remote-allow-origins=*", `--user-data-dir=${profile}`, "about:blank",
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
    await until(() => evaluate("typeof prepareCommerceImport === 'function' && !!globalThis.CommerceDuplicates"));
    await until(() => evaluate("document.querySelector('#adminPanel').classList.contains('active')"));
    await evaluate(`(async () => {
      switchAdminTab('importacao');
      taxonomia = [{ categoria: 'Alimentação', subcategorias: ['Esfiharia', 'Pizzaria'] }];
      await prepareCommerceImport(new File([${JSON.stringify(csv)}], 'lote.csv', { type: 'text/csv' }));
    })()`);
    const preview = await evaluate("document.querySelector('#commerceImportPreview').innerText");
    assert.match(preview, /Cadastro #539: Santa Esfiha Salto/);
    assert.match(preview, /Dados para complementar:/);
    assert.match(preview, /Telefone: \(11\) 2840-0053/);
    assert.match(preview, /Site: https:\/\/santaesfihasalto/);
    assert.equal(await evaluate("document.querySelector('[data-import-index]').disabled"), true);
    assert.equal(await evaluate("document.querySelector('#commitCommerceImport').disabled"), true);
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 850, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), true);
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.import-table tr')).display"), "grid");
    if (process.argv.includes("--screenshots")) {
      await evaluate("document.querySelector('#commerceImportPreview').scrollIntoView({ block: 'start' })");
      const shot = await call("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(path.join(os.tmpdir(), "busca-salto-import-mobile.png"), Buffer.from(shot.data, "base64"));
    }
    await evaluate("document.querySelector('[data-import-edit]').click()");
    assert.equal(await evaluate("document.querySelector('#commerceId').value"), "539");
    console.log("Admin import preview: duplicate, enrichment and edit action passed.");
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ id: 99999, method: "Browser.close" }));
      await wait(300);
    }
    socket?.close();
    chrome.kill();
    await new Promise((resolve) => server.close(resolve));
    if (path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
