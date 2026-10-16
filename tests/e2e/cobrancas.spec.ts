import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { checkAccessibility } from "../helpers/accessibility";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Cobranças (Asaas) — E2E com comportamento humano
 * Auth via storageState (auth.setup.ts) no playwright.deployed.config.ts
 * Tags: @human-behavior @cobrancas @accessibility
 */
test.describe("Cobranças Asaas @human-behavior @cobrancas", () => {
  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("deve abrir hub Cobranças, métricas, filtros e abas @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/boletos-asaas");
    await human.randomDelay(800, 1500);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    const blocked = page.getByText(/não está liberado para esta organização/i);
    if (await blocked.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Feature asaas_boleto não liberada para a org E2E");
    }

    await expect(page.getByRole("heading", { name: /^Cobranças$/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(/Asaas · Boletos/i)).toBeVisible();
    await expect(page.getByText(/^Total$/i)).toBeVisible();
    await expect(page.getByText(/^Quantidade$/i)).toBeVisible();
    await expect(page.getByText(/^Pago$/i).first()).toBeVisible();
    await expect(page.getByText(/^Em aberto$/i)).toBeVisible();

    await expect(page.getByRole("tab", { name: /^Todos$/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Boletos Parcelados/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nova cobrança/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Últimos Orçamentos/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Últimas Vendas/i })).toBeVisible();

    await expect(page.getByText(/Filtrar por data de criação/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Nome, descrição, código/i)).toBeVisible();

    await human.randomDelay(400, 800);
    await human.humanClick(page.getByRole("tab", { name: /Boletos Parcelados/i }));
    await human.randomDelay(400, 700);
    await expect(page.getByRole("tab", { name: /Boletos Parcelados/i })).toHaveAttribute(
      "data-state",
      "active"
    );

    await human.humanClick(page.getByRole("tab", { name: /^Todos$/i }));
    await human.randomDelay(300, 600);
  });

  test("deve abrir Nova cobrança com campos essenciais @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/boletos-asaas");
    await human.randomDelay(800, 1500);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    const blocked = page.getByText(/não está liberado para esta organização/i);
    if (await blocked.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Feature asaas_boleto não liberada para a org E2E");
    }

    await expect(page.getByRole("heading", { name: /^Cobranças$/i })).toBeVisible({
      timeout: 45_000,
    });

    await human.hesitate(300, 700);
    await human.humanClick(page.getByRole("button", { name: /Nova cobrança/i }));
    await human.randomDelay(500, 900);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("heading", { name: /Nova cobrança/i })).toBeVisible();

    await expect(dialog.locator("#cob-desc")).toBeVisible();
    await expect(dialog.locator("#cob-valor")).toBeVisible();
    await expect(dialog.locator("#cob-venc")).toBeVisible();
    await expect(dialog.locator("#cob-nome")).toBeVisible();
    await expect(dialog.getByText(/Conta a receber no financeiro/i)).toBeVisible();
    await expect(dialog.getByText(/Juros e multas por atraso/i)).toBeVisible();

    await human.humanType(dialog.locator("#cob-desc"), "E2E Cobrança teste", {
      clearFirst: true,
    });
    await human.randomDelay(200, 400);
    await human.humanType(dialog.locator("#cob-valor"), "150,00", { clearFirst: true });
    await human.randomDelay(200, 400);

    // Fecha sem gerar boleto real (não chama Asaas)
    await page.keyboard.press("Escape");
    await human.randomDelay(300, 600);
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });

  test("deve abrir Últimos Orçamentos e Últimas Vendas @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/boletos-asaas");
    await human.randomDelay(800, 1500);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    const blocked = page.getByText(/não está liberado para esta organização/i);
    if (await blocked.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Feature asaas_boleto não liberada para a org E2E");
    }

    await expect(page.getByRole("heading", { name: /^Cobranças$/i })).toBeVisible({
      timeout: 45_000,
    });

    await human.humanClick(page.getByRole("button", { name: /Últimos Orçamentos/i }));
    await human.randomDelay(500, 900);
    const orcDialog = page.getByRole("dialog");
    await expect(orcDialog).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await human.randomDelay(300, 600);

    await human.humanClick(page.getByRole("button", { name: /Últimas Vendas/i }));
    await human.randomDelay(500, 900);
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
  });

  test("hub Cobranças — acessibilidade básica @accessibility", async ({ page }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/boletos-asaas");
    await human.randomDelay(1000, 1800);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    const blocked = page.getByText(/não está liberado para esta organização/i);
    if (await blocked.isVisible({ timeout: 5_000 }).catch(() => false)) {
      test.skip(true, "Feature asaas_boleto não liberada para a org E2E");
    }

    await expect(page.getByRole("heading", { name: /^Cobranças$/i })).toBeVisible({
      timeout: 45_000,
    });

    // Mesmo padrão do PDV: analisa a11y sem falhar por botões do shell/layout
    const result = await checkAccessibility(page, {
      exclude: ["nav", "aside", "[data-sidebar]", ".sidebar", "header"],
      rules: ["label", "link-name", "image-alt"],
    });
    const labelViolations = (result.violations || []).filter((v) => v.id === "label");
    expect(
      labelViolations,
      JSON.stringify(labelViolations.map((v) => ({ id: v.id, nodes: v.nodes?.length }))),
    ).toHaveLength(0);
  });
});
