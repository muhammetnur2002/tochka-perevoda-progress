import type { Metadata } from "next";

export const metadata: Metadata = { title: "Тестовая оплата СБП", robots: { index: false } };

/**
 * Сюда ведёт QR-код mock-провайдера (когда ключи ЮKassa не заданы).
 * Реальной оплаты нет: подтвердите её кнопкой «Я оплатил(а)» на странице оплаты.
 */
export default function MockSbpPage() {
  return (
    <div className="container max-w-xl py-16 text-center">
      <h1 className="text-2xl font-extrabold text-brand-800">Тестовый QR-код СБП</h1>
      <p className="mt-4 text-slate-700">
        Платформа работает в демо-режиме без подключённой ЮKassa, поэтому этот QR ведёт на тестовую страницу.
        Вернитесь на страницу оплаты и нажмите «Я оплатил(а)».
      </p>
    </div>
  );
}
