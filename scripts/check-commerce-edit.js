const assert = require("node:assert/strict");
const { TAXONOMY } = require("../api/_lib/taxonomy");

const headers = [
  "", "nome", "categoria", "subcategoria", "bairro", "endereco", "whatsapp",
  "instagram", "site", "descricao", "palavras_chave", "Facebook", "Telefone",
  "plano", "prioridade", "status", "verificado", "oferta", "foto_url",
  "data_atualizacao", "foto_url_2", "foto_url_3", "foto_url_4", "foto_url_5",
  "foto_ajuste", "foto_ajuste_2", "foto_ajuste_3", "foto_ajuste_4", "foto_ajuste_5",
  "fonte_url", "data_verificacao",
];
const row = Array(headers.length).fill("");
Object.assign(row, {
  0: "108",
  1: "Palma de Ouro Dedetizadora",
  2: "Casa e Construção",
  3: "Dedetização; Limpeza de Caixas D'água",
  5: "Salto - SP",
  9: "Descricao anterior",
  13: "gratuito",
  14: "0",
  15: "ativo",
  16: "não",
});
const allValues = [headers, ...Array.from({ length: 107 }, () => []), row];
const writes = [];
let ignoreWrites = false;
const sheets = {
  spreadsheets: {
    values: {
      get: async ({ range }) => ({
        data: { values: range.endsWith("A1:ZZ") ? allValues : [row] },
      }),
      batchUpdate: async ({ requestBody }) => {
        writes.push(requestBody);
        if (ignoreWrites) return { data: {} };
        for (const item of requestBody.data) {
          const match = item.range.match(/!([A-Z]+)109$/);
          assert.ok(match, `Unexpected range: ${item.range}`);
          const index = [...match[1]].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
          row[index] = item.values[0][0];
        }
        return { data: {} };
      },
    },
  },
};

require("../api/_lib/google");
require.cache[require.resolve("../api/_lib/google")].exports = {
  GOOGLE_SCOPES: { sheetsRead: "read", sheetsWrite: "write" },
  getSheetsClient: async () => sheets,
  getSpreadsheetConfig: () => ({ spreadsheetId: "test", sheetName: "base_interna" }),
  sheetRange: (range) => `base_interna!${range}`,
};
require("../api/_lib/taxonomy-store");
require.cache[require.resolve("../api/_lib/taxonomy-store")].exports = {
  readTaxonomy: async () => TAXONOMY,
};
const { updateCommerce } = require("../api/_lib/sheets-admin");

async function main() {
  const submitted = {
    id: "108",
    nome: row[1], categoria: row[2], subcategoria: row[3], bairro: row[4],
    endereco: row[5], whatsapp: row[6], instagram: row[7], site: row[8],
    descricao: row[9], palavras_chave: row[10], facebook: row[11], telefone: row[12],
    plano: row[13], prioridade: row[14], status: row[15], verificado: row[16],
    oferta: row[17], foto_url: row[18], foto_url_2: row[20], foto_url_3: row[21],
    foto_url_4: row[22], foto_url_5: row[23], foto_ajuste: row[24],
    foto_ajuste_2: row[25], foto_ajuste_3: row[26], foto_ajuste_4: row[27],
    foto_ajuste_5: row[28],
  };

  submitted.telefone = "+55 (11) 4028-0000";
  let saved = await updateCommerce("108", submitted);
  assert.equal(saved.telefone, submitted.telefone);
  assert.equal(saved.rowNumber, 109);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].valueInputOption, "RAW");
  assert.deepEqual(writes[0].data.map((item) => item.range), ["base_interna!M109"]);
  assert.equal(row[9], "Descricao anterior");

  submitted.facebook = "https://facebook.com/palmadeouro";
  submitted.site = "https://example.com/?n=108";
  submitted.descricao = "Nova descricao";
  submitted.foto_url = "https://example.com/foto.jpg";
  submitted.telefone = "";
  saved = await updateCommerce("108", submitted);
  assert.equal(saved.telefone, "");
  assert.equal(saved.facebook, submitted.facebook);
  assert.equal(saved.site, submitted.site);
  assert.equal(saved.descricao, submitted.descricao);
  assert.equal(saved.foto_url, submitted.foto_url);
  assert.deepEqual(writes[1].data.map((item) => item.range), [
    "base_interna!I109", "base_interna!J109", "base_interna!L109",
    "base_interna!M109", "base_interna!S109",
  ]);

  Object.assign(submitted, {
    bairro: "Centro",
    endereco: "Rua Exemplo, 108",
    whatsapp: "+55 (11) 99999-1080",
    instagram: "@palmadeouro",
    palavras_chave: "dedetizacao, limpeza",
    plano: "parceiro",
    prioridade: "1",
    status: "inativo",
    verificado: "sim",
    oferta: "Atendimento em Salto",
    foto_url_2: "https://example.com/foto-2.jpg",
    foto_ajuste: JSON.stringify({ fit: "cover", zoom: 1.2, x: 60, y: 50 }),
  });
  saved = await updateCommerce("108", submitted);
  for (const key of [
    "bairro", "endereco", "whatsapp", "instagram", "palavras_chave", "plano",
    "prioridade", "status", "verificado", "oferta", "foto_url_2", "foto_ajuste",
  ]) {
    assert.equal(saved[key], submitted[key], `Field ${key} did not persist`);
  }

  const beforeNoop = writes.length;
  await updateCommerce("108", submitted);
  assert.equal(writes.length, beforeNoop);

  submitted.telefone = "(11) 99999-1234";
  ignoreWrites = true;
  await assert.rejects(updateCommerce("108", submitted), (error) => {
    assert.equal(error.statusCode, 409);
    assert.match(error.message, /telefone/);
    return true;
  });
  assert.equal(row[12], "");
  console.log("Commerce edit: changed cells only, literal contacts, clearing, images and read-back passed.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
