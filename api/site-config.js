const { json } = require("./_lib/http");
const { readSiteConfigPublic } = require("./_lib/site-config");

let cache = { loadedAt: 0, config: null };
const CACHE_TTL_MS = 30 * 1000;

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  try {
    const now = Date.now();
    if (!cache.config || now - cache.loadedAt > CACHE_TTL_MS) {
      cache = {
        loadedAt: now,
        config: await readSiteConfigPublic(),
      };
    }

    return json(res, 200, { ok: true, config: cache.config, updatedAt: new Date(cache.loadedAt).toISOString() }, {
      cacheControl: "public, max-age=30",
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-api",
      event: "site_config_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 200, { ok: true, config: { logo: { url: "", ajuste: {} }, banner: { url: "", ajuste: {} } } });
  }
};
