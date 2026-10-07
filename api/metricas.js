const { requireAdminSession } = require("./_lib/admin-auth");
const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./_lib/google");

const METRICS_SHEET_NAME = (process.env.GOOGLE_METRICS_SHEET_TAB || "metricas").trim();
const METRICS_HEADERS = ["timestamp", "data", "evento", "path", "payload", "ip", "user_agent"];
const MAX_BODY_BYTES = 2 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_MAX_KEYS = 2000;
const rateLimitStore = new Map();
const ALLOWED_EVENTS = new Set([
  "visit",
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
  let totalBytes = 0;
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error("Payload muito grande.");
    error.statusCode = 413;
    throw error;
  }
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      const error = new Error("Payload muito grande.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    const parseError = new Error("JSON invalido.");
    parseError.statusCode = 400;
    throw parseError;
  }
}

function checkRateLimit(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  let bucket = rateLimitStore.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    rateLimitStore.set(ip, bucket);
  }
  bucket.count += 1;
  if (rateLimitStore.size > RATE_LIMIT_MAX_KEYS) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key);
      if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) break;
    }
    while (rateLimitStore.size > RATE_LIMIT_MAX_KEYS) {
      rateLimitStore.delete(rateLimitStore.keys().next().value);
    }
  }
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX_REQUESTS,
    retryAfter: Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000)),
  };
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
const SAO_PAULO_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: METRICS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function saoPauloParts(date) {
  return Object.fromEntries(SAO_PAULO_FORMATTER.formatToParts(date)
    .filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKeyFor(date) {
  const parts = saoPauloParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
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

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function dateKeyToUtcNoon(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function addDaysKey(dateKey, amount) {
  const date = dateKeyToUtcNoon(dateKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function countDaysInclusive(startKey, endKey) {
  const start = dateKeyToUtcNoon(startKey);
  const end = dateKeyToUtcNoon(endKey);
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

function normalizeDateRange(days, start, end, allStart = "") {
  const safeDays = Math.min(Math.max(Number(days) || 30, 1), 3650);
  const today = dateKeyFor(new Date());
  let endKey = isDateKey(end) ? String(end) : today;
  let startKey = allStart || (isDateKey(start) ? String(start) : addDaysKey(endKey, -(safeDays - 1)));
  if (startKey > endKey) [startKey, endKey] = [endKey, startKey];
  return { startKey, endKey, days: countDaysInclusive(startKey, endKey) };
}

function buildTimeline(startKey, endKey, granularity = "day") {
  if (granularity === "hour_of_day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: String(hour).padStart(2, "0"), label: `${String(hour).padStart(2, "0")}h`, total: 0, events: {},
    }));
  }
  if (granularity === "hour") {
    const buckets = [];
    for (let day = startKey; day <= endKey; day = addDaysKey(day, 1)) {
      for (let hour = 0; hour < 24; hour += 1) {
        const key = `${day}T${String(hour).padStart(2, "0")}`;
        buckets.push({ key, date: key, label: formatShortHour(key), total: 0, events: {} });
      }
    }
    return buckets;
  }
  if (granularity === "month") {
    const buckets = [];
    for (let month = startKey.slice(0, 7); month <= endKey.slice(0, 7);) {
      const [year, number] = month.split("-").map(Number);
      buckets.push({ key: month, label: `${String(number).padStart(2, "0")}/${year}`, total: 0, events: {} });
      const next = new Date(Date.UTC(year, number, 1));
      month = next.toISOString().slice(0, 7);
    }
    return buckets;
  }
  if (granularity === "week") {
    const buckets = [];
    const weekday = (dateKeyToUtcNoon(startKey).getUTCDay() + 6) % 7;
    for (let week = addDaysKey(startKey, -weekday); week <= endKey; week = addDaysKey(week, 7)) {
      buckets.push({ key: week, label: `Semana ${formatShortDate(week)}`, total: 0, events: {} });
    }
    return buckets;
  }
  const buckets = [];
  for (let day = startKey; day <= endKey; day = addDaysKey(day, 1)) {
    buckets.push({ key: day, date: day, label: formatShortDate(day), total: 0, events: {} });
  }
  return buckets;
}

function timelineKeyFor(row, granularity) {
  if (granularity === "hour") return `${row.localDay}T${row.localHour}`;
  if (granularity === "hour_of_day") return row.localHour;
  const day = row.localDay;
  if (granularity === "month") return day.slice(0, 7);
  if (granularity === "week") return addDaysKey(day, -((dateKeyToUtcNoon(day).getUTCDay() + 6) % 7));
  return day;
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function matchesDetail(row, field, query) {
  if (!query) return true;
  const payload = row.payload || {};
  const values = {
    path: row.path,
    busca: payload.busca,
    categoria: payload.categoria,
    bairro: payload.bairro,
    comercio: row.event === "contact_click" ? `${payload.nome || ""} ${payload.id || ""}` : "",
    patrocinador: row.event === "sponsor_click" ? `${payload.nome || ""} ${payload.id || ""}` : "",
  };
  const text = field === "all" ? [row.event, ...Object.values(values), ...Object.values(payload)].join(" ") : values[field] || "";
  return normalizeSearch(text).includes(normalizeSearch(query));
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

function aggregateMetrics(rows = [], options = {}) {
  const parsedRows = rows.map(parseMetricRow).map((row) => {
    const parsedDate = new Date(row.timestamp);
    if (!Number.isFinite(parsedDate.getTime())) return null;
    const parts = saoPauloParts(parsedDate);
    const localDay = `${parts.year}-${parts.month}-${parts.day}`;
    return { ...row, parsedDate, localDay, localHour: parts.hour, localMinute: `${localDay}T${parts.hour}:${parts.minute}` };
  }).filter(Boolean);
  const allStart = options.all && parsedRows.length
    ? parsedRows.reduce((earliest, row) => {
      const key = row.localDay;
      return key < earliest ? key : earliest;
    }, dateKeyFor(new Date())) : "";
  const { startKey, endKey, days } = normalizeDateRange(options.days || 30, options.start, options.end, allStart);
  const requestedGranularity = options.granularity || "day";
  const granularity = requestedGranularity === "auto"
    ? (days <= 2 ? "hour" : days <= 45 ? "day" : days <= 180 ? "week" : "month")
    : requestedGranularity;
  if (granularity === "hour" && days > 7) {
    const error = new Error("Para ver por hora, selecione ate 7 dias. Para periodos maiores, use hora do dia.");
    error.statusCode = 400;
    throw error;
  }
  if (granularity === "day" && days > 730) {
    const error = new Error("Para periodos acima de 2 anos, agrupe por semana ou mes.");
    error.statusCode = 400;
    throw error;
  }
  const now = new Date();
  const today = dateKeyFor(now);
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const timelineBuckets = buildTimeline(startKey, endKey, granularity);
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
  let visits = 0;
  let pageViews = 0;

  const startMinute = `${startKey}T${options.startTime || "00:00"}`;
  const endMinute = `${endKey}T${options.endTime || "23:59"}`;
  const selectedEvent = ALLOWED_EVENTS.has(options.event) ? options.event : "all";
  const selectedField = ["all", "path", "busca", "categoria", "bairro", "comercio", "patrocinador"].includes(options.field) ? options.field : "all";
  const query = cleanText(options.query, 120);
  const metrics = parsedRows
    .filter((row) => {
      return row.localMinute >= startMinute && row.localMinute <= endMinute
        && (selectedEvent === "all" || row.event === selectedEvent)
        && matchesDetail(row, selectedField, query);
    });

  for (const row of metrics) {
    const date = row.parsedDate;
    increment(events, row.event);
    if (row.event === "visit") visits += 1;
    if (row.event === "page_view") {
      pageViews += 1;
      if (row.path) increment(pages, row.path);
    }
    if (row.localDay === today) todayCount += 1;
    if (date >= since7) sevenDaysCount += 1;
    const timelineKey = timelineKeyFor(row, granularity);
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

  const pageSize = Math.min(Math.max(Number(options.pageSize) || 25, 1), 100);
  const pageCount = Math.max(1, Math.ceil(metrics.length / pageSize));
  const page = Math.min(Math.max(Number(options.page) || 1, 1), pageCount);
  const sortedRecords = metrics.slice().sort((a, b) => b.parsedDate - a.parsedDate);

  return {
    periodDays: days,
    period: { start: startKey, end: endKey },
    generatedAt: now.toISOString(),
    summary: {
      total: metrics.length,
      visits,
      pageViews,
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
    records: {
      total: metrics.length,
      page,
      pageSize,
      pageCount,
      items: sortedRecords.slice((page - 1) * pageSize, page * pageSize).map((row) => ({
        timestamp: row.timestamp, event: row.event, path: row.path, payload: safePayload(row.payload),
      })),
    },
    recent: sortedRecords.slice(0, 12).map((row) => ({
      timestamp: row.timestamp, event: row.event, path: row.path, payload: safePayload(row.payload),
    })),
  };
}

async function readMetrics(options) {
  await ensureMetricsSheet();
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: metricsRange("A2:G"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  return aggregateMetrics(response.data.values || [], options);
}

async function handlePost(req, res) {
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader("Retry-After", String(rateLimit.retryAfter));
    return json(res, 429, { ok: false, error: "Muitas requisicoes. Tente novamente em instantes." });
  }
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
    if (error.statusCode) return json(res, error.statusCode, { ok: false, error: error.message });
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
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 1), 3650);
  const granularity = ["auto", "hour", "day", "week", "month", "hour_of_day"].includes(req.query.granularity) ? req.query.granularity : "day";
  const start = isDateKey(req.query.start) ? String(req.query.start) : "";
  const end = isDateKey(req.query.end) ? String(req.query.end) : "";
  const validTime = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
  try {
    return json(res, 200, { ok: true, metrics: await readMetrics({
      days, granularity, start, end, all: req.query.all === "1",
      startTime: validTime(req.query.startTime, "00:00"), endTime: validTime(req.query.endTime, "23:59"),
      event: cleanText(req.query.event, 40), field: cleanText(req.query.field, 40), query: cleanText(req.query.query, 120),
      page: Number.parseInt(req.query.page || "1", 10), pageSize: Number.parseInt(req.query.pageSize || "25", 10),
    }) });
  } catch (error) {
    if (error.statusCode) return json(res, error.statusCode, { ok: false, error: error.message });
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
module.exports.aggregateMetrics = aggregateMetrics;
