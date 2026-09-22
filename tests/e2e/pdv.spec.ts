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
    await page.waitForURL(/\/pdv\/historico/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /histórico de vendas/i })
    ).toBeVisible({ timeout: 30_000 });
    const histRes = await historyResponse;
    expect(histRes.ok()).toBeTruthy();
    const histBody = await histRes.json();
    expect(Array.isArray(histBody.data)).toBeTruthy();
    expect(histBody.summary).toBeTruthy();

    await expect(page.getByText(/quantidade de vendas/i)).toBeVisible();
    await expect(page.getByText(/total das vendas/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /^código$/i })).toBeVisible();
  });

  test("PDV histórico — página dedicada @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/pdv/historico");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await expect(
      page.getByRole("heading", { name: /histórico de vendas/i })
    ).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("button", { name: /^exportar$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^filtros$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^caixa$/i })).toBeVisible();
    await expect(page.getByText(/quantidade de vendas/i)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /serviço\/produto/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /nota fiscal/i })).toBeVisible();
  });

  test("PDV histórico — abrir comprovante de venda @human-behavior @pdv", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/pdv/historico");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }

    await expect(
      page.getByRole("heading", { name: /histórico de vendas/i })
    ).toBeVisible({ timeout: 45_000 });

    const empty = page.getByText(/nenhuma venda encontrada/i);
    const firstRow = page.locator("table tbody tr").first();
    await expect(firstRow.or(empty)).toBeVisible({ timeout: 45_000 });

    const hasRow = await firstRow.isVisible().catch(() => false);
    const isEmpty = await empty.isVisible().catch(() => false);
    test.skip(isEmpty || !hasRow, "Sem vendas no período para abrir comprovante");

    const getSaleResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.url().includes("get_sale") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );

    await human.randomDelay(400, 800);
    await human.humanClick(firstRow);

    const res = await getSaleResponse;
    expect(res.ok()).toBeTruthy();

    await expect(page.getByText(/comprovante de venda/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/informações da venda/i)).toBeVisible();
    await expect(page.getByText(/formas de pagamento/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /romaneio de entrega/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /romaneio de montagem/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /trocar produtos/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /alterar venda/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /excluir venda/i })).toBeVisible();
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
