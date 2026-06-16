function json(res, status, body, options = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", options.cacheControl || "no-store");
  res.end(JSON.stringify(body));
}

async function readJsonBody(req, options = {}) {
  const maxBytes = options.maxBytes || 128 * 1024;
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
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

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return firstForwardedIp || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

module.exports = {
  cleanText,
  getClientIp,
  json,
  readJsonBody,
};
