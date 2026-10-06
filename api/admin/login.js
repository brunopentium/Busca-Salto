const { buildSessionCookie, createSessionToken, isAuthConfigured, verifyPassword } = require("../_lib/admin-auth");
const { getClientIp, json, readJsonBody } = require("../_lib/http");

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_TRACKED_IPS = 2000;
const failedAttempts = new Map();

function attemptBucket(ip, now) {
  let bucket = failedAttempts.get(ip);
  if (!bucket || now - bucket.startedAt >= LOGIN_WINDOW_MS) {
    bucket = { count: 0, startedAt: now };
    failedAttempts.set(ip, bucket);
  }
  if (failedAttempts.size > MAX_TRACKED_IPS) {
    for (const [key, value] of failedAttempts) {
      if (now - value.startedAt >= LOGIN_WINDOW_MS) failedAttempts.delete(key);
    }
    while (failedAttempts.size > MAX_TRACKED_IPS) {
      failedAttempts.delete(failedAttempts.keys().next().value);
    }
  }
  return bucket;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  if (!isAuthConfigured()) return json(res, 503, { ok: false, error: "Painel administrativo nao configurado." });

  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = attemptBucket(ip, now);
  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    res.setHeader("Retry-After", String(Math.ceil((LOGIN_WINDOW_MS - (now - bucket.startedAt)) / 1000)));
    return json(res, 429, { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." });
  }

  try {
    const body = await readJsonBody(req, { maxBytes: 4096 });
    if (!verifyPassword(body.password)) {
      bucket.count += 1;
      return json(res, 401, { ok: false, error: "Senha invalida." });
    }

    failedAttempts.delete(ip);
    res.setHeader("Set-Cookie", buildSessionCookie(req, createSessionToken()));
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel entrar no painel.",
    });
  }
};
