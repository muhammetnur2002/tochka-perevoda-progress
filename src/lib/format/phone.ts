/** Телефоны Туркменистана: +993 и восемь цифр национального номера. */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return digits;
  if (digits.startsWith("00993")) return digits.slice(2);
  return digits.length === 8 ? `993${digits}` : digits;
}
export function isValidTmPhone(input: string): boolean {
  return /^993\d{8}$/.test(normalizePhone(input));
}
export function formatPhone(input: string): string {
  if (!isValidTmPhone(input)) return input;
  const d = normalizePhone(input).slice(3);
  return `+993 (${d.slice(0, 2)}) ${d.slice(2, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
/** Не обрезаем иностранные/слишком длинные номера: валидация их отклонит. */
export function phoneMask(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00993")) digits = digits.slice(2);
  if (value.trim().startsWith("+") && !digits.startsWith("993")) {
    return /^9(?:9(?:3)?)?$/.test(digits) || !digits ? "+993" : value;
  }
  const d = digits.startsWith("993") ? digits.slice(3) : digits;
  if (d.length > 8) return value;
  let result = "+993";
  if (d.length) result += ` (${d.slice(0, 2)}`;
  if (d.length >= 2) result += `) ${d.slice(2, 4)}`;
  if (d.length > 4) result += `-${d.slice(4, 6)}`;
  if (d.length > 6) result += `-${d.slice(6, 8)}`;
  return result;
}
