const jwt = require("jsonwebtoken");
const { handler } = require("../index");

const SECRET = "test-secret";

function eventWithAuth(headerValue) {
  return { headers: headerValue ? { authorization: headerValue } : {} };
}

describe("customer_jwt_authorizer", () => {
  const originalSecret = process.env.CUSTOMER_JWT_SECRET;

  beforeAll(() => {
    process.env.CUSTOMER_JWT_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.CUSTOMER_JWT_SECRET = originalSecret;
  });

  test("token válido do tipo customer é autorizado", async () => {
    const token = jwt.sign({ sub: 42, document: "111.444.777-35", type: "customer" }, SECRET, {
      algorithm: "HS256",
      expiresIn: 3600,
    });

    const result = await handler(eventWithAuth(`Bearer ${token}`));

    expect(result.isAuthorized).toBe(true);
    expect(result.context.customerId).toBe("42");
    expect(result.context.customerDocument).toBe("111.444.777-35");
  });

  test("sem header Authorization é negado", async () => {
    const result = await handler(eventWithAuth(null));
    expect(result.isAuthorized).toBe(false);
  });

  test("header sem prefixo Bearer é negado", async () => {
    const token = jwt.sign({ sub: 1, type: "customer" }, SECRET, { algorithm: "HS256" });
    const result = await handler(eventWithAuth(token));
    expect(result.isAuthorized).toBe(false);
  });

  test("token expirado é negado", async () => {
    const token = jwt.sign({ sub: 1, type: "customer" }, SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
    });

    const result = await handler(eventWithAuth(`Bearer ${token}`));
    expect(result.isAuthorized).toBe(false);
  });

  test("assinatura inválida é negada", async () => {
    const token = jwt.sign({ sub: 1, type: "customer" }, "outro-secret", {
      algorithm: "HS256",
    });

    const result = await handler(eventWithAuth(`Bearer ${token}`));
    expect(result.isAuthorized).toBe(false);
  });

  test("type diferente de customer é negado", async () => {
    const token = jwt.sign({ sub: 1, type: "staff" }, SECRET, { algorithm: "HS256" });
    const result = await handler(eventWithAuth(`Bearer ${token}`));
    expect(result.isAuthorized).toBe(false);
  });

  test("usa identitySource quando headers não vem preenchido", async () => {
    const token = jwt.sign({ sub: 7, type: "customer" }, SECRET, { algorithm: "HS256" });
    const result = await handler({ identitySource: [`Bearer ${token}`] });
    expect(result.isAuthorized).toBe(true);
  });
});
