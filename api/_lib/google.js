const DEFAULT_SPREADSHEET_ID = "1s-Wi8ej_y5YisIg2GWh7LlwyLsCpf_YwefotX1ct3dA";
const DEFAULT_SHEET_NAME = "base_interna";
const DEFAULT_DRIVE_FOLDERS = {
  images: "18scb_k52bmcHyyz6WPnmzuy7S0N8mvb-",
  businesses: "1SI56xKqxzdxLEgu72Q1G-NL00LuOAPNA",
  sponsors: "18rKSfu38PHR8NCda6j3V6BS99kuT9NU7",
  site: "18scb_k52bmcHyyz6WPnmzuy7S0N8mvb-",
  pending: "1ZWoxvbRLi0wN1utVI1KS4aZqW8CsfbCp",
};

const GOOGLE_SCOPES = {
  sheetsRead: "https://www.googleapis.com/auth/spreadsheets.readonly",
  sheetsWrite: "https://www.googleapis.com/auth/spreadsheets",
  driveFile: "https://www.googleapis.com/auth/drive.file",
  drive: "https://www.googleapis.com/auth/drive",
};

function getSpreadsheetConfig() {
  return {
    spreadsheetId: (process.env.GOOGLE_SHEETS_ID || DEFAULT_SPREADSHEET_ID).trim(),
    sheetName: (process.env.GOOGLE_SHEETS_TAB || DEFAULT_SHEET_NAME).trim(),
  };
}

function getDriveFolderConfig() {
  return {
    images: (process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID || DEFAULT_DRIVE_FOLDERS.images).trim(),
    businesses: (process.env.GOOGLE_DRIVE_BUSINESSES_FOLDER_ID || DEFAULT_DRIVE_FOLDERS.businesses).trim(),
    sponsors: (process.env.GOOGLE_DRIVE_SPONSORS_FOLDER_ID || DEFAULT_DRIVE_FOLDERS.sponsors).trim(),
    site: (process.env.GOOGLE_DRIVE_SITE_FOLDER_ID || process.env.GOOGLE_DRIVE_IMAGES_FOLDER_ID || DEFAULT_DRIVE_FOLDERS.site).trim(),
    pending: (process.env.GOOGLE_DRIVE_PENDING_FOLDER_ID || DEFAULT_DRIVE_FOLDERS.pending).trim(),
  };
}

function requireGoogleCredentials() {
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) throw new Error("Google credentials are not configured.");
  return { email, key: key.replace(/\\n/g, "\n") };
}

async function getGoogleAuth(scopes) {
  const { google } = require("googleapis");
  const credentials = requireGoogleCredentials();
  return new google.auth.JWT({
    email: credentials.email,
    key: credentials.key,
    scopes: Array.isArray(scopes) ? scopes : [scopes],
  });
}

async function getSheetsClient(scopes = [GOOGLE_SCOPES.sheetsRead]) {
  const { google } = require("googleapis");
  const auth = await getGoogleAuth(scopes);
  return google.sheets({ version: "v4", auth });
}

async function getDriveClient(scopes = [GOOGLE_SCOPES.driveFile]) {
  const { google } = require("googleapis");
  const auth = await getGoogleAuth(scopes);
  return google.drive({ version: "v3", auth });
}

function sheetRange(range = "A1:ZZ", sheetName = getSpreadsheetConfig().sheetName) {
  return `${sheetName}!${range}`;
}

module.exports = {
  GOOGLE_SCOPES,
  getDriveClient,
  getDriveFolderConfig,
  getSheetsClient,
  getSpreadsheetConfig,
  requireGoogleCredentials,
  sheetRange,
};
