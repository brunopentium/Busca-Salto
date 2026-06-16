const { json } = require("./_lib/http");

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

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  const id = cleanDriveId(req.query.id);
  if (!id) return json(res, 400, { ok: false, error: "Imagem invalida." });

  try {
    const size = cleanSize(req.query.sz);
    const driveUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=${encodeURIComponent(size)}`;
    const response = await fetch(driveUrl, {
      headers: { "User-Agent": "BuscaSalto/1.0" },
      redirect: "follow",
    });

    if (!response.ok) return json(res, 404, { ok: false, error: "Imagem nao encontrada." });

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.end(buffer);
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
