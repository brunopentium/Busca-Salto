const https = require("https");

const BASE_URL = (process.env.BUSCA_SALTO_BASE_URL || "https://busca-salto.vercel.app").replace(/\/+$/, "");
const LIMIT = 30;

const CASES = [
  {
    query: "pastelaria",
    minResults: 1,
    forbidden: ["papelaria"],
  },
  {
    query: "pastel",
    minResults: 1,
    forbidden: ["papelaria"],
  },
  {
    query: "papelaria",
    minResults: 1,
    forbidden: ["pastelaria"],
  },
  {
    query: "carro",
    minResults: 1,
    forbidden: ["carro de bebe", "carrinho de bebe", "infantil"],
  },
  {
    query: "marmita",
    minResults: 1,
    expectedAny: ["marmitaria", "restaurante"],
  },
];

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requestJson(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}${path.includes("?") ? "&" : "?"}_=${Date.now()}`;
    https
      .get(url, { headers: { "user-agent": "busca-salto-check-public-search", "cache-control": "no-cache" } }, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode, data });
          } catch (error) {
            reject(new Error(`Resposta invalida de ${url}: HTTP ${res.statusCode} ${body.slice(0, 120)}`));
          }
        });
      })
      .on("error", reject);
  });
}

function itemText(item) {
  return normalize([
    item.nome,
    item.categoria,
    item.subcategoria,
    item.bairro,
    item.descricao,
    item.palavras_chave,
  ].filter(Boolean).join(" "));
}

async function checkSearchCase(testCase) {
  const response = await requestJson(`/api/comercios?busca=${encodeURIComponent(testCase.query)}&limit=${LIMIT}`);
  if (response.status !== 200) {
    throw new Error(`Busca "${testCase.query}" retornou HTTP ${response.status}.`);
  }

  const items = response.data.items || [];
  if (items.length < testCase.minResults) {
    throw new Error(`Busca "${testCase.query}" retornou poucos resultados: ${items.length}.`);
  }

  const leakedContacts = items.filter((item) => item.whatsapp || item.telefone || item.instagram || item.facebook || item.site);
  if (leakedContacts.length) {
    throw new Error(`Busca "${testCase.query}" expos contatos diretos na listagem.`);
  }

  const forbidden = (testCase.forbidden || []).map(normalize);
  const badItems = items.filter((item) => forbidden.some((term) => itemText(item).includes(term)));
  if (badItems.length) {
    const names = badItems.slice(0, 5).map((item) => item.nome).join(", ");
    throw new Error(`Busca "${testCase.query}" trouxe resultados indevidos: ${names}.`);
  }

  const expectedAny = (testCase.expectedAny || []).map(normalize);
  if (expectedAny.length && !items.some((item) => expectedAny.some((term) => itemText(item).includes(term)))) {
    throw new Error(`Busca "${testCase.query}" nao trouxe nenhum termo esperado: ${testCase.expectedAny.join(", ")}.`);
  }

  console.log(`ok ${testCase.query}: ${items.length} resultados verificados`);
}

async function checkFilters() {
  const response = await requestJson("/api/comercios?mode=filters");
  if (response.status !== 200) {
    throw new Error(`Filtros retornaram HTTP ${response.status}.`);
  }

  const filters = response.data.filters || {};
  const allLabels = normalize([
    ...(filters.categorias || []),
    ...((filters.categoriasAgrupadas || []).flatMap((group) => [group.categoria, ...(group.subcategorias || [])])),
  ].join(" | "));

  const forbiddenLabels = [
    "restaurante com delivery",
    "restaurante com marmitaria",
    "pastelaria delivery",
    "pizzaria delivery",
    "lojas de moveis",
    "quitandas",
  ];

  const badLabels = forbiddenLabels.filter((label) => allLabels.includes(normalize(label)));
  if (badLabels.length) {
    throw new Error(`Filtros ainda exibem labels antigas: ${badLabels.join(", ")}.`);
  }

  console.log(`ok filtros: ${(filters.categoriasAgrupadas || []).length} grupos verificados`);
}

(async () => {
  for (const testCase of CASES) {
    await checkSearchCase(testCase);
  }
  await checkFilters();
})().catch((error) => {
  console.error(`falhou: ${error.message}`);
  process.exit(1);
});
