import { expect, test } from "@playwright/test";

/**
 * Дымовой E2E. Базовая часть работает без БД (NEXT_PUBLIC_DEMO_MODE=true).
 * Полный сценарий — E2E_FULL=1 и настроенный Supabase с pnpm db:seed:
 *   E2E_FULL=1 pnpm test:e2e
 */

test.describe("публичная часть", () => {
  test("главная: бренд, адрес, переход в калькулятор", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Сибирский Тракт, 7/6").first()).toBeVisible();
    await page.getByRole("link", { name: /Рассчитать стоимость/ }).first().click();
    await expect(page).toHaveURL(/\/calculator/);
  });

  test("калькулятор: срочность меняет итог", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("button", { name: /Увеличить: Перевод паспорта \(все страницы\)/ }).click();
    const total = page.locator("aside").getByText(/₽/).last();
    const before = await total.textContent();
    await page.getByRole("button", { name: /Срочно — за 1 день/ }).click();
    await expect(total).not.toHaveText(before ?? "");
    await expect(page.getByRole("link", { name: "Оформить заказ" })).toBeVisible();
  });

  test("статус: требует номер и телефон", async ({ page }) => {
    await page.goto("/status");
    await expect(page.getByLabel("Номер заказа")).toBeVisible();
    await expect(page.getByLabel("Телефон")).toBeVisible();
  });

  test("юридические страницы 152-ФЗ доступны", async ({ page }) => {
    for (const path of ["/legal/privacy", "/legal/consent", "/legal/terms"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
    }
  });

  test("закрытые разделы требуют входа", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  });
});

test.describe("полный сценарий заказа", () => {
  test.skip(!process.env.E2E_FULL, "нужен Supabase с демо-данными (E2E_FULL=1)");

  test("гость: заказ → mock-оплата → статус", async ({ page }) => {
    await page.goto("/calculator");
    await page.getByRole("button", { name: /Увеличить: Перевод паспорта \(все страницы\)/ }).click();
    await page.getByRole("link", { name: "Оформить заказ" }).click();

    await page.getByLabel("Имя *").fill("Тест E2E");
    await page.getByLabel("Телефон *").fill("9170000001");
    await page.getByRole("checkbox").last().check();
    await page.getByRole("button", { name: "Перейти к оплате" }).last().click();

    await expect(page).toHaveURL(/\/checkout\/pay\//, { timeout: 20_000 });
    const heading = await page.getByRole("heading", { level: 1 }).textContent();
    const number = heading?.match(/ТП-\d{4}-\d{6}/)?.[0];
    expect(number).toBeTruthy();

    await page.getByRole("button", { name: "Я оплатил(а)" }).click();
    await expect(page).toHaveURL(/\/checkout\/success\//, { timeout: 20_000 });
    await expect(page.getByText(/оплачен/)).toBeVisible();

    await page.goto(`/status?number=${encodeURIComponent(number!)}`);
    await page.getByLabel("Телефон").fill("9170000001");
    await page.getByRole("button", { name: "Проверить" }).click();
    await expect(page.getByText("Подтверждён").first()).toBeVisible();
  });

  test("менеджер: вход и канбан", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("manager@tochka.local");
    await page.getByLabel("Пароль").fill("Manager123!");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await page.getByRole("link", { name: "Заказы" }).first().click();
    await expect(page.getByRole("region", { name: "Новые" })).toBeVisible();
    await expect(page.getByRole("region", { name: "В работе" })).toBeVisible();
  });
});
