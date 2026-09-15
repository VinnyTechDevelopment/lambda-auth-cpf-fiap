const { onlyDigits, format, isValidCpf } = require("../cpf");

describe("isValidCpf", () => {
  it.each(["52998224725", "529.982.247-25"])(
    "aceita um CPF válido (%s)",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(true);
    }
  );

  it.each(["11111111111", "12345678900", "123", "", null, undefined])(
    "rejeita CPF inválido (%s)",
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    }
  );
});

describe("onlyDigits", () => {
  it("remove caracteres não numéricos", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });
});

describe("format", () => {
  it("formata os dígitos no padrão 000.000.000-00", () => {
    expect(format("52998224725")).toBe("529.982.247-25");
  });
});
