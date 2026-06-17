const { requireAdminSession } = require("../_lib/admin-auth");
const { cleanText, json, readJsonBody } = require("../_lib/http");
const { readSiteConfigAdmin, updateSiteConfig } = require("../_lib/site-config");
const { appendSponsor, deleteSponsor, ensureSponsorsSheet, readSponsors, updateSponsor } = require("../_lib/sponsors");

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });

  try {
    if (req.query.mode === "site-config") {
      if (req.method === "GET") {
        const config = await readSiteConfigAdmin();
        return json(res, 200, { ok: true, config });
      }
      if (req.method === "PUT") {
        const config = await updateSiteConfig(await readJsonBody(req, { maxBytes: 16 * 1024 }));
        return json(res, 200, { ok: true, config });
      }
      return json(res, 405, { ok: false, error: "Metodo nao permitido." });
    }

    if (req.method === "POST") {
      const item = await appendSponsor(await readJsonBody(req, { maxBytes: 32 * 1024 }));
      return json(res, 201, { ok: true, item });
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req, { maxBytes: 32 * 1024 });
      const id = cleanText(req.query.id || body.id, 40);
      const item = await updateSponsor(id, body);
      return json(res, 200, { ok: true, item });
    }

    if (req.method === "DELETE") {
      const id = cleanText(req.query.id, 40);
      const item = await deleteSponsor(id);
      return json(res, 200, { ok: true, item });
    }

    if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

    await ensureSponsorsSheet();
    const data = await readSponsors();
    return json(res, 200, { ok: true, items: data.rows, total: data.rows.length, updatedAt: data.updatedAt });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-admin",
      event: "admin_sponsors_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel processar os patrocinadores.",
    });
  }
};
