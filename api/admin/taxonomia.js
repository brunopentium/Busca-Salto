const { requireAdminSession } = require("../_lib/admin-auth");
const { json } = require("../_lib/http");
const { TAXONOMY } = require("../_lib/taxonomy");

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  return json(res, 200, {
    ok: true,
    taxonomia: TAXONOMY,
  });
};
