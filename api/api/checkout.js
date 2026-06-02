const WHATSAPP_NUMBER = "5511953116573";
const SITE_URL = (process.env.SITE_URL || process.env.VERCEL_URL || "https://busca-salto.vercel.app").replace(/\/+$/, "");
const MERCADO_PAGO_ACCESS_TOKEN = String(process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim();
const PLANS = {
  gratuito: {
    title: "Busca Salto - Cadastro Gratuito",
    price: 0,
    description: "Cadastro basico gratuito no Busca Salto.",
  },
  parceiro: {
    title: "Busca Salto - Plano Parceiro",
    price: 49.9,
    description: "Prioridade acima dos gratuitos, imagem no card, selo de parceiro e descricao revisada.",
  },
  destaque: {
    title: "Busca Salto - Plano Destaque",
    price: 89.9,
    description: "Destaque visual, oferta/promocao, imagem e prioridade acima do plano parceiro.",
  },
  top: {
    title: "Busca Salto - Top Categoria",
    price: 149.9,
    description: "Maior prioridade na categoria, selo Top Categoria e disponibilidade sujeita a validacao.",
  },
};

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function normalizePlan(value = "") {
  const plan = String(value || "").trim().toLowerCase();
  return PLANS[plan] ? plan : "";
}

function whatsappUrl(plan) {
  const text = encodeURIComponent(`Olá, quero saber mais sobre o plano ${plan || "comercial"} do Busca Salto para meu comércio.`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

async function createMercadoPagoPreference(planKey, plan) {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{
        id: `busca-salto-${planKey}`,
        title: plan.title,
        description: plan.description,
        quantity: 1,
        unit_price: plan.price,
        currency_id: "BRL",
      }],
      back_urls: {
        success: `${SITE_URL}/comerciantes.html?checkout=success&plan=${encodeURIComponent(planKey)}`,
        pending: `${SITE_URL}/comerciantes.html?checkout=pending&plan=${encodeURIComponent(planKey)}`,
        failure: `${SITE_URL}/comerciantes.html?checkout=failure&plan=${encodeURIComponent(planKey)}`,
      },
      auto_return: "approved",
      statement_descriptor: "BUSCA SALTO",
      external_reference: `busca-salto:${planKey}:${Date.now()}`,
      metadata: {
        project: "busca_salto",
        plan: planKey,
      },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Mercado Pago error ${response.status}: ${message.slice(0, 180)}`);
  }
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Metodo nao permitido." });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const planKey = normalizePlan(body.plan);
    if (!planKey) return json(res, 400, { error: "Plano invalido.", url: whatsappUrl("") });

    const plan = PLANS[planKey];
    if (planKey === "gratuito" || plan.price <= 0 || !MERCADO_PAGO_ACCESS_TOKEN) {
      return json(res, 200, {
        mode: "whatsapp",
        plan: planKey,
        url: whatsappUrl(planKey),
      });
    }

    const preference = await createMercadoPagoPreference(planKey, plan);
    return json(res, 200, {
      mode: "mercado_pago",
      plan: planKey,
      preferenceId: preference.id,
      url: preference.init_point || preference.sandbox_init_point || whatsappUrl(planKey),
    });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      service: "busca-salto-checkout",
      message: error?.message || "Erro desconhecido",
      timestamp: new Date().toISOString(),
    }));
    return json(res, 200, {
      mode: "whatsapp",
      error: "checkout_fallback",
      url: whatsappUrl("comercial"),
    });
  }
};
