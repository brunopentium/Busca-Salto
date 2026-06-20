const { requireAdminSession } = require("./_lib/admin-auth");
const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./_lib/google");

const METRICS_SHEET_NAME = (process.env.GOOGLE_METRICS_SHEET_TAB || "metricas").trim();
const METRICS_HEADERS = ["timestamp", "data", "evento", "path", "payload", "ip", "user_agent"];
const ALLOWED_EVENTS = new Set([
  "page_view",
  "search",
  "contact_click",
  "category_select",
  "plan_click",
  "sponsor_click",
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function metricsRange(range = "A1:G") {
  return `${METRICS_SHEET_NAME}!${range}`;
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return firstForwardedIp || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
}

function anonymizeIp(value) {
  const ip = String(value || "").trim();
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length >= 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 4).join(":")}::`;
  }
  return "unknown";
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function ensureMetricsSheet() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties?.title === METRICS_SHEET_NAME);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: METRICS_SHEET_NAME } } }] },
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: metricsRange("A1:G1"),
  }).catch(() => ({ data: { values: [] } }));
  const headers = (headerResponse.data.values || [])[0] || [];

  if (headers.join("|") !== METRICS_HEADERS.join("|")) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: metricsRange("A1:G1"),
      valueInputOption: "RAW",
      requestBody: { values: [METRICS_HEADERS] },
    });
  }
}

function safePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const safe = {};
  for (const [key, value] of Object.entries(source).slice(0, 12)) {
    safe[cleanText(key, 40)] = cleanText(value, 160);
  }
  return safe;
}

async function appendMetric(row) {
  await ensureMetricsSheet();
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: metricsRange("A:G"),
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

function increment(map, key, amount = 1) {
  const safeKey = cleanText(key || "Nao informado", 120) || "Nao informado";
  map.set(safeKey, (map.get(safeKey) || 0) + amount);
}

function topItems(map, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

const METRICS_TIME_ZONE = "America/Sao_Paulo";

function saoPauloParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: METRICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKeyFor(date) {
  const parts = saoPauloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hourKeyFor(date) {
  const parts = saoPauloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
}

function formatShortDate(dateKey) {
  const [, month, day] = String(dateKey).split("-");
  return `${day || ""}/${month || ""}`;
}

function formatShortHour(hourKey) {
  const [datePart, hour] = String(hourKey).split("T");
  const [, month, day] = String(datePart).split("-");
  return `${day || ""}/${month || ""} ${hour || "00"}h`;
}

function buildTimeline(days, granularity = "day") {
  const safeDays = Math.max(days, 1);
  const now = new Date();
  if (granularity === "hour") {
    const hours = safeDays * 24;
    return Array.from({ length: hours }, (_, index) => {
      const date = new Date(now.getTime() - (hours - 1 - index) * 60 * 60 * 1000);
      date.setUTCMinutes(0, 0, 0);
      const key = hourKeyFor(date);
      return { key, date: key, label: formatShortHour(key), total: 0, events: {} };
    });
  }
  return Array.from({ length: safeDays }, (_, index) => {
    const date = new Date(now.getTime() - (safeDays - 1 - index) * 24 * 60 * 60 * 1000);
    const key = dateKeyFor(date);
    return { key, date: key, label: formatShortDate(key), total: 0, events: {} };
  });
}

function parseMetricRow(row = []) {
  let payload = {};
  try {
    payload = JSON.parse(row[4] || "{}");
  } catch (error) {
    payload = {};
  }
  return {
    timestamp: row[0] || "",
    date: row[1] || "",
    event: row[2] || "",
    path: row[3] || "",
    payload,
    ip: row[5] || "",
    userAgent: row[6] || "",
  };
}

function aggregateMetrics(rows = [], days = 30, granularity = "day") {
  const now = new Date();
  const today = dateKeyFor(now);
  const since = new Date(now.getTime() - Math.max(days, 1) * 24 * 60 * 60 * 1000);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const timelineBuckets = buildTimeline(days, granularity);
  const timelineIndex = new Map(timelineBuckets.map((bucket) => [bucket.key, bucket]));

  const events = new Map();
  const pages = new Map();
  const searchTerms = new Map();
  const categories = new Map();
  const bairros = new Map();
  const contactTypes = new Map();
  const contactBusinesses = new Map();
  const sponsors = new Map();
  let todayCount = 0;
  let sevenDaysCount = 0;

  const metrics = rows
    .map(parseMetricRow)
    .filter((row) => {
      const date = new Date(row.timestamp);
      return Number.isFinite(date.getTime()) && date >= since;
    });

  for (const row of metrics) {
    const date = new Date(row.timestamp);
    increment(events, row.event);
    if (row.path) increment(pages, row.path);
    if (dateKeyFor(date) === today) todayCount += 1;
    if (date >= since7) sevenDaysCount += 1;
    const timelineKey = granularity === "hour" ? hourKeyFor(date) : dateKeyFor(date);
    if (timelineIndex.has(timelineKey)) {
      const bucket = timelineIndex.get(timelineKey);
      bucket.total += 1;
      bucket.events[row.event] = (bucket.events[row.event] || 0) + 1;
    }

    if (row.event === "search") {
      if (row.payload.busca) increment(searchTerms, row.payload.busca);
      if (row.payload.categoria) increment(categories, row.payload.categoria);
      if (row.payload.bairro) increment(bairros, row.payload.bairro);
    }
    if (row.event === "category_select" && row.payload.categoria) increment(categories, row.payload.categoria);
    if (row.event === "contact_click") {
      increment(contactTypes, row.payload.tipo);
      increment(contactBusinesses, row.payload.nome || row.payload.id);
    }
    if (row.event === "sponsor_click") increment(sponsors, row.payload.nome || row.payload.id);
  }

  return {
    periodDays: days,
    generatedAt: now.toISOString(),
    summary: {
      total: metrics.length,
      today: todayCount,
      sevenDays: sevenDaysCount,
      events: topItems(events, 12),
    },
    pages: topItems(pages, 8),
    searches: {
      terms: topItems(searchTerms, 10),
      categories: topItems(categories, 10),
      bairros: topItems(bairros, 10),
    },
    contacts: {
      types: topItems(contactTypes, 8),
      businesses: topItems(contactBusinesses, 10),
    },
    sponsors: topItems(sponsors, 10),
    timeline: {
      granularity,
      events: ["all", ...ALLOWED_EVENTS],
      daily: timelineBuckets,
    },
    recent: metrics.slice(-12).reverse(),
  };
}

async function readMetrics(days, granularity) {
  await ensureMetricsSheet();
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: metricsRange("A1:G20000"),
    valueRenderOption: "FORMATTED_VALUE",
  }).catch(() => ({ data: { values: [] } }));
  return aggregateMetrics((response.data.values || []).slice(1), days, granularity);
}

async function handlePost(req, res) {
  try {
    const body = await readBody(req);
    const event = cleanText(body.event, 40);
    if (!ALLOWED_EVENTS.has(event)) return json(res, 400, { ok: false });

    const payload = safePayload(body.payload);
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      timestamp.slice(0, 10),
      event,
      cleanText(body.path, 120),
      JSON.stringify(payload),
      anonymizeIp(getClientIp(req)),
      cleanText(req.headers["user-agent"], 180),
    ];

    console.log(JSON.stringify({
      level: "info",
      service: "busca-salto-metricas",
      event,
      path: row[3],
      payload,
      ip: row[5],
      userAgent: row[6],
      timestamp,
    }));

    let stored = true;
    try {
      await appendMetric(row);
    } catch (error) {
      stored = false;
      console.warn(JSON.stringify({
        level: "warn",
        service: "busca-salto-metricas",
        event: "metric_store_error",
        message: error?.message || "Erro desconhecido",
        timestamp: new Date().toISOString(),
      }));
    }

    return json(res, 200, { ok: true, stored });
  } catch (error) {
    console.error(JSON.stringify({
      level: "warn",
      service: "busca-salto-metricas",
      event: "metric_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 200, { ok: false });
  }
}

async function handleGet(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 1), 180);
  const granularity = String(req.query.granularity || "day") === "hour" ? "hour" : "day";
  try {
    return json(res, 200, { ok: true, metrics: await readMetrics(days, granularity) });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-metricas",
      event: "metric_report_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 500, { ok: false, error: "Nao foi possivel carregar os indicadores." });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") return handlePost(req, res);
  if (req.method === "GET") return handleGet(req, res);
  return json(res, 405, { ok: false });
};
