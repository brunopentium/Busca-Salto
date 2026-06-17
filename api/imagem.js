const { json } = require("./_lib/http");
const { GOOGLE_SCOPES, getDriveClient } = require("./_lib/google");

function cleanDriveId(value = "") {
  const id = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(id)) return "";
  return id;
}

function cleanSize(value = "") {
  const size = String(value || "w1000").trim();
  if (!/^w[0-9]{2,4}$/.test(size)) return "w1000";
  return size;
}

async function fetchOriginalDriveFile(id) {
  const drive = await getDriveClient([GOOGLE_SCOPES.drive]);
  const response = await drive.files.get(
    { fileId: id, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return {
    contentType: response.headers?.["content-type"] || "image/jpeg",
    buffer: Buffer.from(response.data),
  };
}

async function fetchDriveThumbnail(id, size) {
  const driveUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=${encodeURIComponent(size)}`;
  const response = await fetch(driveUrl, {
    headers: { "User-Agent": "BuscaSalto/1.0" },
    redirect: "follow",
  });

  if (!response.ok) return null;

  return {
    contentType: response.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await response.arrayBuffer()),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  const id = cleanDriveId(req.query.id);
  if (!id) return json(res, 400, { ok: false, error: "Imagem invalida." });

  try {
    const size = cleanSize(req.query.sz);
    const image = await fetchOriginalDriveFile(id).catch(() => null) || await fetchDriveThumbnail(id, size);
    if (!image?.buffer?.length) return json(res, 404, { ok: false, error: "Imagem nao encontrada." });

    res.statusCode = 200;
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Content-Length", String(image.buffer.length));
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.end(image.buffer);
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-api",
      event: "image_proxy_error",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 502, { ok: false, error: "Nao foi possivel carregar a imagem." });
  }
};
