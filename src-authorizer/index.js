const jwt = require("jsonwebtoken");

// Lambda authorizer (REQUEST, payload 2.0, simple responses) das rotas
// protegidas do API Gateway, na frente dos 3 microsserviços.
//
// Aceita dois tipos de token HS256 (sem IdP/JWKS, por isso não dá pra usar o
// "JWT authorizer" nativo do HTTP API):
//   - cliente     : emitido pela Lambda lambda-auth-cpf (CUSTOMER_JWT_SECRET, type=customer)
//   - funcionário : emitido pelo os-service em POST /api/auth/login (STAFF_JWT_SECRET)
// Cada microsserviço ainda valida o token de novo (defesa em profundidade).

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

function verify(token, secret) {
  if (!secret) {
    return null;
  }

  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  const token = extractToken(event);

  if (!token) {
    return { isAuthorized: false };
  }

  const customer = verify(token, process.env.CUSTOMER_JWT_SECRET);
  if (customer && customer.type === "customer") {
    return {
      isAuthorized: true,
      context: {
        principalType: "customer",
        customerId: String(customer.sub),
        customerDocument: customer.document || null,
      },
    };
  }

  const staff = verify(token, process.env.STAFF_JWT_SECRET);
  if (staff && staff.sub !== undefined && staff.type !== "customer") {
    return {
      isAuthorized: true,
      context: {
        principalType: "staff",
        staffId: String(staff.sub),
      },
    };
  }

  return { isAuthorized: false };
};
