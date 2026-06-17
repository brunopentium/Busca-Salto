const TAXONOMY = [
  {
    categoria: "Alimentação",
    subcategorias: [
      "Açaiteria", "Açougue", "Adegas", "Bar", "Cafeteria", "Churrascaria", "Comida Japonesa",
      "Confeitaria", "Conveniência", "Distribuidora de Bebidas", "Esfiharia", "Espetaria",
      "Feiras Livres", "Food Trucks", "Galeterias", "Hamburgueria", "Hortifrúti", "Lanchonete",
      "Marmitaria", "Padaria", "Pastelaria", "Peixarias", "Pizzaria", "Restaurante",
      "Rotisseria", "Sorveteria",
    ],
  },
  {
    categoria: "Automotivo",
    subcategorias: [
      "Acessórios Automotivos", "Ar-condicionado Automotivo", "Autoelétrica", "Autoescola",
      "Autopeças", "Baterias Automotivas", "Borracharia", "Centro Automotivo", "Chaveiro",
      "Concessionárias de Veículos", "Despachante", "Emplacamento", "Estética Automotiva",
      "Funilaria e Pintura", "Guincho", "Lava-rápido", "Locadoras de Veículos", "Loja de Pneus",
      "Lojas de Motos", "Mecânica", "Oficinas de Moto", "Postos de Combustível", "Vistoria Veicular",
    ],
  },
  {
    categoria: "Beleza e Estética",
    subcategorias: [
      "Barbearia", "Cabeleireiros a Domicílio", "Estética", "Maquiagem", "Piercing",
      "Salão de Beleza", "Tatuadores", "Unhas",
    ],
  },
  {
    categoria: "Casa e Construção",
    subcategorias: [
      "Ar-condicionado", "Automação Residencial", "Calhas e Telhados", "Dedetização",
      "Eletricistas", "Elétricos e Hidráulicos", "Encanadores", "Energia Solar", "Jardinagem",
      "Limpeza de Caixas D'água", "Material de Construção", "Móveis", "Paisagismo", "Pedreiros",
      "Pintores", "Piscina", "Segurança Eletrônica", "Serralherias", "Vidraçarias",
    ],
  },
  {
    categoria: "Comércio Geral",
    subcategorias: [
      "Assistência Técnica", "Bicicletarias", "Brindes Personalizados", "Celulares",
      "Decoração de Festas", "Eletrodomésticos", "EPIs", "Floriculturas", "Gráficas",
      "Informática", "Joalherias", "Loja de Presentes", "Lojas de Variedades", "Manutenção",
      "Mercados", "Moda Íntima", "Papelaria", "Relojoarias", "Sex Shop", "Tabacarias",
      "Uniformes Profissionais",
    ],
  },
  {
    categoria: "Educação",
    subcategorias: [
      "Aulas Particulares", "Cursos Preparatórios", "Cursos Profissionalizantes", "Cursos Técnicos",
      "Educação Infantil", "Escola Particular", "Escolas de Idiomas", "Faculdade", "Reforço Escolar",
      "Universidade",
    ],
  },
  {
    categoria: "Esporte e Fitness",
    subcategorias: [
      "Academia", "Escolas de Artes Marciais", "Escolas de Dança", "Escolas de Natação",
      "Personal Trainers", "Pilates",
    ],
  },
  {
    categoria: "Hotelaria",
    subcategorias: ["Hotéis", "Motéis", "Pousadas"],
  },
  {
    categoria: "Lazer e Eventos",
    subcategorias: [
      "Agências de Turismo", "Aluguel para Festas", "Artigos para Festas", "Bandas", "Buffets",
      "Cerimonialistas", "Clubes", "Decoração de Festas", "DJs", "Espaços para Eventos",
      "Fotógrafos", "Músicos", "Pesca e Camping", "Pesqueiros", "Produtora de Vídeo",
      "Som e Iluminação",
    ],
  },
  {
    categoria: "Pets",
    subcategorias: ["Adestradores", "Agropecuária", "Banho e Tosa", "Clínica Veterinária", "Pet Shop", "Rações"],
  },
  {
    categoria: "Religião e Comunidade",
    subcategorias: ["Associações", "Comunidade Religiosa", "Igrejas", "ONGs"],
  },
  {
    categoria: "Saúde e Bem-estar",
    subcategorias: [
      "Clínica de Estética", "Clínica de Imagem", "Clínica Médica", "Clínica Odontológica",
      "Cuidador de Idosos", "Farmácia", "Farmácia de Manipulação", "Fisioterapia",
      "Fonoaudiólogos", "Home Care", "Hospitais", "Laboratório de Exames", "Massoterapeutas",
      "Nutricionista", "Ótica", "Podólogos", "Produtos Naturais", "Psicologia", "Quiropraxia",
      "Terapias",
    ],
  },
  {
    categoria: "Serviços",
    subcategorias: [
      "Assistência Técnica de Eletrodomésticos", "Chaveiro", "Costura e Ajustes de Roupas",
      "Lavanderias", "Sapateiros",
    ],
  },
  {
    categoria: "Serviços Profissionais",
    subcategorias: [
      "Advogados", "Agências de Marketing", "Arquitetos", "Bancos", "Cartórios", "Condomínios",
      "Contadores", "Correspondentes Bancários", "Engenheiros", "Espaços Compartilhados",
      "Estacionamentos", "Imobiliária", "Lotéricas", "Recursos Humanos", "Seguros",
    ],
  },
  {
    categoria: "Tecnologia",
    subcategorias: ["Assistência Técnica", "Informática", "Lan Houses"],
  },
  {
    categoria: "Transporte",
    subcategorias: ["Fretes e Mudanças", "Motoboys", "Motoristas Particulares", "Mototáxi", "Táxi", "Transportadoras"],
  },
];

const CATEGORY_ALIASES = {
  "servicos automotivos": "Automotivo",
  "comercio": "Comércio Geral",
  "comercio em geral": "Comércio Geral",
  "saude": "Saúde e Bem-estar",
  "saude e beleza": "Saúde e Bem-estar",
  "beleza": "Beleza e Estética",
  "casa": "Casa e Construção",
  "construcao": "Casa e Construção",
  "eventos": "Lazer e Eventos",
  "profissionais": "Serviços Profissionais",
};

const SUBCATEGORY_ALIASES = {
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
  pastel: ["Pastelaria"],
  pasteis: ["Pastelaria"],
  "pastelaria delivery": ["Pastelaria"],
  "pastelaria e lanchonete": ["Pastelaria", "Lanchonete"],
  "pizzaria delivery": ["Pizzaria"],
  "pizzaria e restaurante": ["Pizzaria", "Restaurante"],
  "restaurante com delivery": ["Restaurante"],
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
  autoeletrica: ["Autoelétrica"],
  "autopecas e oficina mecanica": ["Autopeças", "Mecânica"],
  borracharias: ["Borracharia"],
  "despachantes documentais": ["Despachante"],
  "loja de pneus": ["Loja de Pneus"],
  "oficina mecanica": ["Mecânica"],
  "pneus e mecanica": ["Loja de Pneus", "Mecânica"],
  "chaveiros": ["Chaveiro"],
  "chaveiro automotivo": ["Chaveiro"],
  "auto socorro": ["Guincho"],
  "alinhamento e balanceamento": ["Centro Automotivo"],
  "troca de oleo": ["Centro Automotivo"],
  vulcanizacao: ["Borracharia"],
  "rodas automotivas": ["Loja de Pneus"],
  "som e acessorios automotivos": ["Acessórios Automotivos"],
  "assistencia tecnica de ar condicionado": ["Ar-condicionado"],
  refrigeracao: ["Ar-condicionado"],
  "instalacao de cameras": ["Segurança Eletrônica"],
  alarmes: ["Segurança Eletrônica"],
  "portoes automaticos": ["Segurança Eletrônica"],
  "loja de moveis": ["Móveis"],
  "lojas de moveis": ["Móveis"],
  "moveis e decoracao": ["Móveis"],
  "moveis planejados": ["Móveis"],
  reformas: ["Pedreiros"],
  "limpeza de piscina": ["Piscina"],
  "acougues boutique": ["Açougue"],
  acougues: ["Açougue"],
  galeterias: ["Restaurante"],
  hortifrutis: ["Hortifrúti"],
  hortas: ["Hortifrúti"],
  quitandas: ["Hortifrúti"],
  conveniencias: ["Conveniência"],
  "lojas de produtos congelados": ["Mercados"],
  papelarias: ["Papelaria"],
  "produtores locais": ["Hortifrúti"],
  "materiais graficos": ["Gráficas"],
  "material grafico": ["Gráficas"],
  "comunicacao visual": ["Gráficas"],
  "lojas de presentes": ["Loja de Presentes"],
  "loja de presentes": ["Loja de Presentes"],
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
  imobiliarias: ["Imobiliária"],
  "corretor de imoveis": ["Imobiliária"],
  "corretores de imoveis": ["Imobiliária"],
  "imoveis para temporada": ["Imobiliária"],
  "corretora de seguros": ["Seguros"],
  "corretoras de seguros": ["Seguros"],
  "agencias de emprego": ["Recursos Humanos"],
  "produtoras de video": ["Produtora de Vídeo"],
  coworkings: ["Espaços Compartilhados"],
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
  "escolas infantis": ["Educação Infantil"],
  "escolas particulares": ["Escola Particular"],
  faculdades: ["Faculdade"],
  universidades: ["Universidade"],
  "clinicas veterinarias": ["Clínica Veterinária"],
  racoes: ["Rações"],
  "agro pet": ["Pet Shop"],
  petshop: ["Pet Shop"],
  "moto taxi": ["Mototáxi"],
  mototaxi: ["Mototáxi"],
};

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizeKey(value = "") {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)([a-záàâãéêíóôõúç])/g, (match) => match.toUpperCase());
}

function splitSubcategories(value = "") {
  return String(value || "")
    .split(/[;,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

const CATEGORY_BY_KEY = new Map();
const SUBCATEGORY_BY_KEY = new Map();
const SUBCATEGORY_BY_CATEGORY = new Map();
const CATEGORY_FOR_SUBCATEGORY = new Map();

for (const group of TAXONOMY) {
  CATEGORY_BY_KEY.set(normalizeKey(group.categoria), group.categoria);
  const map = new Map();
  for (const subcategory of group.subcategorias) {
    const key = normalizeKey(subcategory);
    map.set(key, subcategory);
    if (!SUBCATEGORY_BY_KEY.has(key)) SUBCATEGORY_BY_KEY.set(key, subcategory);
    if (!CATEGORY_FOR_SUBCATEGORY.has(key)) CATEGORY_FOR_SUBCATEGORY.set(key, group.categoria);
  }
  SUBCATEGORY_BY_CATEGORY.set(normalizeKey(group.categoria), map);
}

function canonicalCategory(value = "") {
  const key = normalizeKey(value);
  if (!key) return "";
  return CATEGORY_BY_KEY.get(key) || CATEGORY_ALIASES[key] || titleCase(value);
}

function canonicalSubcategories(value = "", category = "") {
  const categoryKey = normalizeKey(canonicalCategory(category));
  const categoryMap = SUBCATEGORY_BY_CATEGORY.get(categoryKey);
  const result = [];

  for (const part of splitSubcategories(value)) {
    const key = normalizeKey(part);
    const alias = SUBCATEGORY_ALIASES[key];
    if (alias) {
      result.push(...alias);
      continue;
    }
    result.push(categoryMap?.get(key) || SUBCATEGORY_BY_KEY.get(key) || titleCase(part));
  }

  return unique(result);
}

function inferCategoryFromSubcategories(subcategories = []) {
  for (const subcategory of subcategories) {
    const category = CATEGORY_FOR_SUBCATEGORY.get(normalizeKey(subcategory));
    if (category) return category;
  }
  return "";
}

function normalizeCommerceCategoryFields(data = {}) {
  const subcategorias = canonicalSubcategories(data.subcategoria || "", data.categoria || "");
  const categoria = canonicalCategory(data.categoria || "") || inferCategoryFromSubcategories(subcategorias);
  return {
    categoria,
    subcategoria: subcategorias.join("; "),
  };
}

module.exports = {
  TAXONOMY,
  canonicalCategory,
  canonicalSubcategories,
  normalizeCommerceCategoryFields,
  normalizeKey,
};
