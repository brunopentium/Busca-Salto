const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig, sheetRange } = require("./google");
const { normalizeCommerceCategoryFields } = require("./taxonomy");
const { readTaxonomy } = require("./taxonomy-store");
const { unconfirmedDuplicates } = require("../../commerce-duplicates");

const COMMERCE_EXTRA_HEADERS = [
  "foto_url",
  "foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5",
  "foto_ajuste", "foto_ajuste_2", "foto_ajuste_3", "foto_ajuste_4", "foto_ajuste_5",
  "fonte_url", "data_verificacao",
];
const COMMERCE_CONTENT_KEYS = new Set([
  "id", "nome", "categoria", "subcategoria", "bairro", "endereco", "whatsapp", "instagram", "site",
  "descricao", "palavras_chave", "facebook", "telefone", "oferta", "foto_url", "imagem", "imagem_url",
  "foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5",
  "foto_ajuste", "foto_ajuste_2", "foto_ajuste_3", "foto_ajuste_4", "foto_ajuste_5",
  "fonte_url", "data_verificacao",
]);
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

function rowHasCommerceContent(headers, row = []) {
  return headers.some((header, index) => {
    const key = headerKey(header, index);
    return COMMERCE_CONTENT_KEYS.has(key) && String(row[index] || "").trim();
  });
}

function lastCommerceRowNumber(values = [], headers = [], headerIndex = 0) {
  for (let index = values.length - 1; index > headerIndex; index -= 1) {
    if (rowHasCommerceContent(headers, values[index])) return index + 1;
  }
  return headerIndex + 1;
}

async function getSheetProperties(sheets, spreadsheetId, sheetName) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties(rowCount))",
  });
  const sheet = (metadata.data.sheets || []).find((item) => item.properties?.title === sheetName);
  return sheet?.properties || null;
}

async function ensureSheetRowCapacity(sheets, spreadsheetId, sheetName, minRows) {
  const properties = await getSheetProperties(sheets, spreadsheetId, sheetName);
  if (typeof properties?.sheetId !== "number") return;

  const rowCount = properties.gridProperties?.rowCount || 0;
  if (rowCount >= minRows) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        appendDimension: {
          sheetId: properties.sheetId,
          dimension: "ROWS",
          length: Math.max(minRows - rowCount, 100),
        },
      }],
    },
  });
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

function parseImageAdjust(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function commerceImageAdjustments(raw = {}) {
  return [
    raw.foto_ajuste || "",
    raw.foto_ajuste_2 || "",
    raw.foto_ajuste_3 || "",
    raw.foto_ajuste_4 || "",
    raw.foto_ajuste_5 || "",
  ].map(parseImageAdjust);
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
    prioridade: raw.prioridade || "0",
    oferta: raw.oferta || "",
    foto_url: raw.foto_url || raw.imagem || raw.imagem_url || "",
    foto_url_2: raw.foto_url_2 || "",
    foto_url_3: raw.foto_url_3 || "",
    foto_url_4: raw.foto_url_4 || "",
    foto_url_5: raw.foto_url_5 || "",
    foto_ajuste: raw.foto_ajuste || "",
    foto_ajuste_2: raw.foto_ajuste_2 || "",
    foto_ajuste_3: raw.foto_ajuste_3 || "",
    foto_ajuste_4: raw.foto_ajuste_4 || "",
    foto_ajuste_5: raw.foto_ajuste_5 || "",
    fotos: commerceImageUrls(raw),
    foto_ajustes: commerceImageAdjustments(raw),
    verificado: raw.verificado || "não",
    fonte_url: raw.fonte_url || "",
    data_verificacao: raw.data_verificacao || "",
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
  }).filter((row) => rowHasCommerceContent(headers, row.values));

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

function sanitizeImageAdjustment(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return "";
  }
  if (!parsed || typeof parsed !== "object") return "";
  const allowedFits = new Set(["cover", "contain", "width", "height"]);
  const fit = allowedFits.has(String(parsed.fit || "")) ? String(parsed.fit) : "cover";
  const zoomNumber = Number.parseFloat(parsed.zoom);
  const xNumber = Number.parseFloat(parsed.x);
  const yNumber = Number.parseFloat(parsed.y);
  const zoom = Math.min(Math.max(Number.isFinite(zoomNumber) ? zoomNumber : 1, 1), 3);
  const x = Math.min(Math.max(Number.isFinite(xNumber) ? xNumber : 50, 0), 100);
  const y = Math.min(Math.max(Number.isFinite(yNumber) ? yNumber : 50, 0), 100);
  return JSON.stringify({
    fit,
    zoom: Number(zoom.toFixed(2)),
    x: Math.round(x),
    y: Math.round(y),
  });
}

function sanitizeCommercePayload(payload = {}, options = {}) {
  const allowedPlans = new Set(["gratuito", "parceiro", "destaque", "top"]);
  const allowedPriorities = new Set(["0", "1", "2", "3"]);
  const allowedStatuses = new Set(["ativo", "inativo"]);
  const plan = normalizeSearchText(payload.plano || payload.tipo_exibicao || "gratuito");
  const status = normalizeSearchText(payload.status || "ativo") || "ativo";
  const prioridade = valueForKey(payload, "prioridade", "0").replace(/[^0-9]/g, "").slice(0, 1) || "0";
  const verificado = normalizeSearchText(valueForKey(payload, "verificado", "não"));
  const now = new Date().toISOString().slice(0, 10);

  const categoryFields = normalizeCommerceCategoryFields({
    categoria: valueForKey(payload, "categoria").slice(0, 80),
    subcategoria: valueForKey(payload, "subcategoria").slice(0, 180),
  }, options.taxonomy);

  const data = {
    id: valueForKey(payload, "id"),
    nome: valueForKey(payload, "nome").slice(0, 140),
    categoria: categoryFields.categoria.slice(0, 80),
    subcategoria: categoryFields.subcategoria.slice(0, 180),
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
    prioridade: allowedPriorities.has(prioridade) ? prioridade : "0",
    status: allowedStatuses.has(status) ? status : "inativo",
    verificado: verificado === "sim" ? "sim" : "não",
    oferta: valueForKey(payload, "oferta").slice(0, 180),
    foto_url: valueForKey(payload, "foto_url").slice(0, 500),
    foto_url_2: valueForKey(payload, "foto_url_2").slice(0, 500),
    foto_url_3: valueForKey(payload, "foto_url_3").slice(0, 500),
    foto_url_4: valueForKey(payload, "foto_url_4").slice(0, 500),
    foto_url_5: valueForKey(payload, "foto_url_5").slice(0, 500),
    foto_ajuste: sanitizeImageAdjustment(valueForKey(payload, "foto_ajuste")),
    foto_ajuste_2: sanitizeImageAdjustment(valueForKey(payload, "foto_ajuste_2")),
    foto_ajuste_3: sanitizeImageAdjustment(valueForKey(payload, "foto_ajuste_3")),
    foto_ajuste_4: sanitizeImageAdjustment(valueForKey(payload, "foto_ajuste_4")),
    foto_ajuste_5: sanitizeImageAdjustment(valueForKey(payload, "foto_ajuste_5")),
    data_atualizacao: valueForKey(payload, "data_atualizacao", now).slice(0, 30),
    fonte_url: valueForKey(payload, "fonte_url").slice(0, 500),
    data_verificacao: valueForKey(payload, "data_verificacao", payload.fonte_url ? now : "").slice(0, 30),
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
    if ((key === "imagem" || key === "imagem_url") && Object.prototype.hasOwnProperty.call(data, "foto_url")) {
      return data.foto_url;
    }
    if (key === "tipo_exibicao" && Object.prototype.hasOwnProperty.call(data, "plano")) return data.plano;
    return existingValues[index] || "";
  });
}

async function appendCommerce(payload) {
  const [item] = await appendCommerces([payload], { requireSource: false, deduplicate: false, forceUnverified: false, validateCategory: false });
  return item;
}

async function appendCommerces(payloads = [], options = {}) {
  if (!Array.isArray(payloads) || payloads.length < 1 || payloads.length > 25) {
    const error = new Error("O lote deve ter entre 1 e 25 comercios.");
    error.statusCode = 400;
    throw error;
  }

  const { spreadsheetId, sheetName } = getSpreadsheetConfig();
  const [current, taxonomy] = await Promise.all([readAdminSheetRows(), readTaxonomy()]);
  const allowedCategories = new Set(taxonomy.map((group) => normalizeSearchText(group.categoria)));
  const dataRows = payloads.map((payload) => sanitizeCommercePayload({
    ...payload,
    ...(options.forceUnverified === false ? {} : { verificado: "nao" }),
  }, { taxonomy }));
  for (const data of dataRows) {
    if (!data.categoria || (options.validateCategory !== false && !allowedCategories.has(normalizeSearchText(data.categoria)))) {
      const error = new Error(`Categoria oficial obrigatoria para ${data.nome}.`);
      error.statusCode = 400;
      throw error;
    }
    let sourceIsValid = false;
    try {
      const source = new URL(data.fonte_url);
      sourceIsValid = ["http:", "https:"].includes(source.protocol) && Boolean(source.hostname);
    } catch (error) {}
    if (options.requireSource !== false && !sourceIsValid) {
      const error = new Error(`Fonte web obrigatoria para ${data.nome}.`);
      error.statusCode = 400;
      throw error;
    }
  }
  const duplicates = options.deduplicate === false ? [] : unconfirmedDuplicates(current.rows,
    dataRows.map((item, index) => ({
      item,
      rowNumber: Number(payloads[index].importRowNumber),
      duplicateOverride: payloads[index].duplicateOverride,
    })));
  if (duplicates.length) {
    const error = new Error("O lote contem comercios ja cadastrados ou repetidos.");
    error.statusCode = 409;
    error.duplicates = [...new Set(duplicates)];
    throw error;
  }

  let nextId = Number.parseInt(nextCommerceId(current.rows), 10);
  const rowValues = dataRows.map((data) => buildRowValues(current.headers, [], { ...data, id: String(nextId++) }));
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const allRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const nextRowNumber = Math.max(lastCommerceRowNumber(
    allRowsResponse.data.values || [],
    current.headers,
    (current.headerRowNumber || 1) - 1,
  ) + 1, (current.headerRowNumber || 1) + 1);
  const lastRowNumber = nextRowNumber + rowValues.length - 1;
  const lastColumn = columnName(current.headers.length - 1);

  await ensureSheetRowCapacity(sheets, spreadsheetId, sheetName, lastRowNumber);
  const properties = await getSheetProperties(sheets, spreadsheetId, sheetName);
  const sourceRowNumber = Math.max((current.headerRowNumber || 1) + 1, nextRowNumber - 1);
  if (typeof properties?.sheetId === "number" && sourceRowNumber !== nextRowNumber) {
    const source = {
      sheetId: properties.sheetId,
      startRowIndex: sourceRowNumber - 1,
      endRowIndex: sourceRowNumber,
      startColumnIndex: 0,
      endColumnIndex: current.headers.length,
    };
    const rowDestinations = rowValues.map((_, index) => ({
      sheetId: properties.sheetId,
      startRowIndex: nextRowNumber + index - 1,
      endRowIndex: nextRowNumber + index,
      startColumnIndex: 0,
      endColumnIndex: current.headers.length,
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: ["PASTE_FORMAT", "PASTE_DATA_VALIDATION"].flatMap((pasteType) => rowDestinations.map((destination) => ({
          copyPaste: { source, destination, pasteType },
        }))),
      },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetRange(`A${nextRowNumber}:${lastColumn}${lastRowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rowValues },
  });

  return dataRows.map((_, index) => ({
    ...rowToAdminObject(current.headers, rowValues[index], nextRowNumber + index - 2),
    rowNumber: nextRowNumber + index,
  }));
}

async function updateCommerce(id, payload) {
  const { spreadsheetId } = getSpreadsheetConfig();
  const [current, taxonomy] = await Promise.all([readAdminSheetRows(), readTaxonomy()]);
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
  }, { requireId: true, taxonomy });
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
  return updateCommerce(id, { status: "inativo" });
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
  appendCommerces,
  buildRowValues,
  deleteCommerce,
  ensureCommerceHeaders,
  findHeaderInfo,
  normalizeSearchText,
  readAdminSheetRows,
  sanitizeCommercePayload,
  updateCommerce,
};
