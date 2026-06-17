const { requireAdminSession } = require("../_lib/admin-auth");
const { json, readJsonBody } = require("../_lib/http");
const { readSiteConfigAdmin, updateSiteConfig } = require("../_lib/site-config");

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });

  try {
    if (req.method === "GET") {
      const config = await readSiteConfigAdmin();
      return json(res, 200, { ok: true, config });
    }

    if (req.method === "PUT") {
      const config = await updateSiteConfig(await readJsonBody(req, { maxBytes: 16 * 1024 }));
      return json(res, 200, { ok: true, config });
    }

    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-admin",
      event: "admin_site_config_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel salvar a identidade do site.",
    });
  }
};
