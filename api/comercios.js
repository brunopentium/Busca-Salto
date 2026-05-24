import { google } from "googleapis";

const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || "1s-Wi8ej_y5YisIg2GWh7LlwyLsCpf_YwefotX1ct3dA";
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB || "base_interna";
const RANGE = `${SHEET_NAME}!A1:T`;

let cache = {
  loadedAt: 0,
  rows: [],
};

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(JSON.stringify(body));
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error("Google credentials are not configured.");
  }
  return {
    email,
    key: key.replace(/\\n/g, "\n"),
  };
}

async function getSheetsClient() {
  const credentials = requireEnv();
  const auth = new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

function rowToObject(headers, row) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[normalizeHeader(header)] = String(row[index] || "").trim();
  });

  return {
    id: raw.id,
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
    tipo_exibicao: raw.plano || "gratuito",
    oferta: raw.oferta,
    foto_url: raw.foto_url,
    status: raw.status || "ativo",
    prioridade: Number.parseInt(raw.prioridade || "0", 10) || 0,
    verificado: raw.verificado,
  };
}

async function loadRows() {
  const now = Date.now();
  if (cache.rows.length && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.rows;
  }

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
    .map((row) => rowToObject(headers, row))
    .filter((row) => row.nome && normalize(row.status) === "ativo");

  cache = { loadedAt: now, rows };
  return rows;
}

function publicItem(item) {
  return {
    id: item.id,
    nome: item.nome,
    categoria: item.categoria,
    subcategoria: item.subcategoria,
    bairro: item.bairro,
    endereco: item.endereco,
    whatsapp: item.whatsapp,
    instagram: item.instagram,
    site: item.site,
    descricao: item.descricao,
    palavras_chave: item.palavras_chave,
    facebook: item.facebook,
    telefone: item.telefone,
    tipo_exibicao: item.tipo_exibicao,
    oferta: item.oferta,
    foto_url: item.foto_url,
  };
}

function planWeight(plan = "") {
  const normalized = normalize(plan);
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

  const base = planWeight(item.tipo_exibicao) + item.prioridade * 20 + (normalize(item.verificado) === "sim" ? 30 : 0);
  if (!terms.length) return base;
  return relevance ? relevance + base + (item.oferta ? 20 : 0) + (item.foto_url ? 15 : 0) : 0;
}

function sortItems(items, terms) {
  return items
    .map((item) => ({ item, score: computeScore(item, terms) }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { error: "Metodo nao permitido." });
    return;
  }

  try {
    const rows = await loadRows();
    const mode = cleanParam(req.query.mode, 20);

    if (mode === "filters") {
      json(res, 200, {
        filters: buildFilters(rows),
        updatedAt: new Date(cache.loadedAt).toISOString(),
      });
      return;
    }

    const busca = cleanParam(req.query.busca, 80);
    const categoria = cleanParam(req.query.categoria, 80);
    const bairro = cleanParam(req.query.bairro, 80);
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const terms = normalize(busca).split(/\s+/).filter(Boolean);

    let filtered = rows.filter((item) => {
      return (!categoria || item.categoria === categoria) && (!bairro || item.bairro === bairro);
    });

    filtered = sortItems(filtered, terms);
    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit).map(publicItem);

    json(res, 200, {
      items,
      total,
      page,
      limit,
      hasMore: start + limit < total,
      updatedAt: new Date(cache.loadedAt).toISOString(),
    });
  } catch (error) {
    console.error(error);
    json(res, 500, {
      error: "Nao foi possivel carregar os dados agora.",
    });
  }
}
