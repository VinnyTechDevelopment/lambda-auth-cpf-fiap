const jwt = require("jsonwebtoken");

// Lambda authorizer (REQUEST, payload format 2.0, simple responses) para a
// rota proxy "ANY /{proxy+}" do API Gateway. O token emitido por
// lambda-auth-cpf é HS256 com segredo compartilhado (CUSTOMER_JWT_SECRET) —
// não vem de um IdP com JWKS, por isso não dá pra usar o "JWT authorizer"
// nativo do API Gateway (que só valida RS256 via JWKS). Este authorizer faz
// a validação manualmente, do mesmo jeito que o middleware
// AuthenticateCustomerJwt.php faz no repositório tech-challenge-fiap.

function extractToken(event) {
  const headerValue =
    (event.headers && (event.headers.authorization || event.headers.Authorization)) ||
    (event.identitySource && event.identitySource[0]) ||
    "";

  if (!headerValue.startsWith("Bearer ")) {
    return null;
  }

  return headerValue.slice(7);
}

exports.handler = async (event) => {
  const token = extractToken(event);

  if (!token) {
    return { isAuthorized: false };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.CUSTOMER_JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return { isAuthorized: false };
  }

  if (decoded.type !== "customer") {
    return { isAuthorized: false };
  }

  return {
    isAuthorized: true,
    context: {
      customerId: String(decoded.sub),
      customerDocument: decoded.document || null,
    },
  };
};
