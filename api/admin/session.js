const { isAuthConfigured, requireAdminSession } = require("../_lib/admin-auth");
const { json } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  if (!isAuthConfigured()) return json(res, 200, { ok: false, configured: false });

  const session = requireAdminSession(req);
  return json(res, 200, {
    ok: session.ok,
    configured: true,
  });
};
