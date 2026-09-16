// Valida CPF: aceita tanto "000.000.000-00" quanto "00000000000" na entrada.
// `format()` existe pra exibição/mensagens — NÃO usar o resultado dela pra
// consultar a coluna `document`: o Value Object Document.php (lado Laravel)
// remove toda pontuação antes de persistir, então o banco guarda só dígitos
// ("52998224725"), nunca "529.982.247-25" (ver index.js).

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function format(digits) {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function calcCheckDigit(digits, factorStart) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * (factorStart - i);
  }
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

function isValidCpf(rawValue) {
  const digits = onlyDigits(rawValue);

  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // ex: 111.111.111-11

  const firstCheck = calcCheckDigit(digits.slice(0, 9), 10);
  const secondCheck = calcCheckDigit(digits.slice(0, 10), 11);

  return firstCheck === parseInt(digits[9], 10) && secondCheck === parseInt(digits[10], 10);
}

module.exports = { onlyDigits, format, isValidCpf };
