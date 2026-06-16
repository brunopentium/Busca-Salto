const crypto = require("crypto");

const DEFAULT_COOKIE_NAME = "busca_salto_admin";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const HASH_PREFIX = "pbkdf2_sha256";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function hmac(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function getCookieName() {
  return String(process.env.ADMIN_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim() || DEFAULT_COOKIE_NAME;
}

function getSessionSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || "").trim();
}

function getPasswordHash() {
  return String(process.env.ADMIN_PASSWORD_HASH || "").trim();
}

function isAuthConfigured() {
  return getSessionSecret().length >= 32 && getPasswordHash().startsWith(`${HASH_PREFIX}$`);
}

function parsePasswordHash(encodedHash) {
  const [prefix, iterationsText, saltText, hashText] = String(encodedHash || "").split("$");
  const iterations = Number.parseInt(iterationsText, 10);
  if (prefix !== HASH_PREFIX || !Number.isFinite(iterations) || iterations < 100000 || !saltText || !hashText) {
    throw new Error("ADMIN_PASSWORD_HASH invalido.");
  }

  return {
    iterations,
    salt: Buffer.from(saltText, "base64url"),
    hash: Buffer.from(hashText, "base64url"),
  };
}

function verifyPassword(password, encodedHash = getPasswordHash()) {
  const parsed = parsePasswordHash(encodedHash);
  const candidate = crypto.pbkdf2Sync(String(password || ""), parsed.salt, parsed.iterations, parsed.hash.length, "sha256");
  return candidate.length === parsed.hash.length && crypto.timingSafeEqual(candidate, parsed.hash);
}

function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    aud: "busca-salto-admin",
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
    nonce: crypto.randomBytes(16).toString("base64url"),
  }));
  const signature = hmac(payload, getSessionSecret());
  return `${payload}.${signature}`;
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || "");
  return Object.fromEntries(cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return [part, ""];
      return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    }));
}

function verifySessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return false;

  const expected = hmac(payload, getSessionSecret());
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.aud === "busca-salto-admin" && Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch (error) {
    return false;
  }
}

function requireAdminSession(req) {
  if (!isAuthConfigured()) return { ok: false, status: 503, error: "Painel administrativo nao configurado." };
  const token = parseCookies(req)[getCookieName()];
  if (!verifySessionToken(token)) return { ok: false, status: 401, error: "Sessao invalida." };
  return { ok: true };
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const host = String(req.headers.host || "").toLowerCase();
  return forwardedProto === "https" || (!host.startsWith("localhost") && !host.startsWith("127.0.0.1"));
}

function buildSessionCookie(req, token) {
  const parts = [
    `${getCookieName()}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function buildExpiredSessionCookie(req) {
  const parts = [
    `${getCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (isSecureRequest(req)) parts.push("Secure");
  return parts.join("; ");
}

function createPasswordHash(password, options = {}) {
  const iterations = options.iterations || 310000;
  const salt = options.salt || crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, iterations, 32, "sha256");
  return `${HASH_PREFIX}$${iterations}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

module.exports = {
  buildExpiredSessionCookie,
  buildSessionCookie,
  createPasswordHash,
  createSessionToken,
  isAuthConfigured,
  requireAdminSession,
  verifyPassword,
};
