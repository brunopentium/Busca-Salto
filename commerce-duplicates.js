(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CommerceDuplicates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FIELDS = [
    ["categoria", "Categoria"], ["subcategoria", "Subcategorias"],
    ["bairro", "Bairro"], ["endereco", "Endereco"],
    ["whatsapp", "WhatsApp"], ["telefone", "Telefone"],
    ["instagram", "Instagram"], ["facebook", "Facebook"],
    ["site", "Site"], ["descricao", "Descricao"],
    ["palavras_chave", "Palavras-chave"], ["oferta", "Oferta"],
    ["fonte_url", "Fonte consultada"], ["data_verificacao", "Data da verificacao"],
  ];

  function normalize(value = "") {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizedAddress(value = "") {
    return normalize(value).replace(/\bav\b/g, "avenida").replace(/\br\b/g, "rua")
      .replace(/\bpca\b/g, "praca").replace(/\bjd\b/g, "jardim");
  }

  function streetAndNumber(value = "") {
    const parts = String(value || "").split(",").map(normalizedAddress);
    let street = parts[0] || "";
    const number = (parts[1] || "").match(/^\d{1,6}\b/)?.[0]
      || street.match(/\b\d{1,6}\b$/)?.[0] || "";
    if (number) street = street.replace(new RegExp(`\\b${number}$`), "").trim();
    const unit = normalizedAddress(value).match(/\b(?:box|sala|loja|conjunto|cj|unidade|apto|apartamento)\s*(\d+[a-z]?)\b/)?.[1] || "";
    return { street, number, unit };
  }

  function contactNumbers(item = {}) {
    return [item.whatsapp, item.telefone].map((value) => String(value || "").replace(/\D/g, ""))
      .filter((value) => value.length >= 10).map((value) => value.replace(/^55(?=\d{10,11}$)/, ""));
  }

  function sharedContact(left, right) {
    const numbers = new Set(contactNumbers(left));
    return contactNumbers(right).some((number) => numbers.has(number));
  }

  function sameCommerce(left = {}, right = {}) {
    const leftName = normalize(left.nome);
    if (!leftName || leftName !== normalize(right.nome)) return null;
    const leftAddress = normalizedAddress(left.endereco);
    const rightAddress = normalizedAddress(right.endereco);
    if (leftAddress && rightAddress) {
      if (leftAddress === rightAddress) return { reason: "Mesmo nome e endereco", score: 3 };
      const first = streetAndNumber(left.endereco);
      const second = streetAndNumber(right.endereco);
      if (first.street && first.street === second.street && first.number && first.number === second.number) {
        if (first.unit && second.unit && first.unit !== second.unit) {
          return sharedContact(left, right) ? { reason: "Mesmo nome e telefone; confira os boxes ou salas", score: 2 } : null;
        }
        if (Boolean(first.unit) !== Boolean(second.unit)) {
          return { reason: "Mesmo nome, rua e numero; complemento ausente em um endereco", score: 1 };
        }
        return { reason: "Mesmo nome, rua e numero", score: 3 };
      }
      return sharedContact(left, right) ? { reason: "Mesmo nome e telefone; confira os enderecos", score: 2 } : null;
    }
    if (sharedContact(left, right)) return { reason: "Mesmo nome e telefone", score: 2 };
    return { reason: "Mesmo nome; endereco ausente em um dos cadastros", score: 1 };
  }

  function findMatch(candidates, incoming) {
    let best = null;
    for (const candidate of candidates) {
      const match = sameCommerce(candidate, incoming);
      if (match && (!best || match.score > best.score)) best = { candidate, ...match };
      if (best?.score === 3) break;
    }
    return best;
  }

  function fieldComparison(existing = {}, incoming = {}) {
    const additions = [];
    const differences = [];
    for (const [key, label] of FIELDS) {
      const value = String(incoming[key] || "").trim();
      if (!value) continue;
      const current = String(existing[key] || "").trim();
      if (!current) additions.push({ label, value });
      else if ((key === "endereco" ? normalizedAddress(current) : normalize(current)) !==
        (key === "endereco" ? normalizedAddress(value) : normalize(value))) {
        differences.push({ label, current, value });
      }
    }
    return { additions, differences };
  }

  return { sameCommerce, findMatch, fieldComparison };
});
