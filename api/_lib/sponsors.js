const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./google");

const SPONSORS_SHEET_NAME = (process.env.GOOGLE_SPONSORS_SHEET_TAB || "patrocinadores").trim();
const SPONSOR_HEADERS = ["id", "nome", "imagem_url", "link_url", "status", "ordem", "inicio", "fim", "texto_alt", "data_atualizacao"];

function sponsorRange(range = "A1:J") {
  return `${SPONSORS_SHEET_NAME}!${range}`;
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function rowToSponsor(row, index) {
  const raw = {};
  SPONSOR_HEADERS.forEach((header, columnIndex) => {
    raw[header] = String(row[columnIndex] || "").trim();
  });
  return {
    rowNumber: index + 2,
    id: raw.id || String(index + 1),
    nome: raw.nome,
    imagem_url: raw.imagem_url,
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
    range: sponsorRange("A1:J1"),
  }).catch(() => ({ data: { values: [] } }));

  if (!(headerResponse.data.values || [])[0]?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sponsorRange("A1:J1"),
      valueInputOption: "RAW",
      requestBody: { values: [SPONSOR_HEADERS] },
    });
  }
}

async function readSponsors() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sponsorRange("A1:J"),
    valueRenderOption: "FORMATTED_VALUE",
  }).catch((error) => {
    if (error?.code === 400) return { data: { values: [] } };
    throw error;
  });
  const values = response.data.values || [];
  const rows = values.slice(1).map(rowToSponsor);
  return { rows, updatedAt: new Date().toISOString() };
}

function isSponsorActive(sponsor, now = todayDate()) {
  if (normalize(sponsor.status) !== "ativo") return false;
  if (!sponsor.nome || !sponsor.imagem_url) return false;
  if (sponsor.inicio && sponsor.inicio > now) return false;
  if (sponsor.fim && sponsor.fim < now) return false;
  return true;
}

function driveImageUrl(url = "") {
  const value = String(url || "").trim();
  const match = value.match(/[?&]id=([^&]+)/) || value.match(/\/d\/([^/]+)/) || value.match(/\/file\/d\/([^/]+)/);
  if (!match) return value;
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(decodeURIComponent(match[1]))}&sz=w1000`;
}

function publicSponsor(sponsor) {
  return {
    id: sponsor.id,
    nome: sponsor.nome,
    imagem_url: driveImageUrl(sponsor.imagem_url),
    link_url: sponsor.link_url,
    texto_alt: sponsor.texto_alt || sponsor.nome,
  };
}

function sanitizeSponsorPayload(payload = {}) {
  const status = normalize(payload.status || "ativo") || "ativo";
  const data = {
    id: String(payload.id || "").trim(),
    nome: String(payload.nome || "").trim().slice(0, 120),
    imagem_url: String(payload.imagem_url || "").trim().slice(0, 500),
    link_url: String(payload.link_url || "").trim().slice(0, 500),
    status: status.slice(0, 40),
    ordem: String(payload.ordem || "0").replace(/[^0-9-]/g, "").slice(0, 5) || "0",
    inicio: String(payload.inicio || "").trim().slice(0, 10),
    fim: String(payload.fim || "").trim().slice(0, 10),
    texto_alt: String(payload.texto_alt || payload.nome || "").trim().slice(0, 160),
    data_atualizacao: todayDate(),
  };

  if (!data.nome || !data.imagem_url) {
    const error = new Error("Nome e imagem do patrocinador sao obrigatorios.");
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
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sponsorRange("A1"),
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });
  return rowToSponsor(values, rows.length);
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
    range: sponsorRange(`A${sponsor.rowNumber}:J${sponsor.rowNumber}`),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
  return rowToSponsor(values, sponsor.rowNumber - 2);
}

module.exports = {
  appendSponsor,
  ensureSponsorsSheet,
  isSponsorActive,
  publicSponsor,
  readSponsors,
  sanitizeSponsorPayload,
  updateSponsor,
};
