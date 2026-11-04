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

  describe("token de funcionário (emitido pelo os-service)", () => {
    const STAFF_SECRET = "staff-secret";

    beforeAll(() => {
      process.env.STAFF_JWT_SECRET = STAFF_SECRET;
    });

    afterAll(() => {
      delete process.env.STAFF_JWT_SECRET;
    });

    test("token de funcionário válido é autorizado como staff", async () => {
      const token = jwt.sign({ sub: 3, prv: "abc" }, STAFF_SECRET, { algorithm: "HS256", expiresIn: 60 });
      const result = await handler(eventWithAuth(`Bearer ${token}`));

      expect(result.isAuthorized).toBe(true);
      expect(result.context.principalType).toBe("staff");
      expect(result.context.staffId).toBe("3");
    });

    test("token com type=customer assinado com o segredo de funcionário é negado", async () => {
      const token = jwt.sign({ sub: 3, type: "customer" }, STAFF_SECRET, { algorithm: "HS256" });
      const result = await handler(eventWithAuth(`Bearer ${token}`));
      expect(result.isAuthorized).toBe(false);
    });

    test("token de funcionário sem subject é negado", async () => {
      const token = jwt.sign({ role: "x" }, STAFF_SECRET, { algorithm: "HS256" });
      const result = await handler(eventWithAuth(`Bearer ${token}`));
      expect(result.isAuthorized).toBe(false);
    });

    test("token de cliente continua com principalType customer", async () => {
      const token = jwt.sign({ sub: 9, type: "customer" }, SECRET, { algorithm: "HS256" });
      const result = await handler(eventWithAuth(`Bearer ${token}`));
      expect(result.context.principalType).toBe("customer");
    });
  });
});
