const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./google");
const { TAXONOMY, canonicalCategory, canonicalSubcategories, normalizeKey } = require("./taxonomy");

const SHEET_NAME = (process.env.GOOGLE_TAXONOMY_SHEET_TAB || "taxonomia_extra").trim();
const HEADERS = ["categoria", "subcategoria", "data_criacao"];

function range(cells = "A1:C") {
  return `'${SHEET_NAME.replace(/'/g, "''")}'!${cells}`;
}

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function cleanLabel(value, kind) {
  const label = String(value || "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (!label || label.length > 80 || !/\p{L}/u.test(label) || /[\u0000-\u001f;,/|]/u.test(label)) {
    fail(`${kind} invalida. Use um nome de ate 80 caracteres, sem virgula, barra ou ponto e virgula.`);
  }
  return label;
}

function mergeTaxonomy(rows = []) {
  const groups = TAXONOMY.map((group) => ({
    categoria: group.categoria,
    subcategorias: [...group.subcategorias],
  }));
  const byCategory = new Map(groups.map((group) => [normalizeKey(group.categoria), group]));

  for (const row of rows) {
    const category = String(row[0] || "").trim();
    const subcategory = String(row[1] || "").trim();
    const key = normalizeKey(category);
    if (!key) continue;
    let group = byCategory.get(key);
    if (!group) {
      group = { categoria: category, subcategorias: [] };
      groups.push(group);
      byCategory.set(key, group);
    }
    if (subcategory && !group.subcategorias.some((name) => normalizeKey(name) === normalizeKey(subcategory))) {
      group.subcategorias.push(subcategory);
    }
  }

  return groups
    .map((group) => ({
      ...group,
      subcategorias: group.subcategorias.sort((a, b) => a.localeCompare(b, "pt-BR")),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
}

async function sheetProperties(sheets, spreadsheetId) {
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties(rowCount))",
  });
  return (metadata.data.sheets || []).find((sheet) => sheet.properties?.title === SHEET_NAME)?.properties || null;
}

async function readCustomRows(sheets, spreadsheetId, exists) {
  if (!exists) return [];
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: range(),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const values = response.data.values || [];
  if (values.length && HEADERS.some((header, index) => values[0][index] !== header)) {
    fail(`O cabecalho da aba ${SHEET_NAME} foi alterado. Corrija a primeira linha antes de cadastrar categorias.`, 409);
  }
  return values.slice(1);
}

async function readTaxonomy(sheetsClient) {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = sheetsClient || await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const properties = await sheetProperties(sheets, spreadsheetId);
  return mergeTaxonomy(await readCustomRows(sheets, spreadsheetId, properties));
}

async function ensureSheet(sheets, spreadsheetId) {
  let properties = await sheetProperties(sheets, spreadsheetId);
  if (!properties) {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
    });
    properties = response.data.replies?.[0]?.addSheet?.properties || await sheetProperties(sheets, spreadsheetId);
  }
  const header = await sheets.spreadsheets.values.get({ spreadsheetId, range: range("A1:C1") });
  const values = header.data.values?.[0] || [];
  if (!values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: range("A1:C1"),
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  } else if (HEADERS.some((name, index) => values[index] !== name)) {
    fail(`O cabecalho da aba ${SHEET_NAME} foi alterado. Corrija a primeira linha antes de cadastrar categorias.`, 409);
  }
  return properties;
}

async function addTaxonomyEntry(payload = {}) {
  const type = String(payload.type || "").trim();
  if (type !== "category" && type !== "subcategory") fail("Tipo de cadastro invalido.");
  const category = cleanLabel(payload.categoria, "Categoria");
  const subcategory = payload.subcategoria ? cleanLabel(payload.subcategoria, "Subcategoria") : "";
  if (type === "subcategory" && !subcategory) fail("Subcategoria obrigatoria.");

  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const properties = await ensureSheet(sheets, spreadsheetId);
  const rows = await readCustomRows(sheets, spreadsheetId, properties);
  const taxonomy = mergeTaxonomy(rows);
  const group = taxonomy.find((item) => normalizeKey(item.categoria) === normalizeKey(category));

  if (type === "category") {
    if (group || normalizeKey(canonicalCategory(category)) !== normalizeKey(category)) {
      fail("Esta categoria ja existe ou corresponde a uma categoria existente.", 409);
    }
  } else {
    if (!group) fail("Selecione uma categoria cadastrada.");
    if (group.subcategorias.some((name) => normalizeKey(name) === normalizeKey(subcategory))) {
      fail("Esta subcategoria ja existe nessa categoria.", 409);
    }
  }

  if (subcategory) {
    const canonical = canonicalSubcategories(subcategory, group?.categoria || category);
    if (canonical.length !== 1 || normalizeKey(canonical[0]) !== normalizeKey(subcategory)) {
      fail(`Este nome ja e tratado como ${canonical.join(" e ")}. Use a subcategoria existente.`, 409);
    }
  }

  const rowNumber = rows.length + 2;
  if (properties.gridProperties?.rowCount < rowNumber) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ appendDimension: {
        sheetId: properties.sheetId,
        dimension: "ROWS",
        length: Math.max(rowNumber - properties.gridProperties.rowCount, 100),
      } }] },
    });
  }
  const savedCategory = group?.categoria || category;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: range(`A${rowNumber}:C${rowNumber}`),
    valueInputOption: "RAW",
    requestBody: { values: [[savedCategory, subcategory, new Date().toISOString().slice(0, 10)]] },
  });

  return mergeTaxonomy([...rows, [savedCategory, subcategory]]);
}

module.exports = { addTaxonomyEntry, cleanLabel, mergeTaxonomy, readTaxonomy };
