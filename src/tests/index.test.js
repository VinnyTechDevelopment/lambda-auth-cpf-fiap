process.env.CUSTOMER_JWT_SECRET = "test-secret";
process.env.CUSTOMER_JWT_TTL = "3600";
process.env.OS_SERVICE_URL = "http://os-service.test/";
process.env.INTERNAL_API_TOKEN = "internal-token";

const jwt = require("jsonwebtoken");
const { handler } = require("../index");

const VALID_CPF = "52998224725";
const FORMATTED_CPF = "529.982.247-25";

function buildEvent(body) {
  return { body: typeof body === "string" ? body : JSON.stringify(body) };
}

function mockOsService(status, body) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
}

afterEach(() => {
  delete global.fetch;
});

test("retorna 400 para corpo que não é JSON", async () => {
  const response = await handler(buildEvent("{nao-json"));
  expect(response.statusCode).toBe(400);
});

test("retorna 400 quando falta o campo cpf/document", async () => {
  const response = await handler(buildEvent({}));
  expect(response.statusCode).toBe(400);
});

test("retorna 422 para CPF com dígito verificador inválido, sem chamar o os-service", async () => {
  global.fetch = jest.fn();
  const response = await handler(buildEvent({ cpf: "11111111111" }));
  expect(response.statusCode).toBe(422);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("consulta o endpoint interno do os-service com o CPF só com dígitos e o token interno", async () => {
  mockOsService(200, { id: "c1", document: VALID_CPF, status: "active" });

  await handler(buildEvent({ cpf: FORMATTED_CPF }));

  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe(`http://os-service.test/api/internal/customers/by-document/${VALID_CPF}`);
  expect(options.headers["X-Internal-Token"]).toBe("internal-token");
});

test("retorna 404 quando cliente não existe", async () => {
  mockOsService(404, { message: "nao encontrado" });
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(404);
});

test("retorna 403 quando cliente está inativo", async () => {
  mockOsService(200, { id: "c1", document: VALID_CPF, status: "inactive" });
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(403);
});

test("retorna 502 quando o os-service falha", async () => {
  mockOsService(500, {});
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(502);
});

test("retorna 502 quando o os-service está inacessível", async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED"));
  const response = await handler(buildEvent({ document: VALID_CPF }));
  expect(response.statusCode).toBe(502);
});

test("emite JWT de cliente para CPF ativo", async () => {
  mockOsService(200, { id: "c1", document: VALID_CPF, status: "active" });

  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  const body = JSON.parse(response.body);

  expect(response.statusCode).toBe(200);
  expect(body.token_type).toBe("Bearer");
  expect(body.customer.id).toBe("c1");

  const decoded = jwt.verify(body.token, "test-secret");
  expect(decoded.sub).toBe("c1");
  expect(decoded.type).toBe("customer");
});
