const assert = require("node:assert/strict");
const google = require("../api/_lib/google");
const { canonicalCategory, canonicalSubcategories } = require("../api/_lib/taxonomy");
const { sanitizeCommercePayload } = require("../api/_lib/sheets-admin");

let exists = false;
let header = [];
let rows = [];
let rowCount = 1000;
const fakeSheets = { spreadsheets: {
  get: async () => ({ data: { sheets: exists ? [{ properties: {
    sheetId: 7, title: "taxonomia_extra", gridProperties: { rowCount },
  } }] : [] } }),
  batchUpdate: async ({ requestBody }) => {
    const request = requestBody.requests[0];
    if (request.addSheet) {
      exists = true;
      return { data: { replies: [{ addSheet: { properties: {
        sheetId: 7, title: "taxonomia_extra", gridProperties: { rowCount },
      } } }] } };
    }
    if (request.appendDimension) rowCount += request.appendDimension.length;
    return { data: { replies: [] } };
  },
  values: {
    get: async ({ range }) => ({ data: { values: range.startsWith("base_interna!")
      ? [
        ["id", "nome", "categoria", "subcategoria", "bairro", "status", "plano"],
        ["9001", "Clinica Exemplo", "Saude da Mulher", "ginecologia", "Centro", "ativo", "gratuito"],
      ]
      : range.endsWith("A1:C1")
        ? (header.length ? [header] : [])
        : (header.length ? [header, ...rows] : []) } }),
    update: async ({ range, requestBody }) => {
      if (range.endsWith("A1:C1")) header = requestBody.values[0];
      else {
        const rowNumber = Number(range.match(/!A(\d+):C\d+$/)?.[1]);
        assert.ok(rowNumber >= 2, range);
        rows[rowNumber - 2] = requestBody.values[0];
      }
      return { data: {} };
    },
  },
} };

const originalClient = google.getSheetsClient;
google.getSheetsClient = async () => fakeSheets;
delete require.cache[require.resolve("../api/_lib/taxonomy-store")];
const { addTaxonomyEntry, readTaxonomy } = require("../api/_lib/taxonomy-store");

async function main() {
  const initial = await readTaxonomy(fakeSheets);
  assert.equal(initial.length, 16);
  assert.equal(initial.reduce((count, group) => count + group.subcategorias.length, 0), 191);
  assert.equal(exists, false);

  await addTaxonomyEntry({ type: "category", categoria: " Saúde da Mulher " });
  await addTaxonomyEntry({ type: "subcategory", categoria: "Saude da Mulher", subcategoria: "Ginecologia" });
  await addTaxonomyEntry({ type: "subcategory", categoria: "Saúde e Bem-estar", subcategoria: "Odontopediatria" });
  const taxonomy = await readTaxonomy(fakeSheets);
  assert.equal(taxonomy.length, 17);
  assert.equal(canonicalCategory("SAUDE DA MULHER", taxonomy), "Saúde da Mulher");
  assert.deepEqual(canonicalSubcategories("ginecologia", "Saúde da Mulher", taxonomy), ["Ginecologia"]);
  assert.deepEqual(canonicalSubcategories("Galeterias", "Alimentação", taxonomy), ["Galeterias"]);
  assert.equal(taxonomy.find((group) => group.categoria === "Saúde e Bem-estar").subcategorias.includes("Odontopediatria"), true);
  assert.deepEqual(header, ["categoria", "subcategoria", "data_criacao"]);
  assert.equal(rows.length, 3);

  const commerce = sanitizeCommercePayload({
    nome: "Teste de categoria", categoria: "SAUDE DA MULHER", subcategoria: "ginecologia",
  }, { taxonomy });
  assert.equal(commerce.categoria, "Saúde da Mulher");
  assert.equal(commerce.subcategoria, "Ginecologia");

  const publicHandler = require("../api/comercios");
  async function publicRequest(query) {
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(body) { this.body = JSON.parse(body); },
    };
    await publicHandler({ method: "GET", query, headers: {}, url: "/api/comercios" }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body;
  }
  const filters = await publicRequest({ mode: "filters" });
  assert.ok(filters.filters.categoriasAgrupadas.some((group) => group.categoria === "Saúde da Mulher"));
  const result = await publicRequest({ categoria: "Saúde da Mulher" });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].subcategoria, "Ginecologia");

  await assert.rejects(addTaxonomyEntry({ type: "category", categoria: "Saude da Mulher" }), { statusCode: 409 });
  await assert.rejects(addTaxonomyEntry({ type: "category", categoria: "Saude" }), { statusCode: 409 });
  await assert.rejects(addTaxonomyEntry({ type: "subcategory", categoria: "Saúde da Mulher", subcategoria: "GINECOLOGIA" }), { statusCode: 409 });
  await assert.rejects(addTaxonomyEntry({ type: "subcategory", categoria: "Saúde da Mulher", subcategoria: "Clínica médica especializada" }), { statusCode: 409 });
  await assert.rejects(addTaxonomyEntry({ type: "category", categoria: "Teste/duplo" }), { statusCode: 400 });
  await assert.rejects(addTaxonomyEntry({ type: "subcategory", categoria: "Categoria ausente", subcategoria: "Teste" }), { statusCode: 400 });
  assert.equal(rows.length, 3);
  console.log("Taxonomy sheet creation, additions, normalization and duplicate checks passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  google.getSheetsClient = originalClient;
});
