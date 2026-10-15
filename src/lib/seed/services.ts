import type { ServiceCategory, ServiceUnit } from "@/types/database.types";

/**
 * Канонический каталог услуг (зеркало supabase/migrations/0007_seed_services.sql).
 * Используется в демо-режиме (без БД), в unit-тестах и как эталон прайса.
 * При изменении цен обновляйте и SQL-миграцию, и этот файл.
 */
export interface SeedService {
  slug: string;
  category: ServiceCategory;
  name: string;
  description: string;
  price: number;
  unit: ServiceUnit;
  durationDays: number;
  isNotarial: boolean;
  sortOrder: number;
}

export const SEED_SERVICES: SeedService[] = [
  // ---------- Переводы ----------
  {
    slug: "legal",
    category: "translation",
    name: "Перевод юридических документов",
    description: "Договоры, учредительные документы, доверенности, решения судов. Цена за страницу.",
    price: 550,
    unit: "page",
    durationDays: 2,
    isNotarial: false,
    sortOrder: 1,
  },
  {
    slug: "medical",
    category: "translation",
    name: "Перевод медицинских документов",
    description: "Справки, выписки, заключения, эпикризы. Цена за страницу.",
    price: 550,
    unit: "page",
    durationDays: 2,
    isNotarial: false,
    sortOrder: 2,
  },
  {
    slug: "technical",
    category: "translation",
    name: "Перевод технической документации",
    description: "Инструкции, паспорта оборудования, чертежи, ТУ. Цена за страницу.",
    price: 650,
    unit: "page",
    durationDays: 2,
    isNotarial: false,
    sortOrder: 3,
  },
  {
    slug: "military-id",
    category: "translation",
    name: "Перевод военного билета (нотариальный)",
    description: "Перевод с нотариальным заверением. Фиксированная цена за документ.",
    price: 1650,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 4,
  },
  {
    slug: "work-book",
    category: "translation",
    name: "Перевод трудовой книжки (нотариальный)",
    description: "Перевод с нотариальным заверением. Фиксированная цена за документ.",
    price: 1650,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 5,
  },
  {
    slug: "diploma",
    category: "translation",
    name: "Перевод диплома (нотариальный)",
    description: "Перевод документа об образовании с нотариальным заверением.",
    price: 1870,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 6,
  },
  {
    slug: "certificate",
    category: "translation",
    name: "Перевод справки (нотариальный)",
    description: "Перевод справки с нотариальным заверением.",
    price: 1780,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 7,
  },
  {
    slug: "passport-all",
    category: "translation",
    name: "Перевод паспорта (все страницы)",
    description: "Перевод всех страниц паспорта.",
    price: 2390,
    unit: "document",
    durationDays: 1,
    isNotarial: false,
    sortOrder: 8,
  },
  {
    slug: "driver-license",
    category: "translation",
    name: "Перевод водительского удостоверения",
    description: "Перевод водительского удостоверения.",
    price: 1770,
    unit: "document",
    durationDays: 1,
    isNotarial: false,
    sortOrder: 9,
  },
  {
    slug: "passport-notary",
    category: "translation",
    name: "Перевод паспорта (нотариально заверенный)",
    description: "Перевод паспорта с нотариальным заверением.",
    price: 1770,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 10,
  },
  {
    slug: "power-of-attorney",
    category: "translation",
    name: "Перевод доверенности (нотариальный)",
    description: "Перевод доверенности с нотариальным заверением.",
    price: 2370,
    unit: "document",
    durationDays: 1,
    isNotarial: true,
    sortOrder: 11,
  },
  // ---------- Полиграфия ----------
  { slug: "photocopy-a4", category: "printing", name: "Ксерокопия А4", description: "Чёрно-белая ксерокопия формата А4.", price: 15, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 12 },
  { slug: "scanning", category: "printing", name: "Сканирование", description: "Сканирование одного листа.", price: 20, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 13 },
  { slug: "color-print", category: "printing", name: "Цветная распечатка", description: "Цветная распечатка одного листа.", price: 25, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 14 },
  { slug: "color-photocopy", category: "printing", name: "Цветная ксерокопия", description: "Цветная ксерокопия одного листа.", price: 30, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 15 },
  { slug: "bw-print", category: "printing", name: "Распечатка ч/б", description: "Чёрно-белая распечатка одного листа.", price: 10, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 16 },
  { slug: "print-a3", category: "printing", name: "Распечатка А3", description: "Распечатка формата А3.", price: 40, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 17 },
  { slug: "print-a2", category: "printing", name: "Распечатка А2", description: "Распечатка формата А2.", price: 100, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 18 },
  { slug: "print-a1", category: "printing", name: "Распечатка А1", description: "Распечатка формата А1.", price: 150, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 19 },
  { slug: "laminating", category: "printing", name: "Ламинирование", description: "Ламинирование одного листа.", price: 50, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 20 },
  { slug: "binding", category: "printing", name: "Брошюрование", description: "Брошюрование одного документа.", price: 200, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 21 },
  { slug: "diploma-stitching", category: "printing", name: "Прошивка дипломов", description: "Прошивка диплома.", price: 250, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 22 },
  { slug: "photo", category: "printing", name: "Фото на документы", description: "Фотографии на документы (комплект).", price: 300, unit: "item", durationDays: 1, isNotarial: false, sortOrder: 23 },
  // ---------- Страхование ----------
  {
    slug: "dms-student",
    category: "insurance",
    name: "Полис ДМС студентам (для иностранных граждан)",
    description: "Полис добровольного медицинского страхования для иностранных студентов.",
    price: 5700,
    unit: "item",
    durationDays: 2,
    isNotarial: false,
    sortOrder: 24,
  },
];

/** Языки перевода (зеркало сида языков). */
/** Языки перевода (зеркало 0010_offices_languages.sql): 14 исходных → русский. */
export const SEED_LANGUAGES: { code: string; name: string; isSource: boolean }[] = [
  { code: "tk", name: "Туркменский", isSource: true },
  { code: "uz", name: "Узбекский", isSource: true },
  { code: "tr", name: "Турецкий", isSource: true },
  { code: "az", name: "Азербайджанский", isSource: true },
  { code: "kk", name: "Казахский", isSource: true },
  { code: "ky", name: "Киргизский", isSource: true },
  { code: "fa", name: "Персидский (Иран, фарси)", isSource: true },
  { code: "ar-IQ", name: "Арабский (Ирак)", isSource: true },
  { code: "ar-SY", name: "Арабский (Сирия)", isSource: true },
  { code: "en", name: "Английский", isSource: true },
  { code: "de", name: "Немецкий", isSource: true },
  { code: "fr", name: "Французский", isSource: true },
  { code: "es", name: "Испанский", isSource: true },
  { code: "it", name: "Итальянский", isSource: true },
  { code: "ru", name: "Русский", isSource: false },
];

/** Точки приёма (зеркало 0010): часы и телефоны задаются в админке. */
export const SEED_OFFICES: { slug: string; name: string; address: string }[] = [
  { slug: "sibirsky-trakt", name: "Сибирский Тракт", address: "ул. Сибирский Тракт, 7/6" },
  { slug: "karla-marksa", name: "Карла Маркса", address: "ул. Карла Маркса, 65" },
  { slug: "promyslovaya", name: "Промысловая", address: "ул. Промысловая, 5, каб. 3" },
];
