const ALLOWED_EVENTS = new Set([
  "page_view",
  "search",
  "contact_click",
  "category_select",
  "plan_click",
]);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return firstForwardedIp || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });

  try {
    const body = await readBody(req);
    const event = cleanText(body.event, 40);
    if (!ALLOWED_EVENTS.has(event)) return json(res, 400, { ok: false });

    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    const safePayload = {};
    for (const [key, value] of Object.entries(payload).slice(0, 12)) {
      safePayload[cleanText(key, 40)] = cleanText(value, 160);
    }

    console.log(JSON.stringify({
      level: "info",
      service: "busca-salto-metricas",
      event,
      path: cleanText(body.path, 120),
      payload: safePayload,
      ip: getClientIp(req),
      userAgent: cleanText(req.headers["user-agent"], 180),
      timestamp: new Date().toISOString(),
    }));

    return json(res, 200, { ok: true });
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
};
