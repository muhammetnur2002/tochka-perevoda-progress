/** Утилиты нормализации и форматирования телефонов (RU). */

/** Оставляет только цифры; при 10 цифрах и 8/7 в начале приводит к формату E.164. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");

  if (digits.startsWith("8") && digits.length === 11) {
    digits = "7" + digits.slice(1);
  } else if (digits.length === 10) {
    digits = "7" + digits;
  }
  return digits;
}

/** Красивый формат «+7 (900) 123-45-67». */
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return input;

  const base = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  const cc = "7";
  return `+${cc} (${base.slice(0, 3)}) ${base.slice(3, 6)}-${base.slice(6, 8)}-${base.slice(8, 10)}`;
}

/** Маска для поля ввода. */
export function phoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  const d = digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits;
  let res = "+7";
  if (d.length > 0) res += ` (${d.slice(0, 3)}`;
  if (d.length >= 3) res += `) ${d.slice(3, 6)}`;
  if (d.length >= 6) res += `-${d.slice(6, 8)}`;
  if (d.length >= 8) res += `-${d.slice(8, 10)}`;
  return res;
}

/** Проверка корректности номера РФ (11 цифр, начинается с 7). */
export function isValidRuPhone(input: string): boolean {
  const digits = normalizePhone(input);
  return /^7\d{10}$/.test(digits);
}
