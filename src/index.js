const jwt = require("jsonwebtoken");
const { onlyDigits, isValidCpf } = require("./cpf");

// Fase 4 — a Lambda NÃO acessa mais o banco do os-service diretamente
// ("nenhum serviço pode acessar diretamente o banco de outro serviço").
// O cliente é consultado no endpoint interno do os-service, protegido por
// um token compartilhado (X-Internal-Token).

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function findCustomer(document) {
  const baseUrl = (process.env.OS_SERVICE_URL || "").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/internal/customers/by-document/${document}`, {
    headers: {
      Accept: "application/json",
      "X-Internal-Token": process.env.INTERNAL_API_TOKEN || "",
    },
    signal: AbortSignal.timeout(Number(process.env.OS_SERVICE_TIMEOUT_MS || 5000)),
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`os-service respondeu HTTP ${res.status}`);
  }

  return res.json();
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { message: "Corpo da requisição inválido, esperado JSON." });
  }

  const rawCpf = payload.cpf || payload.document;

  if (!rawCpf) {
    return response(400, { message: "Campo 'cpf' é obrigatório." });
  }

  if (!isValidCpf(rawCpf)) {
    return response(422, { message: "CPF inválido." });
  }

  const document = onlyDigits(rawCpf);

  let customer;
  try {
    customer = await findCustomer(document);
  } catch (err) {
    console.error("Erro ao consultar o os-service:", err);
    return response(502, { message: "Erro ao consultar o cliente." });
  }

  if (!customer) {
    return response(404, { message: "Cliente não encontrado para este CPF." });
  }

  if (customer.status !== "active") {
    return response(403, { message: "Cliente inativo." });
  }

  const ttl = Number(process.env.CUSTOMER_JWT_TTL || 3600);

  const token = jwt.sign(
    {
      sub: customer.id,
      document: customer.document,
      type: "customer",
    },
    process.env.CUSTOMER_JWT_SECRET,
    { expiresIn: ttl, algorithm: "HS256" }
  );

  return response(200, {
    token,
    token_type: "Bearer",
    expires_in: ttl,
    customer: { id: customer.id },
  });
};
