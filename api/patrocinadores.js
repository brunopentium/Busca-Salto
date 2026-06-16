const { json } = require("./_lib/http");
const { isSponsorActive, publicSponsor, readSponsors } = require("./_lib/sponsors");

let cache = { loadedAt: 0, items: [] };
const CACHE_TTL_MS = 5 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  try {
    const now = Date.now();
    if (!cache.loadedAt || now - cache.loadedAt > CACHE_TTL_MS) {
      const { rows } = await readSponsors();
      cache = {
        loadedAt: now,
        items: rows
          .filter(isSponsorActive)
          .sort((a, b) => a.ordem - b.ordem || String(a.nome).localeCompare(String(b.nome), "pt-BR"))
          .map(publicSponsor),
      };
    }

    return json(res, 200, { ok: true, items: cache.items, updatedAt: new Date(cache.loadedAt).toISOString() }, {
      cacheControl: "public, max-age=120",
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-api",
      event: "sponsors_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 200, { ok: true, items: [] });
  }
};
