import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { checkAccessibility } from "../helpers/accessibility";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * PDV — validação E2E com comportamento humano
 * Auth via storageState (auth.setup.ts) no playwright.deployed.config.ts
 * Tags: @human-behavior @pdv @accessibility
 */
test.describe("PDV — ponto de venda @human-behavior @pdv", () => {
  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("deve abrir PDV, listar catálogo e finalizar venda @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/pdv");
    await human.randomDelay(800, 1500);

    // Se redirecionou para login, sessão inválida
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    await expect(page.getByRole("button", { name: /histórico de vendas/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(/^resumo$/i)).toBeVisible();
    await expect(page.getByRole("tab", { name: /produtos/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /serviços/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^finalizar$/i })).toBeVisible();

    const productBtn = page.locator("ul.divide-y li button").first();
    const emptyMsg = page.getByText(/nenhum produto encontrado/i);
    await expect(productBtn.or(emptyMsg)).toBeVisible({ timeout: 45_000 });

    const hasProducts = await productBtn.isVisible().catch(() => false);
    test.skip(!hasProducts, "Org sem produtos ativos — catálogo vazio");

    await human.randomDelay(400, 800);
    await human.humanClick(productBtn);
    await human.randomDelay(300, 600);

    const cartBtn = page.getByRole("button", { name: /itens inventário/i });
    await expect(cartBtn).toContainText(/1/);

    await human.humanClick(cartBtn);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/itens da venda/i)).toBeVisible();
    await human.hesitate(300, 600);
    await human.humanClick(page.getByRole("button", { name: /^fechar$/i }));

    await human.randomDelay(200, 400);
    const selectTrigger = page.locator('[role="combobox"]').last();
    await human.humanClick(selectTrigger);
    await human.randomDelay(200, 400);
    const pixOption = page.getByRole("option", { name: /^pix$/i });
    await expect(pixOption).toBeVisible({ timeout: 10_000 });
    await human.humanClick(pixOption);

    await human.hesitate(400, 800);
    const finalize = page.getByRole("button", { name: /^finalizar$/i });
    await expect(finalize).toBeEnabled();

    const finalizeResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.request().method() === "POST" &&
        res.status() < 500,
      { timeout: 45_000 }
    );

    await human.humanClick(finalize);
    const res = await finalizeResponse;
    expect(res.ok() || res.status() === 201).toBeTruthy();

    await expect(page.getByText(/venda finalizada|venda #/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole("button", { name: /itens inventário\s*0/i })).toBeVisible({
      timeout: 15_000,
    });

    const historyResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.url().includes("list_sales") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );
    await human.humanClick(page.getByRole("button", { name: /histórico de vendas/i }));
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: /histórico de vendas/i })
    ).toBeVisible();
    const histRes = await historyResponse;
    expect(histRes.ok()).toBeTruthy();
    const histBody = await histRes.json();
    expect(Array.isArray(histBody.data)).toBeTruthy();
    expect(histBody.data.length).toBeGreaterThan(0);

    await expect(page.getByRole("dialog").getByText(/#\d+/).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("PDV — acessibilidade básica @accessibility @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/pdv");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await expect(page.getByText(/^resumo$/i)).toBeVisible({ timeout: 45_000 });
    await checkAccessibility(page, { failOnViolations: false });
  });
});
