const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const { onlyDigits, format, isValidCpf } = require("./cpf");

// Conexão fora do handler para ser reaproveitada entre invocações "quentes"
// da mesma execution environment (padrão recomendado para Lambda + RDS).
let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 2, // Lambda = um handler por vez, não precisa de pool grande
      connectTimeout: 5000,
    });
  }
  return pool;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
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

  const document = format(onlyDigits(rawCpf));

  let rows;
  try {
    const db = getPool();
    // ATENÇÃO: ajustar os campos selecionados aqui conforme o restante das
    // colunas reais de `customers` (este exemplo assume só id e document,
    // que foram os únicos confirmados).
    [rows] = await db.execute(
      "SELECT id, document FROM customers WHERE document = ? LIMIT 1",
      [document]
    );
  } catch (err) {
    console.error("Erro ao consultar o banco:", err);
    return response(500, { message: "Erro interno ao consultar o cliente." });
  }

  if (!rows || rows.length === 0) {
    return response(404, { message: "Cliente não encontrado para este CPF." });
  }

  const customer = rows[0];
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
