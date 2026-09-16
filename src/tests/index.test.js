process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USERNAME = "test";
process.env.DB_PASSWORD = "test";
process.env.DB_NAME = "test_db";
process.env.CUSTOMER_JWT_SECRET = "test-secret";
process.env.CUSTOMER_JWT_TTL = "3600";

const jwt = require("jsonwebtoken");

const VALID_CPF = "52998224725";
const FORMATTED_CPF = "529.982.247-25";

let mockExecute;

jest.mock("mysql2/promise", () => ({
  createPool: jest.fn(() => ({
    execute: (...args) => mockExecute(...args),
  })),
}));

function buildEvent(body) {
  return { body: JSON.stringify(body) };
}

function loadHandler() {
  return require("../index").handler;
}

beforeEach(() => {
  jest.resetModules();
  mockExecute = jest.fn();
});

test("retorna 400 quando falta o campo cpf/document", async () => {
  const handler = loadHandler();
  const response = await handler(buildEvent({}));
  expect(response.statusCode).toBe(400);
});

test("retorna 422 para CPF com dígito verificador inválido", async () => {
  const handler = loadHandler();
  const response = await handler(buildEvent({ cpf: "11111111111" }));
  expect(response.statusCode).toBe(422);
  expect(mockExecute).not.toHaveBeenCalled();
});

test("retorna 404 quando cliente não existe", async () => {
  mockExecute.mockResolvedValue([[]]);
  const handler = loadHandler();
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(404);
});

test("retorna 403 quando cliente está inativo", async () => {
  mockExecute.mockResolvedValue([
    [{ id: "c1", document: FORMATTED_CPF, status: "inactive" }],
  ]);
  const handler = loadHandler();
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(403);
});

test("retorna 200 com token quando cliente está ativo", async () => {
  mockExecute.mockResolvedValue([
    [{ id: "c1", document: FORMATTED_CPF, status: "active" }],
  ]);
  const handler = loadHandler();
  const response = await handler(buildEvent({ document: VALID_CPF }));
  const body = JSON.parse(response.body);

  expect(response.statusCode).toBe(200);
  expect(body.customer).toEqual({ id: "c1" });

  const decoded = jwt.verify(body.token, process.env.CUSTOMER_JWT_SECRET);
  expect(decoded.sub).toBe("c1");
  expect(decoded.type).toBe("customer");
});

test("consulta o banco com o CPF sem pontuação, não formatado", async () => {
  // Document.php (lado Laravel) guarda só dígitos — consultar formatado
  // ("529.982.247-25") nunca daria match e sempre devolveria 404.
  mockExecute.mockResolvedValue([
    [{ id: "c1", document: VALID_CPF, status: "active" }],
  ]);
  const handler = loadHandler();
  await handler(buildEvent({ cpf: FORMATTED_CPF }));

  expect(mockExecute).toHaveBeenCalledWith(expect.any(String), [VALID_CPF]);
});

test("retorna 500 quando a consulta ao banco falha", async () => {
  mockExecute.mockRejectedValue(new Error("conn refused"));
  const handler = loadHandler();
  const response = await handler(buildEvent({ cpf: VALID_CPF }));
  expect(response.statusCode).toBe(500);
});
