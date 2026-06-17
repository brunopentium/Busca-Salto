const CACHE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 30;
const CONTACT_TYPES = new Set(["whatsapp", "telefone", "instagram", "facebook", "site"]);
const { GOOGLE_SCOPES, getSheetsClient, getSpreadsheetConfig, sheetRange } = require("./_lib/google");
const { spreadsheetId: SPREADSHEET_ID } = getSpreadsheetConfig();
const RANGE = sheetRange("A1:ZZ");
const RANDOM_BUCKET_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_MAX_KEYS = 1000;
const PAGINATION_LIMITS = {
  NONE: 1,
  BROAD_FILTER: 4,
  COMBINED_FILTER: 5,
  TEXT_SEARCH: 8,
};
const SEARCH_ALIASES = {
  acai: ["acaiteria", "sorveteria"],
  pastel: ["pastelaria"],
  pasteis: ["pastelaria"],
  lanche: ["lanchonete", "lanches", "hamburgueria"],
  lanches: ["lanchonete", "lanche", "hamburgueria"],
  hamburguer: ["hamburgueria", "hamburguerias"],
  burger: ["hamburgueria", "hamburguer"],
  comida: ["restaurante", "marmitaria", "rotisseria", "lanchonete"],
  marmita: ["marmitaria", "restaurante"],
  pizza: ["pizzaria"],
  doce: ["doceria", "confeitaria", "bolos"],
  doces: ["doceria", "confeitaria", "bolos"],
  bolo: ["bolos", "doceria", "confeitaria"],
  pao: ["padaria", "panificadora"],
  farmacia: ["farmacia", "drogaria"],
  remedio: ["farmacia", "drogaria"],
  dentista: ["odontologia", "odontologico", "odontologica"],
  dental: ["odontologia", "odontologico", "odontologica"],
  medico: ["clinica medica", "clinicas medicas", "hospital"],
  academia: ["fitness", "musculacao"],
  musculacao: ["academia", "fitness"],
  mecanico: ["mecanica", "oficina"],
  mecanica: ["mecanico", "oficina"],
  autoeletrica: ["auto eletrica", "auto eletrico"],
  autoeletrico: ["auto eletrica", "autoeletrica"],
  borracharia: ["pneu", "pneus"],
  pneus: ["pneu", "borracharia"],
  lavajato: ["lava rapido", "lava rapidos"],
  "lava rapido": ["lavajato", "lava rapidos"],
  chave: ["chaveiro"],
  chaveiro: ["chaves"],
  pet: ["petshop", "pet shop", "veterinario", "racao"],
  petshop: ["pet shop", "banho e tosa"],
  veterinario: ["veterinaria", "clinica veterinaria"],
  racao: ["racao", "racoes"],
};
const SEARCH_STOPWORDS = new Set([
  "a", "ao", "aos", "as", "ate", "com", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos",
  "o", "os", "para", "por", "pra", "pro", "uma", "um",
  "aqui", "encontrar", "mim", "onde", "perto", "preciso", "procuro", "procurar", "proxima", "proximo", "quero",
  "salto", "sp",
]);
const CATEGORY_CANONICAL = {
  "servicos automotivos": "Automotivo",
};
const SUBCATEGORY_CANONICAL = {
  "acougues boutique": "Açougue Boutique",
  "assistencia tecnica": "Assistência Técnica",
  "auto eletrica": "Autoelétrica",
  autoeletrica: "Autoelétrica",
  borracharias: "Borracharia",
  churrascarias: "Churrascaria",
  "clinicas de imagem": "Clínica de Imagem",
  "clinicas medicas": "Clínica Médica",
  "clinicas veterinarias": "Clínica Veterinária",
  "comunidades religiosas": "Comunidade Religiosa",
  conveniencias: "Conveniência",
  "corretoras de seguros": "Corretora de Seguros",
  "corretores de imoveis": "Corretor de Imóveis",
  "cuidadores de idosos": "Cuidador de Idosos",
  "distribuidoras de bebidas": "Distribuidora de Bebidas",
  "escolas infantis": "Escola Infantil",
  "escolas particulares": "Escola Particular",
  "faculdades": "Faculdade",
  "hortifrutis": "Hortifrúti",
  "laboratorios de exames": "Laboratório de Exames",
  "loja de pneus": "Loja de Pneus",
  "lojas de moveis": "Loja de Móveis",
  "lojas de presentes": "Loja de Presentes",
  "materiais graficos": "Material Gráfico",
  "musicos": "Músicos",
  djs: "DJs",
  epis: "EPIs",
  ongs: "ONGs",
  "nutricionistas": "Nutricionista",
  "otica": "Ótica",
  "pneus e mecanica": "Pneus e Mecânica",
  "produtores locais": "Produtores Locais",
  "racoes": "Rações",
  "restaurantes por quilo": "Restaurante por Quilo",
  "universidades": "Universidade",
};
const SUBCATEGORY_EXPANSIONS = {
  "acaiteria e pastelaria": ["Açaiteria", "Pastelaria"],
  "acaiteria e sorveteria": ["Açaiteria", "Sorveteria"],
  "bar com porcoes": ["Bar"],
  "bar e restaurante": ["Bar", "Restaurante"],
  bolos: ["Confeitaria"],
  "bolos e doces": ["Confeitaria"],
  "boteco com porcoes": ["Bar"],
  botequim: ["Bar"],
  "cafe e confeitaria": ["Cafeteria", "Confeitaria"],
  "cafe e restaurante": ["Cafeteria", "Restaurante"],
  cafeterias: ["Cafeteria"],
  "choperia com porcoes": ["Bar"],
  "comida oriental": ["Comida Japonesa"],
  "confeitaria artesanal": ["Confeitaria"],
  "confeitaria e doceria": ["Confeitaria"],
  "confeitaria gourmet": ["Confeitaria"],
  "delivery de acai": ["Açaiteria"],
  "delivery de comida brasileira": ["Restaurante"],
  "delivery de espetinhos": ["Espetaria"],
  "delivery de hamburgueria": ["Hamburgueria"],
  "delivery de lanches": ["Lanchonete"],
  "delivery de lanches e porcoes": ["Lanchonete"],
  "delivery de marmitas": ["Marmitaria"],
  "delivery de marmitex": ["Marmitaria"],
  "delivery de restaurante e pizzaria": ["Restaurante", "Pizzaria"],
  doceria: ["Confeitaria"],
  "doces e salgados": ["Confeitaria"],
  "esfiharia e lanchonete": ["Esfiharia", "Lanchonete"],
  "esfiharia e pizzaria": ["Esfiharia", "Pizzaria"],
  "espetaria e bar": ["Espetaria", "Bar"],
  "espetaria e porcoes": ["Espetaria"],
  "hamburgueria artesanal": ["Hamburgueria"],
  "hamburgueria delivery": ["Hamburgueria"],
  "lanches e hamburgueres": ["Lanchonete", "Hamburgueria"],
  "lanchonete com hamburguer": ["Lanchonete", "Hamburgueria"],
  "lanchonete e sorveteria": ["Lanchonete", "Sorveteria"],
  marmitex: ["Marmitaria"],
  "marmitas saudaveis": ["Marmitaria"],
  "padaria e confeitaria": ["Padaria", "Confeitaria"],
  "padaria gourmet": ["Padaria"],
  "pastelaria delivery": ["Pastelaria"],
  "pastelaria e lanchonete": ["Pastelaria", "Lanchonete"],
  "pizzaria delivery": ["Pizzaria"],
  "pizzaria e restaurante": ["Pizzaria", "Restaurante"],
  "restaurante com marmitex": ["Restaurante", "Marmitaria"],
  "restaurante com porcoes": ["Restaurante"],
  "restaurante e rotisseria": ["Restaurante", "Rotisseria"],
  "restaurante japones": ["Comida Japonesa"],
  "restaurante nordestino": ["Restaurante"],
  "restaurante por quilo": ["Restaurante"],
  "restaurante rural": ["Restaurante"],
  "restaurantes por quilo": ["Restaurante"],
  "rotisserie e restaurante": ["Rotisseria", "Restaurante"],
  "self service": ["Restaurante"],
  "self-service": ["Restaurante"],
  "sorveteria e acaiteria": ["Sorveteria", "Açaiteria"],
  "sorveteria e lanchonete": ["Sorveteria", "Lanchonete"],
  "auto eletrica": ["Autoelétrica"],
  "autopecas e oficina mecanica": ["Autopeças", "Mecânica"],
  borracharias: ["Borracharia"],
  "despachantes documentais": ["Despachante"],
  "loja de pneus": ["Loja de Pneus"],
  mecanica: ["Mecânica"],
  "oficina mecanica": ["Mecânica"],
  "pneus e mecanica": ["Loja de Pneus", "Mecânica"],
  picoleteria: ["Sorveteria"],
  rotisserias: ["Rotisseria"],
  "sorveteria artesanal": ["Sorveteria"],
  "assistencia tecnica de ar condicionado": ["Ar-condicionado"],
  "acougues boutique": ["Açougue"],
  acougues: ["Açougue"],
  galeterias: ["Restaurante"],
  hortas: ["Hortifrúti"],
  "lojas de produtos congelados": ["Mercados"],
  papelarias: ["Papelaria"],
  "produtores locais": ["Hortifrúti"],
  "academia e artes marciais": ["Academia"],
  "academia e lutas": ["Academia"],
  "centro de diagnostico": ["Clínica de Imagem"],
  "clinica medica especializada": ["Clínica Médica"],
  "clinica multidisciplinar": ["Clínica Médica"],
  "consultorio medico": ["Clínica Médica"],
  "diagnostico por imagem": ["Clínica de Imagem"],
  "farmacia e drogaria": ["Farmácia"],
  "fisioterapia e acupuntura": ["Fisioterapia"],
  "fisioterapia e pilates": ["Fisioterapia", "Pilates"],
  "psicologia e neuropsicologia": ["Psicologia"],
  ortodontia: ["Clínica Odontológica"],
  policlinica: ["Clínica Médica"],
  "pronto atendimento": ["Hospitais"],
  "lojas de produtos naturais": ["Produtos Naturais"],
  suplementos: ["Produtos Naturais"],
  "terapias alternativas": ["Terapias"],
  "terapeutas ocupacionais": ["Terapias"],
  "casas de repouso": ["Cuidador de Idosos"],

  "chaveiros": ["Chaveiro"],
  "chaveiro automotivo": ["Chaveiro"],
  "auto socorro": ["Guincho"],
  "alinhamento e balanceamento": ["Centro Automotivo"],
  "troca de oleo": ["Centro Automotivo"],
  vulcanizacao: ["Borracharia"],
  "rodas automotivas": ["Loja de Pneus"],
  "som e acessorios automotivos": ["Acessórios Automotivos"],

  alarmes: ["Segurança Eletrônica"],
  "instalacao de cameras": ["Segurança Eletrônica"],
  refrigeracao: ["Ar-condicionado"],
  "loja de moveis": ["Móveis"],
  "moveis e decoracao": ["Móveis"],
  "moveis planejados": ["Móveis"],
  reformas: ["Pedreiros"],
  "portoes automaticos": ["Segurança Eletrônica"],
  "limpeza de piscina": ["Piscina"],

  imobiliarias: ["Imobiliária"],
  "corretor de imoveis": ["Imobiliária"],
  "corretores de imoveis": ["Imobiliária"],
  "imoveis para temporada": ["Imobiliária"],
  "corretora de seguros": ["Seguros"],
  "corretoras de seguros": ["Seguros"],
  "agencias de emprego": ["Recursos Humanos"],
  "material grafico": ["Gráficas"],
  "materiais graficos": ["Gráficas"],
  "comunicacao visual": ["Gráficas"],
  "produtoras de video": ["Produtora de Vídeo"],
  "coworkings": ["Espaços Compartilhados"],
  "escritorios compartilhados": ["Espaços Compartilhados"],
  "consultorios compartilhados": ["Espaços Compartilhados"],
  "administradoras de condominios": ["Condomínios"],
  "sindicos profissionais": ["Condomínios"],

  "barbearia e salao masculino": ["Barbearia"],
  cabelo: ["Salão de Beleza"],
  "cabelo e colorimetria": ["Salão de Beleza"],
  "cabelo e estetica": ["Salão de Beleza", "Estética"],
  "cabelos cacheados e crespos": ["Salão de Beleza"],
  "centro de estetica e beleza": ["Estética", "Salão de Beleza"],
  "estetica e beleza": ["Estética"],
  "escova express": ["Salão de Beleza"],
  "unhas e maquiagem": ["Unhas", "Maquiagem"],
  maquiadores: ["Maquiagem"],

  bercarios: ["Educação Infantil"],
  creches: ["Educação Infantil"],
  "escola infantil": ["Educação Infantil"],
  "escola particular": ["Escola Particular"],
  "cursos de ingles": ["Escolas de Idiomas"],
  "faculdade": ["Ensino Superior"],
  universidade: ["Ensino Superior"],

  "aluguel de mesas e cadeiras": ["Aluguel para Festas"],
  "aluguel de brinquedos": ["Aluguel para Festas"],
  "artigos para festas": ["Artigos para Festas"],
  "lojas de festas": ["Artigos para Festas"],
  "lojas de embalagens": ["Artigos para Festas"],
  "decoracao de festas": ["Decoração de Festas"],
  "chacaras para eventos": ["Espaços para Eventos"],
  "saloes de festa": ["Espaços para Eventos"],
  "espacos de lazer": ["Espaços para Eventos"],
  "organizadores de eventos": ["Cerimonialistas"],
  "filmagem de casamento": ["Produtora de Vídeo"],
  fotografos: ["Fotógrafos"],

  "casas de racao": ["Rações"],
  "pet shops": ["Pet Shop"],
  "veterinarios": ["Clínica Veterinária"],
  "lojas agropecuarias": ["Agropecuária"],
};

let cache = { loadedAt: 0, rows: [] };
const rateLimitStore = new Map();

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logApiEvent(level, event, context = {}) {
  console[level === "error" ? "error" : "warn"](JSON.stringify({
    level,
    service: "busca-salto-api",
    event,
    requestId: context.requestId,
    mode: context.mode || "list",
    path: context.path,
    method: context.method,
    ip: context.ip,
    message: context.message,
    stack: context.stack,
    timestamp: new Date().toISOString(),
  }));
}

function logApiError(error, context = {}) {
  logApiEvent("error", "api_error", {
    ...context,
    message: error?.message || "Erro desconhecido",
    stack: error?.stack,
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.end(JSON.stringify(body));
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeSearchText(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value = "") {
  const lowerWords = new Set(["a", "ao", "aos", "as", "com", "da", "de", "do", "dos", "e", "em", "para", "por"]);
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\S+/g, (word, index) => {
      if (index > 0 && lowerWords.has(word)) return word;
      return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
    });
}

function canonicalCategory(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return CATEGORY_CANONICAL[normalizeSearchText(trimmed)] || titleCase(trimmed);
}

function canonicalSubcategory(value = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return SUBCATEGORY_CANONICAL[normalizeSearchText(trimmed)] || titleCase(trimmed);
}

function canonicalSubcategoryParts(value = "") {
  const normalized = normalizeSearchText(value);
  const expanded = SUBCATEGORY_EXPANSIONS[normalized];
  if (expanded?.length) return expanded;
  return [canonicalSubcategory(value)].filter(Boolean);
}

function canonicalSubcategories(value = "") {
  const unique = new Map();
  for (const part of splitSubcategories(value).flatMap(canonicalSubcategoryParts)) {
    const key = normalizeSearchText(part);
    if (key) unique.set(key, part);
  }
  return [...unique.values()];
}

function compactSearchText(value = "") {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function singularizeToken(token = "") {
  if (token.length <= 3) return token;
  if (token.endsWith("oes")) return `${token.slice(0, -3)}ao`;
  if (token.endsWith("ais")) return `${token.slice(0, -3)}al`;
  if (token.endsWith("eis")) return `${token.slice(0, -3)}el`;
  if (token.endsWith("is")) return token.slice(0, -1);
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function searchVariants(term = "") {
  const normalized = normalizeSearchText(term);
  const singular = singularizeToken(normalized);
  const aliases = [
    ...(SEARCH_ALIASES[normalized] || []),
    ...(SEARCH_ALIASES[singular] || []),
  ].flatMap((alias) => [normalizeSearchText(alias), singularizeToken(normalizeSearchText(alias))]);
  return [...new Set([normalized, singular, ...aliases].filter(Boolean))];
}

function levenshteinDistance(a = "", b = "", maxDistance = 2) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previous = current;
  }
  return previous[b.length];
}

function fuzzyLimit(term = "") {
  if (term.length < 5) return 0;
  if (term.length < 11) return 1;
  return 2;
}

function hasSimilarPrefix(a = "", b = "") {
  const size = Math.min(a.length, b.length);
  if (size < 5) return a.slice(0, 3) === b.slice(0, 3);
  return a.slice(0, 4) === b.slice(0, 4);
}

function prepareSearchField(value = "") {
  const text = normalizeSearchText(value);
  const tokens = text.split(" ").filter(Boolean);
  return {
    text,
    compact: compactSearchText(text),
    tokens,
    variants: new Set(tokens.flatMap(searchVariants)),
    compactVariants: new Set(tokens.flatMap(searchVariants).map(compactSearchText).filter(Boolean)),
  };
}

function fieldRelevance(field, rawTerm, weight) {
  const terms = searchVariants(rawTerm);
  if (!terms.length) return 0;

  if (terms.some((term) => field.tokens.includes(term))) return weight;
  if (terms.some((term) => field.variants.has(term))) return Math.round(weight * 0.85);
  if (terms.some((term) => term.length >= 5 && field.tokens.some((token) => token.startsWith(term)))) return Math.round(weight * 0.7);
  if (terms.some((term) => term.length >= 6 && field.compactVariants.has(compactSearchText(term)))) return Math.round(weight * 0.65);

  const limit = Math.max(...terms.map(fuzzyLimit));
  if (!limit) return 0;

  const hasFuzzyMatch = field.tokens.some((token) => {
    if (token.length < 5) return false;
    return terms.some((term) => hasSimilarPrefix(term, token) && levenshteinDistance(term, token, limit) <= limit);
  });
  return hasFuzzyMatch ? Math.round(weight * 0.55) : 0;
}

function searchTerms(value = "") {
  return normalizeSearchText(value)
    .split(" ")
    .filter((term) => term.length >= 2 && !SEARCH_STOPWORDS.has(term));
}

function splitSubcategories(value = "") {
  return String(value || "")
    .split(/[;,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function categoryMatches(item, selectedCategory = "") {
  if (!selectedCategory) return true;
  const selected = normalizeSearchText(selectedCategory);
  if (!selected) return true;
  const categoryValues = [
    item.categoria,
    canonicalCategory(item.categoria),
  ].map(normalizeSearchText);
  if (categoryValues.includes(selected)) return true;
  return canonicalSubcategories(item.subcategoria).some((subcategoria) => {
    const subcategoryValues = [
      subcategoria,
      canonicalSubcategory(subcategoria),
    ].map(normalizeSearchText);
    return subcategoryValues.includes(selected);
  });
}

function bairroMatches(item, selectedBairro = "") {
  if (!selectedBairro) return true;
  return normalizeSearchText(item.bairro) === normalizeSearchText(selectedBairro);
}

function normalizeHeader(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function headerKey(header, index) {
  const key = normalizeHeader(header);
  if (key) return key;
  return index === 0 ? "id" : `col_${index + 1}`;
}

function findHeaderIndex(values = []) {
  return Math.max(0, values.findIndex((row) => {
    const keys = new Set((row || []).map((header, index) => headerKey(header, index)));
    return keys.has("id") && keys.has("nome") && keys.has("categoria");
  }));
}

function cleanParam(value, maxLength = 80) {
  return String(value || "").trim().slice(0, maxLength);
}

function parsePositiveInt(value, fallback, max) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function paginationPolicy({ busca, categoria, bairro }) {
  const hasTextSearch = normalize(busca).length >= 3;
  const hasCategory = Boolean(categoria);
  const hasBairro = Boolean(bairro);

  if (hasTextSearch) return { maxPage: PAGINATION_LIMITS.TEXT_SEARCH, reason: "text_search" };
  if (hasCategory && hasBairro) return { maxPage: PAGINATION_LIMITS.COMBINED_FILTER, reason: "combined_filter" };
  if (hasCategory || hasBairro) return { maxPage: PAGINATION_LIMITS.BROAD_FILTER, reason: "broad_filter" };
  return { maxPage: PAGINATION_LIMITS.NONE, reason: "no_filter" };
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  return firstForwardedIp || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
}

function pruneRateLimitStore(now) {
  if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) return;
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key);
    if (rateLimitStore.size <= RATE_LIMIT_MAX_KEYS) break;
  }
}

function checkRateLimit(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = ip || "unknown";
  const current = rateLimitStore.get(key);

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    pruneRateLimitStore(now);
    return { allowed: true, ip, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) };
  }

  current.count += 1;
  const resetAfterSeconds = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - current.windowStart)) / 1000));
  return {
    allowed: current.count <= RATE_LIMIT_MAX_REQUESTS,
    ip,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - current.count),
    resetAfterSeconds,
  };
}

function applyRateLimitHeaders(res, result) {
  res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(result.remaining));
  res.setHeader("X-RateLimit-Reset", String(result.resetAfterSeconds));
  if (!result.allowed) res.setHeader("Retry-After", String(result.resetAfterSeconds));
}

function normalizePlan(plan = "") {
  const normalized = normalize(plan);
  if (normalized === "top") return "top";
  if (normalized === "destaque") return "destaque";
  if (normalized === "parceiro") return "parceiro";
  return "gratuito";
}

function allowsImage(plan) {
  return normalizePlan(plan) !== "gratuito";
}

function allowsOffer(plan) {
  const normalized = normalizePlan(plan);
  return normalized === "destaque" || normalized === "top";
}

function truncateText(value = "", maxLength = 160) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function publicImageUrl(url = "") {
  const value = String(url || "").trim();
  const match = value.match(/[?&]id=([^&]+)/) || value.match(/\/d\/([^/]+)/) || value.match(/\/file\/d\/([^/]+)/);
  if (!match) return value;
  return `/api/imagem?id=${encodeURIComponent(decodeURIComponent(match[1]))}&sz=w1000`;
}

function seededRandom(input = "") {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function qualityScore(item) {
  let score = 0;
  if (item.nome) score += 10;
  if (item.categoria) score += 8;
  if (item.subcategoria) score += 6;
  if (item.bairro) score += 8;
  if (item.endereco) score += 8;
  if (item.whatsapp) score += 10;
  else if (item.telefone) score += 8;
  if (item.descricao) score += 8;
  if (item.palavras_chave) score += 6;

  const digitalSignals = [item.instagram, item.facebook, item.site].filter(Boolean).length;
  score += Math.min(digitalSignals * 2, 6);

  if (allowsImage(item.tipo_exibicao) && item.foto_url) score += 6;
  if (allowsOffer(item.tipo_exibicao) && item.oferta) score += 6;
  if (normalize(item.verificado) === "sim") score += 8;
  return score;
}

function rowToObject(headers, row, index) {
  const raw = {};
  headers.forEach((header, index) => {
    raw[normalizeHeader(header)] = String(row[index] || "").trim();
  });
  const plan = normalizePlan(raw.plano || raw.tipo_exibicao);
  const fotos = [
    raw.foto_url || raw.imagem || raw.imagem_url,
    raw.foto_url_2,
    raw.foto_url_3,
    raw.foto_url_4,
    raw.foto_url_5,
  ].map((url) => String(url || "").trim()).filter(Boolean);
  return {
    id: raw.id || String(index + 1),
    nome: raw.nome,
    categoria: raw.categoria,
    subcategoria: raw.subcategoria,
    bairro: raw.bairro,
    endereco: raw.endereco,
    whatsapp: raw.whatsapp,
    instagram: raw.instagram,
    site: raw.site,
    descricao: raw.descricao,
    palavras_chave: raw.palavras_chave,
    facebook: raw.facebook,
    telefone: raw.telefone,
    tipo_exibicao: plan,
    oferta: raw.oferta,
    foto_url: fotos[0] || "",
    fotos,
    status: raw.status || "ativo",
    prioridade: Number.parseInt(raw.prioridade || "0", 10) || 0,
    verificado: raw.verificado,
  };
}

async function loadRows() {
  const now = Date.now();
  if (cache.rows.length && now - cache.loadedAt < CACHE_TTL_MS) return cache.rows;

  const sheets = await getSheetsClient([GOOGLE_SCOPES.sheetsRead]);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const values = response.data.values || [];
  const headerIndex = findHeaderIndex(values);
  const headers = values[headerIndex] || [];
  const rows = values
    .slice(headerIndex + 1)
    .map((row, index) => rowToObject(headers, row, index))
    .filter((row) => row.nome && normalize(row.status) === "ativo");

  cache = { loadedAt: now, rows };
  return rows;
}

function publicItem(item) {
  const plan = normalizePlan(item.tipo_exibicao);
  const subcategorias = canonicalSubcategories(item.subcategoria);
  return {
    id: item.id,
    nome: item.nome,
    categoria: canonicalCategory(item.categoria),
    subcategoria: subcategorias.join("; "),
    bairro: item.bairro,
    endereco: item.endereco,
    descricao: plan === "gratuito" ? truncateText(item.descricao) : item.descricao,
    palavras_chave: item.palavras_chave,
    tipo_exibicao: plan,
    oferta: allowsOffer(plan) ? item.oferta : "",
    foto_url: allowsImage(plan) ? publicImageUrl(item.foto_url) : "",
    fotos: allowsImage(plan) ? (item.fotos || []).map(publicImageUrl) : [],
    has_whatsapp: Boolean(item.whatsapp),
    has_telefone: Boolean(item.telefone),
    has_instagram: Boolean(item.instagram),
    has_facebook: Boolean(item.facebook),
    has_site: Boolean(item.site),
  };
}

function planWeight(plan = "") {
  const normalized = normalizePlan(plan);
  if (normalized === "top") return 220;
  if (normalized === "destaque") return 140;
  if (normalized === "parceiro") return 80;
  return 0;
}

function computeScore(item, terms) {
  const fields = {
    nome: prepareSearchField(item.nome),
    categoria: prepareSearchField(`${item.categoria} ${canonicalCategory(item.categoria)}`),
    subcategoria: prepareSearchField(`${item.subcategoria} ${canonicalSubcategories(item.subcategoria).join(" ")}`),
    bairro: prepareSearchField(item.bairro),
    descricao: prepareSearchField(item.descricao),
    palavras: prepareSearchField(item.palavras_chave),
  };
  let relevance = 0;
  for (const term of terms) {
    const termScore =
      fieldRelevance(fields.nome, term, 60) +
      fieldRelevance(fields.categoria, term, 50) +
      fieldRelevance(fields.subcategoria, term, 45) +
      fieldRelevance(fields.palavras, term, 30) +
      fieldRelevance(fields.descricao, term, 14) +
      fieldRelevance(fields.bairro, term, 8);
    if (termScore <= 0) return 0;
    relevance += termScore;
  }
  const base = planWeight(item.tipo_exibicao) + item.prioridade * 20 + qualityScore(item);
  if (!terms.length) return base;
  return relevance ? relevance + base : 0;
}

function sortItems(items, terms, seed) {
  return items
    .map((item) => ({
      item,
      score: computeScore(item, terms),
      random: normalizePlan(item.tipo_exibicao) === "gratuito" ? seededRandom(`${seed}:${item.id}:${item.nome}`) : 0,
    }))
    .filter(({ score }) => !terms.length || score > 0)
    .sort((a, b) => {
      const aPlan = normalizePlan(a.item.tipo_exibicao);
      const bPlan = normalizePlan(b.item.tipo_exibicao);
      const scoreDiff = b.score - a.score;
      const comparableFree = aPlan === "gratuito" && bPlan === "gratuito" && Math.abs(scoreDiff) <= 20;
      if (comparableFree && b.random !== a.random) return b.random - a.random;
      if (scoreDiff !== 0) return scoreDiff;
      if (b.random !== a.random) return b.random - a.random;
      return String(a.item.nome || "").localeCompare(String(b.item.nome || ""), "pt-BR");
    })
    .map(({ item }) => item);
}

function buildFilters(rows) {
  const categoryGroups = new Map();
  for (const row of rows) {
    const categoria = canonicalCategory(row.categoria);
    if (!categoria) continue;

    const categoryKey = normalizeSearchText(categoria);
    if (!categoryGroups.has(categoryKey)) {
      categoryGroups.set(categoryKey, { categoria, subcategorias: new Map() });
    }

    const group = categoryGroups.get(categoryKey);
    for (const subcategoria of canonicalSubcategories(row.subcategoria)) {
      const subKey = normalizeSearchText(subcategoria);
      if (!subKey || subKey === categoryKey) continue;
      group.subcategorias.set(subKey, subcategoria);
    }
  }

  const categoriasAgrupadas = [...categoryGroups.values()]
    .map((group) => ({
      categoria: group.categoria,
      subcategorias: [...group.subcategorias.values()].sort((a, b) => a.localeCompare(b, "pt-BR")),
    }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));

  const categorias = categoriasAgrupadas
    .flatMap((group) => [`◆ ${group.categoria}`, ...group.subcategorias.map((subcategoria) => `  ${subcategoria}`)])
    .filter(Boolean);

  return {
    categorias,
    categoriasAgrupadas,
    bairros: [...new Set(rows.map((row) => row.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

function contactValue(item, type) {
  if (type === "whatsapp") return item.whatsapp;
  if (type === "telefone") return item.telefone;
  if (type === "instagram") return item.instagram;
  if (type === "facebook") return item.facebook;
  if (type === "site") return item.site;
  return "";
}

module.exports = async function handler(req, res) {
  const requestId = createRequestId();
  res.setHeader("X-Request-Id", requestId);

  if (req.method !== "GET") return json(res, 405, { error: "Metodo nao permitido.", requestId });

  const mode = cleanParam(req.query.mode, 20);
  const rateLimit = checkRateLimit(req);
  applyRateLimitHeaders(res, rateLimit);

  if (!rateLimit.allowed) {
    logApiEvent("warn", "rate_limit_exceeded", {
      requestId,
      mode,
      method: req.method,
      path: req.url,
      ip: rateLimit.ip,
      message: "Limite simples da API excedido.",
    });
    return json(res, 429, { error: "Muitas requisicoes em pouco tempo. Tente novamente em instantes.", requestId });
  }

  try {
    const rows = await loadRows();

    if (mode === "filters") {
      return json(res, 200, { filters: buildFilters(rows), updatedAt: new Date(cache.loadedAt).toISOString() });
    }

    if (mode === "contact") {
      const id = cleanParam(req.query.id, 30);
      const type = normalize(cleanParam(req.query.tipo, 20));
      if (!id || !CONTACT_TYPES.has(type)) return json(res, 400, { error: "Contato invalido.", requestId });
      const item = rows.find((row) => String(row.id) === id);
      if (!item) return json(res, 404, { error: "Comercio nao encontrado.", requestId });
      return json(res, 200, { id: item.id, tipo: type, valor: contactValue(item, type) || "" });
    }

    const busca = cleanParam(req.query.busca, 80);
    const categoria = cleanParam(req.query.categoria, 80);
    const bairro = cleanParam(req.query.bairro, 80);
    const seed = cleanParam(req.query.seed, 80) || String(Math.floor(Date.now() / RANDOM_BUCKET_MS));
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const terms = searchTerms(busca);
    const hasRefinement = Boolean(busca || categoria || bairro);
    const effectivePage = hasRefinement ? page : 1;
    const pagePolicy = paginationPolicy({ busca, categoria, bairro });

    let filtered = rows.filter((item) => categoryMatches(item, categoria) && bairroMatches(item, bairro));
    filtered = sortItems(filtered, terms, seed);

    const publicTotal = Math.min(filtered.length, pagePolicy.maxPage * limit);
    const start = (effectivePage - 1) * limit;
    const items = filtered.slice(0, publicTotal).slice(start, start + limit).map(publicItem);
    const paginationLimited = filtered.length > publicTotal;

    if (page > pagePolicy.maxPage && hasRefinement) {
      logApiEvent("warn", "pagination_limited", {
        requestId,
        mode,
        method: req.method,
        path: req.url,
        ip: rateLimit.ip,
        message: `Paginacao limitada para consulta ${pagePolicy.reason}.`,
      });
    }

    return json(res, 200, {
      items,
      total: publicTotal,
      page: effectivePage,
      limit,
      hasMore: hasRefinement && start + limit < publicTotal,
      paginationLimited,
      seed,
      updatedAt: new Date(cache.loadedAt).toISOString(),
    });
  } catch (error) {
    logApiError(error, {
      requestId,
      mode,
      method: req.method,
      path: req.url,
      ip: rateLimit.ip,
    });
    return json(res, 500, { error: "Nao foi possivel carregar os dados agora.", requestId });
  }
};
