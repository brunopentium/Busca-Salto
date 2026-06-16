const { buildExpiredSessionCookie } = require("../_lib/admin-auth");
const { json } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  res.setHeader("Set-Cookie", buildExpiredSessionCookie(req));
  return json(res, 200, { ok: true });
};
