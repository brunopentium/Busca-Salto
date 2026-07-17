const { Readable } = require("stream");
const { requireAdminSession } = require("../_lib/admin-auth");
const { GOOGLE_SCOPES, getDriveClient, getDriveFolderConfig } = require("../_lib/google");
const { cleanText, json, readJsonBody } = require("../_lib/http");
const { updateCommerce } = require("../_lib/sheets-admin");
const { updateSponsor } = require("../_lib/sponsors");

const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const COMMERCE_IMAGE_FIELDS = new Set(["foto_url", "foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5"]);
const SPONSOR_IMAGE_FIELDS = new Set([
  "imagem_url", "imagem_desktop_2", "imagem_desktop_3", "imagem_desktop_4", "imagem_desktop_5",
  "imagem_mobile_1", "imagem_mobile_2", "imagem_mobile_3", "imagem_mobile_4", "imagem_mobile_5",
]);

function safeFileBase(value = "") {
  return cleanText(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "imagem";
}

function folderForKind(kind) {
  const folders = getDriveFolderConfig();
  if (kind === "patrocinador") return folders.sponsors;
  if (kind === "site") return folders.site || folders.images;
  if (kind === "pendente") return folders.pending;
  return folders.businesses;
}

function uniqueFolderIds(ids = []) {
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function folderCandidatesForKind(kind) {
  const folders = getDriveFolderConfig();
  return uniqueFolderIds([
    folderForKind(kind),
    folders.images,
    folders.site,
    folders.sponsors,
  ]);
}

function shouldTryNextFolder(error) {
  const status = Number(error?.code || error?.response?.status || 0);
  return status === 401 || status === 403 || status === 404;
}

async function createDriveFileWithFallback(drive, payload, name) {
  let lastError = null;

  for (const folderId of folderCandidatesForKind(payload.kind)) {
    try {
      const created = await drive.files.create({
        requestBody: { name, parents: [folderId] },
        media: {
          mimeType: payload.contentType,
          body: Readable.from(payload.buffer),
        },
        fields: "id,name,webViewLink",
      });
      return { created, folderId };
    } catch (error) {
      lastError = error;
      if (!shouldTryNextFolder(error)) throw error;
    }
  }

  throw lastError || new Error("Nenhuma pasta do Google Drive disponivel para upload.");
}

function uploadErrorMessage(error) {
  const message = String(error?.message || "");
  const status = Number(error?.code || error?.response?.status || 0);

  if (message.includes("Google credentials are not configured")) {
    return "Credenciais do Google nao configuradas na Vercel.";
  }
  if (status === 401 || status === 403) {
    return "Sem permissao para enviar para a pasta do Google Drive.";
  }
  if (status === 404) {
    return "Pasta do Google Drive nao encontrada.";
  }
  return "Nao foi possivel enviar a imagem.";
}

function parseImagePayload(body = {}) {
  const contentType = cleanText(body.contentType, 80).toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    const error = new Error("Tipo de imagem nao permitido.");
    error.statusCode = 400;
    throw error;
  }

  const base64 = String(body.dataBase64 || "").replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error("Imagem vazia ou maior que 3 MB.");
    error.statusCode = 400;
    throw error;
  }

  return {
    buffer,
    contentType,
    extension: ALLOWED_IMAGE_TYPES.get(contentType),
    kind: cleanText(body.kind, 30).toLowerCase(),
    recordId: cleanText(body.recordId || body.commerceId, 40),
    target: cleanText(body.target, 80),
    persist: Boolean(body.persist),
    commerceId: safeFileBase(body.commerceId || "sem-id"),
    commerceName: safeFileBase(body.commerceName || body.fileName || "imagem"),
  };
}

async function persistUploadedImage(payload, publicUrl) {
  if (!payload.persist || !payload.recordId || !payload.target) return null;

  if (payload.kind === "comercio" && COMMERCE_IMAGE_FIELDS.has(payload.target)) {
    return updateCommerce(payload.recordId, { [payload.target]: publicUrl });
  }

  if (payload.kind === "patrocinador" && SPONSOR_IMAGE_FIELDS.has(payload.target)) {
    return updateSponsor(payload.recordId, { [payload.target]: publicUrl });
  }

  return null;
}

async function makeDriveFileReadable(drive, fileId) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });
    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      level: "warn",
      service: "busca-salto-admin",
      event: "admin_upload_public_permission_skipped",
      message: error?.message || "Nao foi possivel tornar a imagem publica.",
      status: error?.code || error?.response?.status || null,
      timestamp: new Date().toISOString(),
    }));
    return false;
  }
}

module.exports = async function handler(req, res) {
  const session = requireAdminSession(req);
  if (!session.ok) return json(res, session.status, { ok: false, error: session.error });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  try {
    const payload = parseImagePayload(await readJsonBody(req, { maxBytes: 5 * 1024 * 1024 }));
    const drive = await getDriveClient([GOOGLE_SCOPES.drive]);
    const name = `${payload.commerceId}-${payload.commerceName}-${Date.now()}.${payload.extension}`;

    const { created, folderId } = await createDriveFileWithFallback(drive, payload, name);
    const publicReadable = await makeDriveFileReadable(drive, created.data.id);
    const publicUrl = `/api/imagem?id=${encodeURIComponent(created.data.id)}&sz=w1000`;
    const savedItem = await persistUploadedImage(payload, publicUrl);
    return json(res, 201, {
      ok: true,
      saved: Boolean(savedItem),
      publicReadable,
      item: savedItem,
      file: {
        id: created.data.id,
        name: created.data.name,
        folderId,
        url: publicUrl,
        webViewLink: created.data.webViewLink,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-admin",
      event: "admin_upload_error",
      message: error?.message || "Erro desconhecido",
      status: error?.code || error?.response?.status || null,
      timestamp: new Date().toISOString(),
    }));
    return json(res, error.statusCode || 500, {
      ok: false,
      error: error.statusCode ? error.message : uploadErrorMessage(error),
    });
  }
};
