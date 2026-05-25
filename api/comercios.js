const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;
const CONTACT_TYPES = new Set(["whatsapp", "telefone", "instagram", "facebook", "site"]);
const SPREADSHEET_ID = (process.env.GOOGLE_SHEETS_ID || "1s-Wi8ej_y5YisIg2GWh7LlwyLsCpf_YwefotX1ct3dA").trim();
const SHEET_NAME = (process.env.GOOGLE_SHEETS_TAB || "base_interna").trim();
const RANGE = `${SHEET_NAME}!A1:T`;
const RANDOM_BUCKET_MS = 5 * 60 * 1000;

let cache = { loadedAt: 0, rows: [] };

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(JSON.stringify(body));
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeHeader(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function cleanParam(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function requireEnv() {
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error("Google credentials are not configured.");
  return { email, key: key.replace(/\\n/g, "\n") };
}

async function getSheetsClient() {
  const { google } = require("googleapis");
  const credentials = requireEnv();
  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function normalizePlan(plan = "") {
  const normalized = normalize(plan);
  if (normalized === "top") return "top";
  if (normalized === "destaque") return "destaque";
  if (normalized === "parceiro") return "parceiro";
  return "gratuito";
}

function allowsImage(plan) {
  return normalizePlan(plan) !== "gratuito";
}

function allowsOffer(plan) {
  const normalized = normalizePlan(plan);
  return normalized === "destaque" || normalized === "top";
}

function truncateText(value = "", maxLength = 160) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function seededRandom(input = "") {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function qualityScore(item) {
  let score = 0;
  if (item.nome) score += 10;
  if (item.categoria) score += 8;
  if (item.subcategoria) score += 6;
  if (item.bairro) score += 8;
  if (item.endereco) score += 8;
  if (item.whatsapp) score += 10;
  else if (item.telefone) score += 8;
  if (item.descricao) score += 8;
  if (item.palavras_chave) score += 6;

  const digitalSignals = [item.instagram, item.facebook, item.site].filter(Boolean).length;
  score += Math.min(digitalSignals * 2, 6);

  if (allowsImage(item.tipo_exibicao) && item.foto_url) score += 6;
  if (allowsOffer(item.tipo_exibicao) && item.oferta) score += 6;
  if (normalize(item.verificado) === "sim") score += 8;
  return score;
}

function rowToObject(headers, row, index) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[normalizeHeader(header)] = String(row[index] || "").trim();
  });
  const plan = normalizePlan(raw.plano || raw.tipo_exibicao);
  return {
    id: raw.id || String(index + 1),
    nome: raw.nome,
    categoria: raw.categoria,
    subcategoria: raw.subcategoria,
    bairro: raw.bairro,
    endereco: raw.endereco,
    whatsapp: raw.whatsapp,
    instagram: raw.instagram,
    site: raw.site,
    descricao: raw.descricao,
    palavras_chave: raw.palavras_chave,
    facebook: raw.facebook,
    telefone: raw.telefone,
    tipo_exibicao: plan,
    oferta: raw.oferta,
    foto_url: raw.foto_url || raw.imagem || raw.imagem_url,
    status: raw.status || "ativo",
    prioridade: Number.parseInt(raw.prioridade || "0", 10) || 0,
    verificado: raw.verificado,
  };
}

async function loadRows() {
  const now = Date.now();
  if (cache.rows.length && now - cache.loadedAt < CACHE_TTL_MS) return cache.rows;

  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = response.data.values || [];
  const headers = values[0] || [];
  const rows = values
    .slice(1)
    .map((row, index) => rowToObject(headers, row, index))
    .filter((row) => row.nome && normalize(row.status) === "ativo");

  cache = { loadedAt: now, rows };
  return rows;
}

function publicItem(item) {
  const plan = normalizePlan(item.tipo_exibicao);
  return {
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    subcategoria: item.subcategoria,
    bairro: item.bairro,
    endereco: item.endereco,
    descricao: plan === "gratuito" ? truncateText(item.descricao) : item.descricao,
    palavras_chave: item.palavras_chave,
    tipo_exibicao: plan,
    oferta: allowsOffer(plan) ? item.oferta : "",
    foto_url: allowsImage(plan) ? item.foto_url : "",
    has_whatsapp: Boolean(item.whatsapp),
    has_telefone: Boolean(item.telefone),
    has_instagram: Boolean(item.instagram),
    has_facebook: Boolean(item.facebook),
    has_site: Boolean(item.site),
  };
}

function planWeight(plan = "") {
  const normalized = normalizePlan(plan);
  if (normalized === "top") return 220;
  if (normalized === "destaque") return 140;
  if (normalized === "parceiro") return 80;
  return 0;
}

function computeScore(item, terms) {
  const fields = {
    nome: normalize(item.nome),
    categoria: normalize(item.categoria),
    subcategoria: normalize(item.subcategoria),
    bairro: normalize(item.bairro),
    descricao: normalize(item.descricao),
    palavras: normalize(item.palavras_chave),
  };
  let relevance = 0;
  for (const term of terms) {
    if (fields.nome.includes(term)) relevance += 60;
    if (fields.categoria.includes(term)) relevance += 50;
    if (fields.subcategoria.includes(term)) relevance += 40;
    if (fields.palavras.includes(term)) relevance += 35;
    if (fields.descricao.includes(term)) relevance += 20;
    if (fields.bairro.includes(term)) relevance += 10;
  }
  const base = planWeight(item.tipo_exibicao) + item.prioridade * 20 + qualityScore(item);
  if (!terms.length) return base;
  return relevance ? relevance + base : 0;
}

function sortItems(items, terms, seed) {
  return items
    .map((item) => ({
      item,
      score: computeScore(item, terms),
      random: normalizePlan(item.tipo_exibicao) === "gratuito" ? seededRandom(`${seed}:${item.id}:${item.nome}`) : 0,
    }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.random !== a.random) return b.random - a.random;
      return String(a.item.nome || "").localeCompare(String(b.item.nome || ""), "pt-BR");
    })
    .map(({ item }) => item);
}

function buildFilters(rows) {
  return {
    categorias: [...new Set(rows.map((row) => row.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    bairros: [...new Set(rows.map((row) => row.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

function contactValue(item, type) {
  if (type === "whatsapp") return item.whatsapp;
  if (type === "telefone") return item.telefone;
  if (type === "instagram") return item.instagram;
  if (type === "facebook") return item.facebook;
  if (type === "site") return item.site;
  return "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Metodo nao permitido." });

  try {
    const mode = cleanParam(req.query.mode, 20);
    const rows = await loadRows();

    if (mode === "filters") {
      return json(res, 200, { filters: buildFilters(rows), updatedAt: new Date(cache.loadedAt).toISOString() });
    }

    if (mode === "contact") {
      const id = cleanParam(req.query.id, 30);
      const type = normalize(cleanParam(req.query.tipo, 20));
      if (!id || !CONTACT_TYPES.has(type)) return json(res, 400, { error: "Contato invalido." });
      const item = rows.find((row) => String(row.id) === id);
      if (!item) return json(res, 404, { error: "Comercio nao encontrado." });
      return json(res, 200, { id: item.id, tipo: type, valor: contactValue(item, type) || "" });
    }

    const busca = cleanParam(req.query.busca, 80);
    const categoria = cleanParam(req.query.categoria, 80);
    const bairro = cleanParam(req.query.bairro, 80);
    const seed = cleanParam(req.query.seed, 80) || String(Math.floor(Date.now() / RANDOM_BUCKET_MS));
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const terms = normalize(busca).split(/\s+/).filter(Boolean);
    const hasRefinement = Boolean(busca || categoria || bairro);
    const effectivePage = hasRefinement ? page : 1;

    let filtered = rows.filter((item) => (!categoria || item.categoria === categoria) && (!bairro || item.bairro === bairro));
    filtered = sortItems(filtered, terms, seed);

    const total = filtered.length;
    const start = (effectivePage - 1) * limit;
    const items = filtered.slice(start, start + limit).map(publicItem);
    return json(res, 200, {
      items,
      total,
      page: effectivePage,
      limit,
      hasMore: hasRefinement && start + limit < total,
      seed,
      updatedAt: new Date(cache.loadedAt).toISOString(),
    });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Nao foi possivel carregar os dados agora." });
  }
};
