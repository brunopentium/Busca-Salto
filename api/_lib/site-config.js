const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig } = require("./google");

const SITE_CONFIG_SHEET_NAME = (process.env.GOOGLE_SITE_CONFIG_SHEET_TAB || "config_site").trim();
const SITE_CONFIG_HEADERS = ["chave", "valor", "data_atualizacao"];
const SITE_CONFIG_KEYS = [
  "site_logo_url",
  "site_logo_ajuste",
  "site_banner_url",
  "site_banner_ajuste",
];

function siteConfigRange(range = "A1:C") {
  return `${SITE_CONFIG_SHEET_NAME}!${range}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function driveImageUrl(url = "") {
  const value = String(url || "").trim();
  const match = value.match(/[?&]id=([^&]+)/) || value.match(/\/d\/([^/]+)/) || value.match(/\/file\/d\/([^/]+)/);
  if (!match) return value;
  return `/api/imagem?id=${encodeURIComponent(decodeURIComponent(match[1]))}&sz=w1600`;
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

function normalizeConfigMap(values = []) {
  const config = {};
  for (const row of values.slice(1)) {
    const key = String(row[0] || "").trim();
    if (SITE_CONFIG_KEYS.includes(key)) config[key] = String(row[1] || "").trim();
  }
  return config;
}

async function ensureSiteConfigSheet() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties?.title === SITE_CONFIG_SHEET_NAME);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: SITE_CONFIG_SHEET_NAME } } }],
      },
    });
  }

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: siteConfigRange("A1:C1"),
  }).catch(() => ({ data: { values: [] } }));
  const headers = (headerResponse.data.values || [])[0] || [];

  if (headers.join("|") !== SITE_CONFIG_HEADERS.join("|")) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: siteConfigRange("A1:C1"),
      valueInputOption: "RAW",
      requestBody: { values: [SITE_CONFIG_HEADERS] },
    });
  }
}

async function readSiteConfigRaw() {
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: siteConfigRange("A1:C20"),
    valueRenderOption: "FORMATTED_VALUE",
  }).catch((error) => {
    if (error?.code === 400) return { data: { values: [] } };
    throw error;
  });
  return normalizeConfigMap(response.data.values || []);
}

async function readSiteConfigAdmin() {
  await ensureSiteConfigSheet();
  const config = await readSiteConfigRaw();
  return {
    site_logo_url: config.site_logo_url || "",
    site_logo_ajuste: config.site_logo_ajuste || "",
    site_banner_url: config.site_banner_url || "",
    site_banner_ajuste: config.site_banner_ajuste || "",
  };
}

function publicSiteConfig(config = {}) {
  return {
    logo: {
      url: driveImageUrl(config.site_logo_url || ""),
      ajuste: parseImageAdjust(config.site_logo_ajuste || ""),
    },
    banner: {
      url: driveImageUrl(config.site_banner_url || ""),
      ajuste: parseImageAdjust(config.site_banner_ajuste || ""),
    },
  };
}

async function readSiteConfigPublic() {
  return publicSiteConfig(await readSiteConfigRaw());
}

async function updateSiteConfig(payload = {}) {
  await ensureSiteConfigSheet();
  const { spreadsheetId } = getSpreadsheetConfig();
  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsWrite]);
  const data = {
    site_logo_url: String(payload.site_logo_url || "").trim().slice(0, 500),
    site_logo_ajuste: sanitizeImageAdjustment(payload.site_logo_ajuste),
    site_banner_url: String(payload.site_banner_url || "").trim().slice(0, 500),
    site_banner_ajuste: sanitizeImageAdjustment(payload.site_banner_ajuste),
  };
  const updatedAt = todayDate();
  const rows = [
    SITE_CONFIG_HEADERS,
    ...SITE_CONFIG_KEYS.map((key) => [key, data[key] || "", updatedAt]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: siteConfigRange("A1:C5"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  return data;
}

module.exports = {
  ensureSiteConfigSheet,
  publicSiteConfig,
  readSiteConfigAdmin,
  readSiteConfigPublic,
  updateSiteConfig,
};
