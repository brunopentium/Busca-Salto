const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { aggregateMetrics } = require("../api/metricas");

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
  throw new Error("Timed out waiting for metrics UI");
}

const rows = Array.from({ length: 60 }, (_, index) => [
  `2026-10-06T${String(9 + Math.floor(index / 15)).padStart(2, "0")}:${String(index % 15).padStart(2, "0")}:00-03:00`,
  "2026-10-06", index % 3 === 0 ? "search" : "visit", "/",
  JSON.stringify(index % 3 === 0 ? { busca: "Pastelaria", categoria: "Alimentação" } : {}),
  "127.0.0.0", "browser",
]);

async function main() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (["/admin.html", "/commerce-duplicates.js"].includes(url.pathname)) {
      res.setHeader("Content-Type", url.pathname.endsWith(".html") ? "text/html" : "text/javascript");
      res.end(fs.readFileSync(path.join(root, url.pathname.slice(1))));
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/admin/session") res.end(JSON.stringify({ ok: true }));
    else if (url.pathname === "/api/metricas") {
      const params = Object.fromEntries(url.searchParams);
      res.end(JSON.stringify({ ok: true, metrics: aggregateMetrics(rows, {
        ...params, all: params.all === "1", page: Number(params.page), pageSize: Number(params.pageSize),
      }) }));
    } else { res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: "Not mocked" })); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "busca-salto-metrics-"));
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
    await evaluate("switchAdminTab('indicadores')");
    await until(() => evaluate("document.querySelector('.metric-svg') && document.querySelector('#metricRecords')"));
    assert.equal(await evaluate("document.querySelector('.metric-value').textContent"), "60");
    for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 700]]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      await wait(250);
      const layout = await evaluate(`(() => ({
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        chartWidth: document.querySelector('.metric-svg').getBoundingClientRect().width,
        chartHeight: document.querySelector('.metric-svg').getBoundingClientRect().height,
        field: (() => { const el = document.querySelector('#metricsField'); const parent = el.parentElement; return {
          inputWidth: el.getBoundingClientRect().width, labelWidth: parent.getBoundingClientRect().width,
        }; })(),
        controlsFit: [...document.querySelectorAll('.metrics-filter-group input, .metrics-filter-group select')]
          .every((control) => control.getBoundingClientRect().right <= document.querySelector('.metrics-filters').getBoundingClientRect().right + 1)
      }))()`);
      assert.ok(layout.scrollWidth <= layout.viewport + 1, `${width}px horizontal overflow: ${JSON.stringify(layout)}`);
      assert.ok(layout.controlsFit && layout.chartWidth > 100 && layout.chartHeight > 100, JSON.stringify(layout));
      assert.ok(Math.abs(layout.field.inputWidth - layout.field.labelWidth) <= 1, `${width}px field width: ${JSON.stringify(layout.field)}`);
      await evaluate("document.querySelector('#metricsView').scrollIntoView({block:'start'})");
      await screenshot(`${width}-top`);
      await evaluate("document.querySelector('.metric-chart').scrollIntoView({block:'start'})");
      await screenshot(`${width}-chart`);
    }
    await evaluate("metricsEvent.value = 'search'; metricsField.value = 'busca'; metricsQuery.value = 'pastelaria'; metricsFilters.requestSubmit()");
    await until(() => evaluate("document.querySelector('.metric-value')?.textContent === '20'"));
    assert.equal(await evaluate("document.querySelectorAll('.metric-record-table tbody tr').length"), 20);
    await evaluate("metricsEvent.value = 'all'; metricsField.value = 'all'; metricsQuery.value = ''; metricsFilters.requestSubmit()");
    await until(() => evaluate("document.querySelector('.metric-value')?.textContent === '60'"));
    await evaluate("document.querySelector('[data-metrics-page=\"2\"]').click()");
    await until(() => evaluate("document.querySelector('.metric-records-head span')?.textContent.includes('pagina 2')"));
    await evaluate("metricsGranularity.value = 'hour_of_day'; metricsFilters.requestSubmit()");
    await until(() => evaluate("document.querySelector('.metric-chart-head h3')?.textContent === 'Horarios com mais atividade'"));
    assert.equal(await evaluate("document.querySelectorAll('.metric-data-table tbody tr').length"), 24);
    await evaluate("metricsChartType.value = 'line'; metricsChartType.dispatchEvent(new Event('change'))");
    assert.equal(await evaluate("document.querySelectorAll('.metric-line').length"), 1);
    await evaluate("metricsDays.value = 'all'; metricsDays.dispatchEvent(new Event('change'))");
    await until(() => evaluate("document.querySelector('#metricsFilterStatus').textContent === '' && document.querySelector('.metric-records-head')"));
    assert.equal(await evaluate("metricsStart.disabled && metricsEnd.disabled"), true);
    await evaluate("metricsField.value = 'comercio'; metricsQuery.value = 'Nao existe'; metricsFilters.requestSubmit()");
    await until(() => evaluate("document.querySelector('.metric-value')?.textContent === '0'"));
    assert.equal(await evaluate("document.querySelector('.metric-plot').textContent.includes('Sem eventos neste recorte.')"), true);
    await evaluate("resetMetricsButton.click()");
    await until(() => evaluate("document.querySelector('.metric-value')?.textContent === '60'"));
    assert.equal(await evaluate("metricsDays.value"), "30");
    console.log("Metrics UI: responsive layout, filters, records, pagination and chart grouping passed.");
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
