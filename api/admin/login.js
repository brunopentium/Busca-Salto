const { buildSessionCookie, createSessionToken, isAuthConfigured, verifyPassword } = require("../_lib/admin-auth");
const { json, readJsonBody } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  if (!isAuthConfigured()) return json(res, 503, { ok: false, error: "Painel administrativo nao configurado." });

  try {
    const body = await readJsonBody(req, { maxBytes: 4096 });
    if (!verifyPassword(body.password)) return json(res, 401, { ok: false, error: "Senha invalida." });

    res.setHeader("Set-Cookie", buildSessionCookie(req, createSessionToken()));
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel entrar no painel.",
    });
  }
};
