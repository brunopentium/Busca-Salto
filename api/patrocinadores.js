const { json } = require("./_lib/http");
const { readSiteConfigPublic } = require("./_lib/site-config");
const { isSponsorActive, normalize, normalizeDateValue, publicSponsor, readSponsors } = require("./_lib/sponsors");

let cache = { loadedAt: 0, items: [], config: { logo: { url: "", ajuste: {} }, banner: { url: "", ajuste: {} } } };
const CACHE_TTL_MS = 0;

function sponsorImageCount(sponsor) {
  return (sponsor.imagens_desktop || []).length + (sponsor.imagens_mobile || []).length;
}

function isBetterSponsor(candidate, current) {
  if (!current) return true;
  const imageDiff = sponsorImageCount(candidate) - sponsorImageCount(current);
  if (imageDiff !== 0) return imageDiff > 0;

  const candidateDate = normalizeDateValue(candidate.data_atualizacao);
  const currentDate = normalizeDateValue(current.data_atualizacao);
  if (candidateDate !== currentDate) return candidateDate > currentDate;

  const candidateId = Number.parseInt(candidate.id, 10) || 0;
  const currentId = Number.parseInt(current.id, 10) || 0;
  return candidateId > currentId;
}

function selectPublicSponsors(rows = []) {
  const byName = new Map();
  for (const sponsor of rows.filter(isSponsorActive)) {
    const key = normalize(sponsor.nome) || String(sponsor.id || "");
    const current = byName.get(key);
    if (isBetterSponsor(sponsor, current)) byName.set(key, sponsor);
  }
  return [...byName.values()]
    .sort((a, b) => a.ordem - b.ordem || String(a.nome).localeCompare(String(b.nome), "pt-BR"))
    .map(publicSponsor);
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  try {
    const now = Date.now();
    if (!cache.loadedAt || now - cache.loadedAt > CACHE_TTL_MS) {
      const { rows } = await readSponsors();
      const config = await readSiteConfigPublic().catch(() => ({ logo: { url: "", ajuste: {} }, banner: { url: "", ajuste: {} } }));
      cache = {
        loadedAt: now,
        items: selectPublicSponsors(rows),
        config,
      };
    }

    return json(res, 200, { ok: true, items: cache.items, config: cache.config, updatedAt: new Date(cache.loadedAt).toISOString() }, {
      cacheControl: "no-store, max-age=0",
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-api",
      event: "sponsors_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 200, { ok: true, items: [], config: { logo: { url: "", ajuste: {} }, banner: { url: "", ajuste: {} } } });
  }
};
