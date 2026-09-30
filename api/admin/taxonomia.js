const { requireAdminSession } = require("../_lib/admin-auth");
const { json, readJsonBody } = require("../_lib/http");
const { addTaxonomyEntry, readTaxonomy } = require("../_lib/taxonomy-store");

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });
  try {
    if (req.method === "GET") return json(res, 200, { ok: true, taxonomia: await readTaxonomy() });
    if (req.method === "POST") {
      const taxonomia = await addTaxonomyEntry(await readJsonBody(req, { maxBytes: 2048 }));
      return json(res, 201, { ok: true, taxonomia });
    }
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-admin",
      event: "admin_taxonomy_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel processar as categorias.",
    });
  }
};
