const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./google");

const SPONSORS_SHEET_NAME = (process.env.GOOGLE_SPONSORS_SHEET_TAB || "patrocinadores").trim();
const SPONSOR_HEADERS = [
  "id", "nome", "imagem_url", "link_url", "status", "ordem", "inicio", "fim", "texto_alt", "data_atualizacao",
  "imagem_desktop_2", "imagem_desktop_3", "imagem_desktop_4", "imagem_desktop_5",
  "imagem_mobile_1", "imagem_mobile_2", "imagem_mobile_3", "imagem_mobile_4", "imagem_mobile_5",
  "imagem_ajuste", "imagem_desktop_2_ajuste", "imagem_desktop_3_ajuste", "imagem_desktop_4_ajuste", "imagem_desktop_5_ajuste",
  "imagem_mobile_1_ajuste", "imagem_mobile_2_ajuste", "imagem_mobile_3_ajuste", "imagem_mobile_4_ajuste", "imagem_mobile_5_ajuste",
];
const SPONSOR_CONTENT_KEYS = new Set([
  "id", "nome", "imagem_url", "link_url", "texto_alt",
  "imagem_desktop_2", "imagem_desktop_3", "imagem_desktop_4", "imagem_desktop_5",
  "imagem_mobile_1", "imagem_mobile_2", "imagem_mobile_3", "imagem_mobile_4", "imagem_mobile_5",
]);

function sponsorRange(range = "A1:ZZ") {
  return `${SPONSORS_SHEET_NAME}!${range}`;
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  return text.slice(0, 10);
}

function compareDateValues(a = "", b = "") {
  const left = normalizeDateValue(a);
  const right = normalizeDateValue(b);
  if (!left || !right) return 0;
  return left.localeCompare(right);
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

function rowHasSponsorContent(row = []) {
  return SPONSOR_HEADERS.some((header, index) => (
    SPONSOR_CONTENT_KEYS.has(header) && String(row[index] || "").trim()
  ));
}

function lastSponsorRowNumber(values = []) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    if (rowHasSponsorContent(values[index])) return index + 1;
  }
  return 1;
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

async function copyRowPattern(sheets, spreadsheetId, sheetName, sourceRowNumber, targetRowNumber, columnCount) {
  if (sourceRowNumber < 1 || targetRowNumber < 1 || sourceRowNumber === targetRowNumber) return;
  const properties = await getSheetProperties(sheets, spreadsheetId, sheetName);
  if (typeof properties?.sheetId !== "number") return;

  const source = {
    sheetId: properties.sheetId,
    startRowIndex: sourceRowNumber - 1,
    endRowIndex: sourceRowNumber,
    startColumnIndex: 0,
    endColumnIndex: columnCount,
  };
  const destination = {
    sheetId: properties.sheetId,
    startRowIndex: targetRowNumber - 1,
    endRowIndex: targetRowNumber,
    startColumnIndex: 0,
    endColumnIndex: columnCount,
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { copyPaste: { source, destination, pasteType: "PASTE_FORMAT" } },
        { copyPaste: { source, destination, pasteType: "PASTE_DATA_VALIDATION" } },
      ],
    },
  });
}

function imageList(...values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean).slice(0, 5).map(driveImageUrl);
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

function imageEntries(urls = [], adjustments = []) {
  return urls
    .map((url, index) => ({
      url: String(url || "").trim(),
      adjust: parseImageAdjust(adjustments[index] || ""),
    }))
    .filter((entry) => entry.url)
    .slice(0, 5)
    .map((entry) => ({ ...entry, url: driveImageUrl(entry.url) }));
}

function rowToSponsor(row, index) {
  const raw = {};
  SPONSOR_HEADERS.forEach((header, columnIndex) => {
    raw[header] = String(row[columnIndex] || "").trim();
  });
  const desktopEntries = imageEntries(
    [raw.imagem_url, raw.imagem_desktop_2, raw.imagem_desktop_3, raw.imagem_desktop_4, raw.imagem_desktop_5],
    [raw.imagem_ajuste, raw.imagem_desktop_2_ajuste, raw.imagem_desktop_3_ajuste, raw.imagem_desktop_4_ajuste, raw.imagem_desktop_5_ajuste],
  );
  const mobileEntries = imageEntries(
    [raw.imagem_mobile_1, raw.imagem_mobile_2, raw.imagem_mobile_3, raw.imagem_mobile_4, raw.imagem_mobile_5],
    [raw.imagem_mobile_1_ajuste, raw.imagem_mobile_2_ajuste, raw.imagem_mobile_3_ajuste, raw.imagem_mobile_4_ajuste, raw.imagem_mobile_5_ajuste],
  );
  return {
    rowNumber: index + 2,
    id: raw.id || String(index + 1),
    nome: raw.nome,
    imagem_url: raw.imagem_url,
    imagem_desktop_2: raw.imagem_desktop_2,
    imagem_desktop_3: raw.imagem_desktop_3,
    imagem_desktop_4: raw.imagem_desktop_4,
    imagem_desktop_5: raw.imagem_desktop_5,
    imagem_mobile_1: raw.imagem_mobile_1,
    imagem_mobile_2: raw.imagem_mobile_2,
    imagem_mobile_3: raw.imagem_mobile_3,
    imagem_mobile_4: raw.imagem_mobile_4,
    imagem_mobile_5: raw.imagem_mobile_5,
    imagem_ajuste: raw.imagem_ajuste,
    imagem_desktop_2_ajuste: raw.imagem_desktop_2_ajuste,
    imagem_desktop_3_ajuste: raw.imagem_desktop_3_ajuste,
    imagem_desktop_4_ajuste: raw.imagem_desktop_4_ajuste,
    imagem_desktop_5_ajuste: raw.imagem_desktop_5_ajuste,
    imagem_mobile_1_ajuste: raw.imagem_mobile_1_ajuste,
    imagem_mobile_2_ajuste: raw.imagem_mobile_2_ajuste,
    imagem_mobile_3_ajuste: raw.imagem_mobile_3_ajuste,
    imagem_mobile_4_ajuste: raw.imagem_mobile_4_ajuste,
    imagem_mobile_5_ajuste: raw.imagem_mobile_5_ajuste,
    imagens_desktop: desktopEntries.map((entry) => entry.url),
    imagens_mobile: mobileEntries.map((entry) => entry.url),
    ajustes_desktop: desktopEntries.map((entry) => entry.adjust),
    ajustes_mobile: mobileEntries.map((entry) => entry.adjust),
    link_url: raw.link_url,
    status: raw.status || "ativo",
    ordem: Number.parseInt(raw.ordem || "0", 10) || 0,
    inicio: raw.inicio,
    fim: raw.fim,
    texto_alt: raw.texto_alt || raw.nome,
    data_atualizacao: raw.data_atualizacao,
    values: row,
  };
}

async function ensureSponsorsSheet() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties?.title === SPONSORS_SHEET_NAME);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SPONSORS_SHEET_NAME } } }],
      },
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sponsorRange("A1:ZZ1"),
  }).catch(() => ({ data: { values: [] } }));

  const currentHeaders = (headerResponse.data.values || [])[0] || [];
  if (!currentHeaders.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sponsorRange(`A1:${columnName(SPONSOR_HEADERS.length - 1)}1`),
      valueInputOption: "RAW",
      requestBody: { values: [SPONSOR_HEADERS] },
    });
    return;
  }

  const existing = new Set(currentHeaders);
  const missing = SPONSOR_HEADERS.filter((header) => !existing.has(header));
  if (missing.length) {
    const nextHeaders = [...currentHeaders, ...missing];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sponsorRange(`A1:${columnName(nextHeaders.length - 1)}1`),
      valueInputOption: "RAW",
      requestBody: { values: [nextHeaders] },
    });
  }
}

async function readSponsors() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sponsorRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  }).catch((error) => {
    if (error?.code === 400) return { data: { values: [] } };
    throw error;
  });
  const values = response.data.values || [];
  const rows = values.slice(1).map(rowToSponsor).filter((row) => rowHasSponsorContent(row.values));
  return { rows, updatedAt: new Date().toISOString() };
}

function isSponsorActive(sponsor, now = todayDate()) {
  if (normalize(sponsor.status) !== "ativo") return false;
  if (!sponsor.nome || !sponsor.imagens_desktop.length) return false;
  const today = normalizeDateValue(now);
  if (sponsor.inicio && compareDateValues(sponsor.inicio, today) > 0) return false;
  if (sponsor.fim && compareDateValues(sponsor.fim, today) < 0) return false;
  return true;
}

function driveImageUrl(url = "") {
  const value = String(url || "").trim();
  const match = value.match(/[?&]id=([^&]+)/) || value.match(/\/d\/([^/]+)/) || value.match(/\/file\/d\/([^/]+)/);
  if (!match) return value;
  return `/api/imagem?id=${encodeURIComponent(decodeURIComponent(match[1]))}&sz=w1000`;
}

function publicSponsor(sponsor) {
  const desktopImages = sponsor.imagens_desktop.length ? sponsor.imagens_desktop : imageList(sponsor.imagem_url);
  const mobileImages = sponsor.imagens_mobile.length ? sponsor.imagens_mobile : desktopImages;
  return {
    id: sponsor.id,
    nome: sponsor.nome,
    imagem_url: desktopImages[0] || "",
    imagens_desktop: desktopImages,
    imagens_mobile: mobileImages,
    ajustes_desktop: sponsor.ajustes_desktop || [],
    ajustes_mobile: sponsor.imagens_mobile.length ? (sponsor.ajustes_mobile || []) : (sponsor.ajustes_desktop || []),
    link_url: sponsor.link_url,
    texto_alt: sponsor.texto_alt || sponsor.nome,
  };
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
  return JSON.stringify({ fit, zoom: Number(zoom.toFixed(2)), x: Math.round(x), y: Math.round(y) });
}

function sanitizeSponsorPayload(payload = {}) {
  const status = normalize(payload.status || "ativo") || "ativo";
  const allowedStatuses = new Set(["ativo", "inativo"]);
  const data = {
    id: String(payload.id || "").trim(),
    nome: String(payload.nome || "").trim().slice(0, 120),
    imagem_url: String(payload.imagem_url || "").trim().slice(0, 500),
    imagem_desktop_2: String(payload.imagem_desktop_2 || "").trim().slice(0, 500),
    imagem_desktop_3: String(payload.imagem_desktop_3 || "").trim().slice(0, 500),
    imagem_desktop_4: String(payload.imagem_desktop_4 || "").trim().slice(0, 500),
    imagem_desktop_5: String(payload.imagem_desktop_5 || "").trim().slice(0, 500),
    imagem_mobile_1: String(payload.imagem_mobile_1 || "").trim().slice(0, 500),
    imagem_mobile_2: String(payload.imagem_mobile_2 || "").trim().slice(0, 500),
    imagem_mobile_3: String(payload.imagem_mobile_3 || "").trim().slice(0, 500),
    imagem_mobile_4: String(payload.imagem_mobile_4 || "").trim().slice(0, 500),
    imagem_mobile_5: String(payload.imagem_mobile_5 || "").trim().slice(0, 500),
    imagem_ajuste: sanitizeImageAdjustment(payload.imagem_ajuste),
    imagem_desktop_2_ajuste: sanitizeImageAdjustment(payload.imagem_desktop_2_ajuste),
    imagem_desktop_3_ajuste: sanitizeImageAdjustment(payload.imagem_desktop_3_ajuste),
    imagem_desktop_4_ajuste: sanitizeImageAdjustment(payload.imagem_desktop_4_ajuste),
    imagem_desktop_5_ajuste: sanitizeImageAdjustment(payload.imagem_desktop_5_ajuste),
    imagem_mobile_1_ajuste: sanitizeImageAdjustment(payload.imagem_mobile_1_ajuste),
    imagem_mobile_2_ajuste: sanitizeImageAdjustment(payload.imagem_mobile_2_ajuste),
    imagem_mobile_3_ajuste: sanitizeImageAdjustment(payload.imagem_mobile_3_ajuste),
    imagem_mobile_4_ajuste: sanitizeImageAdjustment(payload.imagem_mobile_4_ajuste),
    imagem_mobile_5_ajuste: sanitizeImageAdjustment(payload.imagem_mobile_5_ajuste),
    link_url: String(payload.link_url || "").trim().slice(0, 500),
    status: allowedStatuses.has(status) ? status : "inativo",
    ordem: String(payload.ordem || "0").replace(/[^0-9-]/g, "").slice(0, 5) || "0",
    inicio: String(payload.inicio || "").trim().slice(0, 10),
    fim: String(payload.fim || "").trim().slice(0, 10),
    texto_alt: String(payload.texto_alt || payload.nome || "").trim().slice(0, 160),
    data_atualizacao: todayDate(),
  };

  if (!data.nome || !imageList(data.imagem_url, data.imagem_desktop_2, data.imagem_desktop_3, data.imagem_desktop_4, data.imagem_desktop_5).length) {
    const error = new Error("Nome e ao menos um banner desktop do patrocinador sao obrigatorios.");
    error.statusCode = 400;
    throw error;
  }
  return data;
}

function nextSponsorId(rows) {
  const maxId = rows.reduce((max, row) => {
    const idNumber = Number.parseInt(row.id, 10);
    return Number.isFinite(idNumber) ? Math.max(max, idNumber) : max;
  }, 0);
  return String(maxId + 1);
}

function sponsorValues(data) {
  return SPONSOR_HEADERS.map((header) => data[header] || "");
}

async function appendSponsor(payload) {
  await ensureSponsorsSheet();
  const { rows } = await readSponsors();
  const data = sanitizeSponsorPayload({ ...payload, id: payload.id || nextSponsorId(rows) });
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const values = sponsorValues(data);
  const allRowsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sponsorRange("A1:ZZ"),
    valueRenderOption: "FORMATTED_VALUE",
  });
  const nextRowNumber = Math.max(lastSponsorRowNumber(allRowsResponse.data.values || []) + 1, 2);

  await ensureSheetRowCapacity(sheets, spreadsheetId, SPONSORS_SHEET_NAME, nextRowNumber);
  await copyRowPattern(sheets, spreadsheetId, SPONSORS_SHEET_NAME, Math.max(2, nextRowNumber - 1), nextRowNumber, SPONSOR_HEADERS.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sponsorRange(`A${nextRowNumber}:${columnName(SPONSOR_HEADERS.length - 1)}${nextRowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
  return { ...rowToSponsor(values, rows.length), rowNumber: nextRowNumber };
}

async function updateSponsor(id, payload) {
  await ensureSponsorsSheet();
  const { rows } = await readSponsors();
  const sponsor = rows.find((item) => String(item.id) === String(id));
  if (!sponsor) {
    const error = new Error("Patrocinador nao encontrado.");
    error.statusCode = 404;
    throw error;
  }
  const data = sanitizeSponsorPayload({ ...sponsor, ...payload, id: sponsor.id });
  const values = sponsorValues(data);
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sponsorRange(`A${sponsor.rowNumber}:${columnName(SPONSOR_HEADERS.length - 1)}${sponsor.rowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
  return rowToSponsor(values, sponsor.rowNumber - 2);
}

async function deleteSponsor(id) {
  return updateSponsor(id, { status: "inativo" });
}

module.exports = {
  appendSponsor,
  deleteSponsor,
  ensureSponsorsSheet,
  isSponsorActive,
  normalize,
  normalizeDateValue,
  publicSponsor,
  readSponsors,
  sanitizeSponsorPayload,
  updateSponsor,
};
