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

assert.equal(sameCommerce(existing, { ...incoming, endereco: "Av. Dom Pedro II, 1300, Salto/SP" })?.score, 1);
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

const cases = [
  {
    id: "508", existingName: "Restaurante do Mateus / Mateus Marmitex", incomingName: "Mateus Marmitex",
    existingAddress: "Rua Roque Lazzazera, 950, Jardim Santa Marta, Salto/SP",
    incomingAddress: "Rua Roque Lazzazera, 950, Jardim Santa Marta, Salto/SP", subcategoria: "Marmitaria", score: 3,
  },
  {
    id: "515", existingName: "Mineiro Delivery", incomingName: "Mineiro Delivery Salto",
    existingAddress: "Rua Quintino Bocaiúva, 344, Vila Nova, Salto/SP",
    incomingAddress: "Rua Quintino Bocaiuva, 344, Vila Nova, Salto/SP", subcategoria: "Restaurante", score: 3,
  },
  {
    id: "556", existingName: "O Sorvetão", incomingName: "O Sorvetão Salto das Nações",
    existingAddress: "Rua Floriano Peixoto, 3087, Jardim das Nações, Salto/SP",
    incomingAddress: "Rua Floriano Peixoto, 3087, Jardim das Nações, Salto/SP", subcategoria: "Sorveteria", score: 3,
  },
  {
    id: "652", existingName: "Norba’s Salto", incomingName: "Norba's Pizzaria",
    existingAddress: "", incomingAddress: "Rua Barão do Rio Branco, 1217, Vila Teixeira, Salto/SP",
    subcategoria: "Pizzaria", score: 1,
  },
  {
    id: "613", existingName: "Casa Paulistana", incomingName: "Paulistana Padaria & Restaurante",
    existingAddress: "Rua Diamante, 68, Jardim Sontag, Salto/SP",
    incomingAddress: "Rua Diamante, 68, Jardim Sontag, Salto/SP", subcategoria: "Padaria", score: 3,
  },
  {
    id: "648", existingName: "Pizzaria La Conquista Salto", incomingName: "Nova La Conquista Salto",
    existingAddress: "Rua Estado do Mato Grosso, 10, São Pedro e São Paulo, Salto/SP",
    incomingAddress: "Rua Estado do Mato Grosso, 10, Terras de São Pedro e São Paulo, Salto/SP",
    subcategoria: "Pizzaria", score: 3,
  },
  {
    id: "521", existingName: "Cardamomo Hamburgueria", incomingName: "Cardamomo Hamburgueria Salto",
    existingAddress: "Salto/SP - endereço não confirmado",
    incomingAddress: "Rua Benjamin Constant, 32, Centro, Salto/SP", subcategoria: "Hamburgueria", score: 1,
  },
  {
    id: "494", existingName: "Patrick's Burgers", incomingName: "Patrick's Burgers",
    existingAddress: "Salto/SP - endereço não confirmado",
    incomingAddress: "Rua Doutor Barros Júnior, 254, Centro, Salto/SP", subcategoria: "Hamburgueria", score: 1,
  },
  {
    id: "586", existingName: "Ohiro Sushi", incomingName: "Ohiro Sushi Salto",
    existingAddress: "Rua Rio Branco, 640, Centro, Salto/SP", incomingAddress: "",
    subcategoria: "Comida Japonesa", score: 1,
  },
  {
    id: "563", existingName: "Casa Aliança Gourmet", incomingName: "Padaria Aliança",
    existingAddress: "Rua Rui Barbosa, 1043, Salto/SP; Rua Rio Branco, 1304, Salto/SP",
    incomingAddress: "Rua Rui Barbosa, 1043, Salto/SP", subcategoria: "Padaria", score: 3,
  },
  {
    id: "523", existingName: "Jump Burguer", incomingName: "Jump Burger",
    existingAddress: "Av. José Maria Marques de Oliveira, 1026, Jardim São João, Salto/SP",
    incomingAddress: "", subcategoria: "Hamburgueria", score: 1,
  },
  {
    id: "645", existingName: "Kadri Pizzaria", incomingName: "Kadri Pizzaria",
    existingAddress: "Rua John Kennedy, 537, Parque Bela Vista, Salto/SP",
    incomingAddress: "Rua Monsenhor Couto, 494, Centro, Salto/SP", subcategoria: "Pizzaria", score: 1,
  },
  {
    id: "584", existingName: "Restaurante Colorau Comida Caseira", incomingName: "Restaurante Colorau",
    existingAddress: "Rua Quintino Bocaiúva, 440, Centro, Salto/SP",
    incomingAddress: "", subcategoria: "Restaurante", score: 1,
  },
];

for (const item of cases) {
  const current = { id: item.id, nome: item.existingName, endereco: item.existingAddress, categoria: "Alimentação", subcategoria: item.subcategoria };
  const fromCsv = { nome: item.incomingName, endereco: item.incomingAddress, categoria: "Alimentação", subcategoria: item.subcategoria };
  assert.equal(findMatch([current], fromCsv)?.score, item.score, item.incomingName);
}

assert.ok(fieldComparison({ endereco: "Salto/SP - endereço não confirmado" },
  { endereco: "Rua Benjamin Constant, 32, Centro, Salto/SP" }).additions.some((field) => field.label === "Endereco"));
assert.equal(sameCommerce(
  { nome: "Pastelaria Pereira Centro", endereco: "Rua Rodrigues Alves, 157, Salto/SP", categoria: "Alimentação" },
  { nome: "Pastelaria do Pereira Express", endereco: "Av. José Maria Marques de Oliveira, 588, Salto/SP", categoria: "Alimentação" },
), null);
assert.equal(sameCommerce(
  { nome: "Norba's Salto", categoria: "Alimentação", endereco: "", subcategoria: "Pizzaria" },
  { nome: "Norba's Pizzaria", categoria: "Automotivo", endereco: "", subcategoria: "Mecânica" },
), null);
assert.equal(sameCommerce(
  { nome: "Casa Central", endereco: "Rua Brasil, 10", categoria: "Alimentação" },
  { nome: "Pizzaria Imperial", endereco: "Rua Brasil, 10", categoria: "Alimentação" },
), null);
assert.equal(sameCommerce(
  { nome: "Padaria Aliança", endereco: "Rua Rui Barbosa, 1043, Salto/SP", categoria: "Alimentação" },
  { nome: "Padaria Aliança Salto", endereco: "Rua Rio Branco, 1304, Salto/SP", categoria: "Alimentação" },
), null);
assert.equal(sameCommerce(
  { nome: "Jump Burguer", categoria: "Alimentação", endereco: "Rua A, 1" },
  { nome: "Jump Burger", categoria: "Alimentação", endereco: "Rua B, 2" },
), null);
assert.equal(sameCommerce(
  { nome: "Jump Burguer", categoria: "Alimentação", endereco: "" },
  { nome: "Outro Burger", categoria: "Alimentação", endereco: "" },
), null);
assert.equal(sameCommerce(
  { nome: "Jump Burguer", categoria: "Alimentação", endereco: "" },
  { nome: "Jump Pizzaria", categoria: "Alimentação", endereco: "" },
), null);
assert.equal(sameCommerce(
  { nome: "Jump Burguer", categoria: "Alimentação", endereco: "" },
  { nome: "Jump Burger", categoria: "Automotivo", endereco: "" },
), null);
assert.equal(sameCommerce(
  { nome: "Jump Burguer Salto", categoria: "Alimentação", endereco: "" },
  { nome: "Jump Burger", categoria: "Alimentação", endereco: "" },
)?.score, 1);
assert.equal(sameCommerce(
  { nome: "Jump Burguers", categoria: "Alimentação", endereco: "" },
  { nome: "Jump Burgers", categoria: "Alimentação", endereco: "" },
)?.score, 1);
assert.equal(sameCommerce(
  { nome: "Burguer", categoria: "Alimentação", endereco: "" },
  { nome: "Burger", categoria: "Alimentação", endereco: "" },
), null);
assert.equal(sameCommerce(
  { nome: "Burguer", categoria: "Alimentação", endereco: "Rua A, 1" },
  { nome: "Burger", categoria: "Alimentação", endereco: "Rua A, 1" },
)?.score, 2);
assert.match(sameCommerce(
  { nome: "Kadri Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "Rua John Kennedy, 537" },
  { nome: "Kadri Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "Rua Monsenhor Couto, 494" },
)?.reason || "", /enderecos diferentes/);
assert.ok(fieldComparison(
  { endereco: "Rua John Kennedy, 537, Parque Bela Vista, Salto/SP" },
  { endereco: "Rua Monsenhor Couto, 494, Centro, Salto/SP" },
).differences.some((field) => field.label === "Endereco"));
assert.equal(sameCommerce(
  { nome: "Kadri Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "Rua A, 1" },
  { nome: "Kadri Pizzaria", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "Rua B, 2" },
), null);
assert.equal(sameCommerce(
  { nome: "Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "Rua A, 1" },
  { nome: "Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "Rua B, 2" },
), null);
assert.equal(sameCommerce(
  { nome: "Restaurante Colorau Comida Caseira", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "Rua A, 1" },
  { nome: "Restaurante Colorau", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "Rua B, 2" },
), null);
assert.equal(sameCommerce(
  { nome: "Restaurante Colorau Comida Caseira", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "" },
  { nome: "Colorau Pizzaria", categoria: "Alimentação", subcategoria: "Pizzaria", endereco: "" },
), null);
assert.equal(sameCommerce(
  { nome: "Restaurante Colorau Comida Caseira", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "" },
  { nome: "Restaurante Sabor Caseiro", categoria: "Alimentação", subcategoria: "Restaurante", endereco: "" },
), null);

console.log("Commerce duplicate matching and enrichment checks passed.");
