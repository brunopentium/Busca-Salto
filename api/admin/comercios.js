const { requireAdminSession } = require("../_lib/admin-auth");
const { cleanText, json, readJsonBody } = require("../_lib/http");
const { adminSearchMatches, appendCommerce, normalizeSearchText, readAdminSheetRows, updateCommerce } = require("../_lib/sheets-admin");

function parsePositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function filterRows(rows, query) {
  const busca = cleanText(query.busca, 100);
  const status = normalizeSearchText(cleanText(query.status, 30));
  const plano = normalizeSearchText(cleanText(query.plano, 30));

  return rows.filter((row) => {
    if (busca && !adminSearchMatches(row, busca)) return false;
    if (status && normalizeSearchText(row.status) !== status) return false;
    if (plano && normalizeSearchText(row.plano) !== plano) return false;
    return true;
  });
}

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });

  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req, { maxBytes: 32 * 1024 });
      const item = await appendCommerce(body);
      return json(res, 201, { ok: true, item });
    }

    if (req.method === "PUT") {
      const body = await readJsonBody(req, { maxBytes: 32 * 1024 });
      const id = cleanText(req.query.id || body.id, 40);
      const item = await updateCommerce(id, body);
      return json(res, 200, { ok: true, item });
    }

    if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const { headers, rows, updatedAt } = await readAdminSheetRows();
    const filtered = filterRows(rows, req.query);
    const start = (page - 1) * limit;

    return json(res, 200, {
      ok: true,
      headers,
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
      hasMore: start + limit < filtered.length,
      updatedAt,
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-admin",
      event: "admin_comercios_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : "Nao foi possivel processar os comercios.",
    });
  }
};
