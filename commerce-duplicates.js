(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CommerceDuplicates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const FIELDS = [
    ["nome", "Nome"], ["categoria", "Categoria"], ["subcategoria", "Subcategorias"],
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

  function missingAddress(value = "") {
    const address = normalizedAddress(value);
    return !address || /\b(?:endereco nao confirmado|sem endereco|a confirmar)\b/.test(address)
      || /^(?:salto(?: sp)?|sp)$/.test(address);
  }

  function normalizedName(value = "") {
    return normalize(String(value || "").replace(/['’]/g, ""));
  }

  function nameVariants(value = "") {
    return String(value || "").split(/\s*[/|]\s*/).map(normalizedName).filter(Boolean);
  }

  const GENERIC_NAME_WORDS = new Set([
    "a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "la", "le",
    "casa", "nova", "novo", "gourmet", "restaurante", "padaria", "pizzaria",
    "hamburgueria", "marmitaria", "sorveteria", "cafeteria", "lanchonete",
    "confeitaria", "pastelaria", "delivery", "bar",
  ]);

  function nameCore(value = "") {
    const withoutLocation = normalizedName(value).replace(/\s+salto(?:\s+(?:das|dos|do|da|de)\s+[a-z0-9 ]+)?$/, "");
    return withoutLocation.split(" ").filter((word) => !GENERIC_NAME_WORDS.has(word)).join(" ");
  }

  function burgerSpelling(value) {
    return value.replace(/\bburguers\b/g, "burgers").replace(/\bburguer\b/g, "burger");
  }

  function hasDistinctiveNameWord(value) {
    return value.split(" ").some((word) => word.length >= 4
      && !GENERIC_NAME_WORDS.has(word) && word !== "burger" && word !== "burgers");
  }

  function isExpandedCore(shorter, longer) {
    return shorter !== longer && hasDistinctiveNameWord(shorter)
      && (` ${longer} `).includes(` ${shorter} `);
  }

  function relatedName(left, right) {
    const leftNames = nameVariants(left);
    const rightNames = nameVariants(right);
    if (leftNames.some((name) => rightNames.includes(name))) return "exact";
    const leftCores = leftNames.map(nameCore).filter((name) => name.length >= 5);
    const rightCores = rightNames.map(nameCore).filter((name) => name.length >= 5);
    if (leftCores.some((name) => rightCores.includes(name))) return "brand";
    const rightSpellings = new Set(rightCores.map(burgerSpelling));
    const spellingMatch = leftCores.map(burgerSpelling).find((name) => rightSpellings.has(name));
    if (spellingMatch) return hasDistinctiveNameWord(spellingMatch) ? "brand" : "token";
    if (leftCores.some((leftCore) => rightCores.some((rightCore) =>
      isExpandedCore(leftCore, rightCore) || isExpandedCore(rightCore, leftCore)))) return "expanded";
    const tokens = new Set(leftCores.flatMap((name) => name.split(" ")).filter((word) => word.length >= 6));
    return rightCores.some((name) => name.split(" ").some((word) => tokens.has(word))) ? "token" : null;
  }

  function compatibleCategory(left, right) {
    const category = normalize(left.categoria);
    if (category && category === normalize(right.categoria)) return true;
    return sharedSubcategory(left, right);
  }

  function sharedSubcategory(left, right) {
    const subcategories = new Set(String(left.subcategoria || "").split(/[;,]/).map(normalize).filter(Boolean));
    return String(right.subcategoria || "").split(/[;,]/).map(normalize).some((value) => subcategories.has(value));
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

  function addressRelation(left, right) {
    if (missingAddress(left) || missingAddress(right)) return "missing";
    let incompleteUnit = false;
    let differentUnit = false;
    for (const leftPart of String(left).split(";")) {
      for (const rightPart of String(right).split(";")) {
        if (normalizedAddress(leftPart) === normalizedAddress(rightPart)) return "same";
        const first = streetAndNumber(leftPart);
        const second = streetAndNumber(rightPart);
        if (!first.street || first.street !== second.street || !first.number || first.number !== second.number) continue;
        if (first.unit && second.unit && first.unit !== second.unit) {
          differentUnit = true;
          continue;
        }
        if (Boolean(first.unit) !== Boolean(second.unit)) incompleteUnit = true;
        else return "same";
      }
    }
    return incompleteUnit ? "incomplete-unit" : differentUnit ? "different-unit" : "different";
  }

  function sameCommerce(left = {}, right = {}) {
    const relation = relatedName(left.nome, right.nome);
    if (!relation) return null;
    if (relation !== "exact" && !compatibleCategory(left, right)) return null;
    const address = addressRelation(left.endereco, right.endereco);
    const contact = sharedContact(left, right);
    if (address === "same") {
      return { reason: relation === "exact" ? "Mesmo nome e endereco" : "Nomes relacionados e mesmo endereco", score: relation === "token" || relation === "expanded" ? 2 : 3 };
    }
    if (address === "incomplete-unit") {
      return { reason: "Nomes relacionados, rua e numero iguais; confira box ou sala", score: 1 };
    }
    if (contact) return { reason: "Nomes relacionados e telefone igual; confira os enderecos", score: 2 };
    if (address === "different") {
      const rightNames = new Set(nameVariants(right.nome));
      const sharedName = nameVariants(left.nome).find((name) => rightNames.has(name));
      if (sharedName && hasDistinctiveNameWord(nameCore(sharedName))
        && compatibleCategory(left, right) && sharedSubcategory(left, right)) {
        return { reason: "Mesmo nome e ramo, mas enderecos diferentes; confira mudanca ou filial", score: 1 };
      }
      return null;
    }
    if (address === "different-unit" || relation === "token") return null;
    if (relation === "expanded" && !sharedSubcategory(left, right)) return null;
    if (relation === "brand" && left.subcategoria && right.subcategoria && !sharedSubcategory(left, right)) return null;
    if (relation === "expanded") {
      return { reason: "Nome-base contido em nome mais descritivo e mesmo ramo; endereco ausente para conferir", score: 0.5 };
    }
    return { reason: relation === "exact" ? "Mesmo nome; endereco ausente em um dos cadastros" : "Nome-base e categoria coincidem; endereco ausente em um dos cadastros", score: 1 };
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

  function duplicateMatchReference(match) {
    if (match?.origin === "existing") {
      const id = String(match.candidate?.id || "").trim();
      return id ? `existing:${id}` : "";
    }
    if (match?.origin === "batch") {
      const rowNumber = Number(match.candidate?.rowNumber);
      return Number.isSafeInteger(rowNumber) && rowNumber >= 2 ? `batch:${rowNumber}` : "";
    }
    return "";
  }

  function unconfirmedDuplicates(existing, entries) {
    const accepted = [];
    const duplicates = [];
    for (const entry of entries) {
      const { item, rowNumber, duplicateOverride } = entry;
      const existingMatch = findMatch(existing, item);
      const batchMatch = existingMatch ? null : findMatch(accepted, item);
      const match = existingMatch ? { ...existingMatch, origin: "existing" }
        : batchMatch ? { ...batchMatch, origin: "batch" } : null;
      const reference = duplicateMatchReference(match);
      if (match && (!reference || duplicateOverride !== reference)) duplicates.push(item.nome);
      else accepted.push({ ...item, rowNumber });
    }
    return duplicates;
  }

  function fieldComparison(existing = {}, incoming = {}) {
    const additions = [];
    const differences = [];
    for (const [key, label] of FIELDS) {
      const value = String(incoming[key] || "").trim();
      if (!value) continue;
      const current = String(existing[key] || "").trim();
      if (!current || (key === "endereco" && missingAddress(current))) additions.push({ label, value });
      else if ((key === "endereco" ? normalizedAddress(current) : normalize(current)) !==
        (key === "endereco" ? normalizedAddress(value) : normalize(value))) {
        differences.push({ label, current, value });
      }
    }
    return { additions, differences };
  }

  return { sameCommerce, findMatch, duplicateMatchReference, unconfirmedDuplicates, fieldComparison };
});
