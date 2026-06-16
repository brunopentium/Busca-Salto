const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig, sheetRange } = require("./google");

const COMMERCE_EXTRA_HEADERS = ["foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5"];
const REQUIRED_HEADER_KEYS = new Set(["id", "nome", "categoria"]);

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeSearchText(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function headerKey(header, index) {
  const key = normalizeHeader(header);
  if (key) return key;
  return index === 0 ? "id" : `col_${index + 1}`;
}

function columnName(index) {
  let column = "";
  let number = index + 1;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    number = Math.floor((number - 1) / 26);
  }
  return column;
}

function findHeaderInfo(values = []) {
  const headerIndex = values.findIndex((row) => {
    const keys = new Set((row || []).map((header, index) => headerKey(header, index)));
    return [...REQUIRED_HEADER_KEYS].every((key) => keys.has(key));
  });

  if (headerIndex >= 0) {
    return {
      headerIndex,
      headerRowNumber: headerIndex + 1,
      headers: values[headerIndex] || [],
    };
  }

  return {
    headerIndex: 0,
    headerRowNumber: 1,
    headers: values[0] || [],
  };
}

function lastFilledRowNumber(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if ((values[index] || []).some((cell) => String(cell || "").trim())) return index + 1;
  }
  return 1;
}

function commerceImageUrls(raw = {}) {
  return [
    raw.foto_url || raw.imagem || raw.imagem_url || "",
    raw.foto_url_2 || "",
    raw.foto_url_3 || "",
    raw.foto_url_4 || "",
    raw.foto_url_5 || "",
  ].map((url) => String(url || "").trim()).filter(Boolean);
}

function rowToAdminObject(headers, row, index) {
  const raw = {};
  headers.forEach((header, columnIndex) => {
    raw[headerKey(header, columnIndex)] = String(row[columnIndex] || "").trim();
  });

  return {
    rowNumber: index + 2,
    values: row,
    raw,
    id: raw.id || String(index + 1),
    nome: raw.nome || "",
    categoria: raw.categoria || "",
    subcategoria: raw.subcategoria || "",
    bairro: raw.bairro || "",
    endereco: raw.endereco || "",
    whatsapp: raw.whatsapp || "",
    telefone: raw.telefone || "",
    instagram: raw.instagram || "",
    facebook: raw.facebook || "",
    site: raw.site || "",
    descricao: raw.descricao || "",
    palavras_chave: raw.palavras_chave || "",
    plano: raw.plano || raw.tipo_exibicao || "gratuito",
    status: raw.status || "ativo",
    prioridade: raw.prioridade || "",
    oferta: raw.oferta || "",
    foto_url: raw.foto_url || raw.imagem || raw.imagem_url || "",
    foto_url_2: raw.foto_url_2 || "",
    foto_url_3: raw.foto_url_3 || "",
    foto_url_4: raw.foto_url_4 || "",
    foto_url_5: raw.foto_url_5 || "",
    fotos: commerceImageUrls(raw),
    verificado: raw.verificado || "",
  };
}

async function ensureCommerceHeaders() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = response.data.values || [];
  const { headers, headerRowNumber } = findHeaderInfo(values);
  const existing = new Set(headers.map((header, index) => headerKey(header, index)));
  const missing = COMMERCE_EXTRA_HEADERS.filter((header) => !existing.has(header));
  if (!missing.length) return headers;

  const nextHeaders = [...headers, ...missing];
  const lastColumn = columnName(nextHeaders.length - 1);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetRange(`A${headerRowNumber}:${lastColumn}${headerRowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [nextHeaders] },
  });
  return nextHeaders;
}

async function readAdminSheetRows() {
  const { spreadsheetId } = getSpreadsheetConfig();
  await ensureCommerceHeaders();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = response.data.values || [];
  const { headers, headerIndex, headerRowNumber } = findHeaderInfo(values);
  const rows = values.slice(headerIndex + 1).map((row, index) => {
    const item = rowToAdminObject(headers, row, index);
    return { ...item, rowNumber: headerRowNumber + index + 1 };
  });

  return {
    headers,
    headerRowNumber,
    rows,
    updatedAt: new Date().toISOString(),
  };
}

function valueForKey(data, key, fallback = "") {
  if (!Object.prototype.hasOwnProperty.call(data, key)) return fallback;
  return String(data[key] ?? "").trim();
}

function sanitizeCommercePayload(payload = {}, options = {}) {
  const allowedPlans = new Set(["gratuito", "parceiro", "destaque", "top"]);
  const plan = normalizeSearchText(payload.plano || payload.tipo_exibicao || "gratuito");
  const status = normalizeSearchText(payload.status || "ativo") || "ativo";
  const now = new Date().toISOString().slice(0, 10);

  const data = {
    id: valueForKey(payload, "id"),
    nome: valueForKey(payload, "nome").slice(0, 140),
    categoria: valueForKey(payload, "categoria").slice(0, 80),
    subcategoria: valueForKey(payload, "subcategoria").slice(0, 180),
    bairro: valueForKey(payload, "bairro").slice(0, 80),
    endereco: valueForKey(payload, "endereco").slice(0, 180),
    whatsapp: valueForKey(payload, "whatsapp").slice(0, 40),
    instagram: valueForKey(payload, "instagram").slice(0, 120),
    site: valueForKey(payload, "site").slice(0, 180),
    descricao: valueForKey(payload, "descricao").slice(0, 700),
    palavras_chave: valueForKey(payload, "palavras_chave").slice(0, 400),
    facebook: valueForKey(payload, "facebook").slice(0, 180),
    telefone: valueForKey(payload, "telefone").slice(0, 40),
    plano: allowedPlans.has(plan) ? plan : "gratuito",
    prioridade: valueForKey(payload, "prioridade", "0").replace(/[^0-9-]/g, "").slice(0, 5) || "0",
    status: status.slice(0, 40),
    verificado: valueForKey(payload, "verificado").slice(0, 20),
    oferta: valueForKey(payload, "oferta").slice(0, 180),
    foto_url: valueForKey(payload, "foto_url").slice(0, 500),
    foto_url_2: valueForKey(payload, "foto_url_2").slice(0, 500),
    foto_url_3: valueForKey(payload, "foto_url_3").slice(0, 500),
    foto_url_4: valueForKey(payload, "foto_url_4").slice(0, 500),
    foto_url_5: valueForKey(payload, "foto_url_5").slice(0, 500),
    data_atualizacao: valueForKey(payload, "data_atualizacao", now).slice(0, 30),
  };

  if (!data.nome) {
    const error = new Error("Nome do comercio e obrigatorio.");
    error.statusCode = 400;
    throw error;
  }

  if (options.requireId && !data.id) {
    const error = new Error("ID do comercio e obrigatorio.");
    error.statusCode = 400;
    throw error;
  }

  return data;
}

function nextCommerceId(rows) {
  const maxId = rows.reduce((max, row) => {
    const idNumber = Number.parseInt(row.id, 10);
    return Number.isFinite(idNumber) ? Math.max(max, idNumber) : max;
  }, 0);
  return String(maxId + 1);
}

function buildRowValues(headers, existingValues = [], data = {}) {
  return headers.map((header, index) => {
    const key = headerKey(header, index);
    if (Object.prototype.hasOwnProperty.call(data, key)) return data[key];
    if (key === "tipo_exibicao" && Object.prototype.hasOwnProperty.call(data, "plano")) return data.plano;
    return existingValues[index] || "";
  });
}

async function appendCommerce(payload) {
  const { spreadsheetId } = getSpreadsheetConfig();
  const current = await readAdminSheetRows();
  const data = sanitizeCommercePayload({
    ...payload,
    id: payload.id || nextCommerceId(current.rows),
  });
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const values = buildRowValues(current.headers, [], data);
  const allRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const nextRowNumber = Math.max(lastFilledRowNumber(allRowsResponse.data.values || []) + 1, (current.headerRowNumber || 1) + 1);
  const lastColumn = columnName(current.headers.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetRange(`A${nextRowNumber}:${lastColumn}${nextRowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return { ...rowToAdminObject(current.headers, values, current.rows.length), rowNumber: nextRowNumber };
}

async function updateCommerce(id, payload) {
  const { spreadsheetId } = getSpreadsheetConfig();
  const current = await readAdminSheetRows();
  const row = current.rows.find((item) => String(item.id) === String(id));
  if (!row) {
    const error = new Error("Comercio nao encontrado.");
    error.statusCode = 404;
    throw error;
  }

  const data = sanitizeCommercePayload({
    ...row.raw,
    ...payload,
    id: row.id,
  }, { requireId: true });
  const values = buildRowValues(current.headers, row.values, data);
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const lastColumn = columnName(current.headers.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetRange(`A${row.rowNumber}:${lastColumn}${row.rowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });

  return rowToAdminObject(current.headers, values, row.rowNumber - 2);
}

async function deleteCommerce(id) {
  return updateCommerce(id, { status: "excluido" });
}

function adminSearchMatches(row, query = "") {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = normalizeSearchText([
    row.id,
    row.nome,
    row.categoria,
    row.subcategoria,
    row.bairro,
    row.endereco,
    row.whatsapp,
    row.telefone,
    row.instagram,
    row.facebook,
    row.site,
    row.descricao,
    row.palavras_chave,
  ].join(" "));
  return terms.every((term) => haystack.includes(term));
}

module.exports = {
  adminSearchMatches,
  appendCommerce,
  buildRowValues,
  deleteCommerce,
  ensureCommerceHeaders,
  findHeaderInfo,
  normalizeSearchText,
  readAdminSheetRows,
  sanitizeCommercePayload,
  updateCommerce,
};
