const assert = require("node:assert/strict");
const { sameCommerce, findMatch, fieldComparison } = require("../commerce-duplicates");

const existing = {
  id: "539",
  nome: "Santa Esfiha Salto",
  endereco: "Av. Dom Pedro II, 1226, Box 230, Salto/SP",
  bairro: "Vila Teixeira",
  subcategoria: "Esfiharia",
  descricao: "Esfiharia em Salto com esfihas, pizzas, pedidos online e atendimento para consumo ou delivery.",
};
const incoming = {
  nome: "Santa Esfiha Salto",
  endereco: "Avenida Dom Pedro II, 1226, Box 230, Salto/SP",
  bairro: "Vila Teixeira",
  subcategoria: "Esfiharia;Pizzaria",
  telefone: "(11) 2840-0053",
  site: "https://santaesfihasalto.alloy.al/santaesfihasalto",
  descricao: "Esfihas e pizzas com pedidos online.",
};

assert.equal(sameCommerce(existing, incoming)?.score, 3);
assert.equal(findMatch([existing], incoming)?.candidate.id, "539");
const comparison = fieldComparison(existing, incoming);
assert.deepEqual(comparison.additions.map((field) => field.label), ["Telefone", "Site"]);
assert.ok(comparison.differences.some((field) => field.label === "Subcategorias"));
assert.ok(fieldComparison(existing, { facebook: "https://facebook.com/santaesfiha" })
  .additions.some((field) => field.label === "Facebook"));

assert.equal(sameCommerce(existing, { ...incoming, endereco: "Av. Dom Pedro II, 1300, Salto/SP" }), null);
assert.equal(sameCommerce(existing, { ...incoming, endereco: "Av. Dom Pedro II, 1226, Box 231, Salto/SP" }), null);
assert.equal(sameCommerce(existing, { ...incoming, endereco: "Av. Dom Pedro II, 1226, Salto/SP" })?.score, 1);
assert.equal(sameCommerce(existing, { ...incoming, nome: "Outra Esfiharia" }), null);
assert.equal(sameCommerce({ nome: "Padaria Central", endereco: "Rua Jose, 100" },
  { nome: "Padaria Central", endereco: "R. Jose, 100, Centro" })?.score, 3);
assert.equal(sameCommerce({ nome: "Loja Exemplo", telefone: "(11) 99999-0000" },
  { nome: "Loja Exemplo", whatsapp: "+55 11 99999-0000" })?.score, 2);
assert.equal(sameCommerce({ nome: "Filial", endereco: "Rua A, 1", telefone: "(11) 4000-1000" },
  { nome: "Filial", endereco: "Rua B, 2", telefone: "(11) 4000-1000" })?.score, 2);
assert.equal(sameCommerce({ nome: "Loja Exemplo" }, { nome: "Loja Exemplo", endereco: "Rua A, 1" })?.score, 1);
assert.equal(findMatch([
  { ...existing, id: "outro", endereco: "" }, existing,
], incoming)?.candidate.id, "539");
assert.equal(findMatch([{ ...incoming, rowNumber: 2 }], { ...incoming, rowNumber: 3 })?.candidate.rowNumber, 2);

console.log("Commerce duplicate matching and enrichment checks passed.");
