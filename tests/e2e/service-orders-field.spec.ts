import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Operação de campo OS — usa storageState do auth.setup (não reloga).
 * Tags: @human-behavior @service-orders @field
 */
test.describe("Ordem de Serviço — operação de campo @human-behavior @service-orders @field", () => {
  test.beforeEach(async ({ page }) => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }
  });

  test("aba Campo, fotos antes, QR no detalhe e deep link @human-behavior", async ({ page }) => {
    test.setTimeout(240_000);
    const human = new HumanBehavior(page);

    await human.humanNavigate("/service-orders/campo");
    await human.randomDelay(800, 1400);
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    await expect(page.getByRole("heading", { name: /ordem de serviço/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByTestId("os-tab-campo")).toBeVisible();
    await expect(page.getByTestId("os-field-tab")).toBeVisible({ timeout: 30_000 });

    // Toggle próximos 7 dias
    const next7 = page.locator("#os-field-next7");
    await expect(next7).toBeVisible();
    await human.humanClick(next7);
    await human.randomDelay(400, 700);

    // Criar OS — bloco fotos antes
    await human.humanNavigate("/service-orders");
    await expect(page.getByTestId("os-org-ready")).toBeVisible({ timeout: 45_000 });
    await human.humanClick(page.getByTestId("os-criar-btn"));
    await expect(page.getByText(/nova ordem de serviço/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("os-reference-images")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");
    await human.randomDelay(400, 700);

    // Abrir detalhe de uma OS existente
    await human.humanNavigate("/service-orders");
    await expect(page.getByTestId("os-org-ready")).toBeVisible({ timeout: 45_000 });

    const openTarget = page
      .locator("[data-testid^='os-mobile-card-'], table tbody tr, .os-mobile-cards button")
      .first();
    test.skip(
      !(await openTarget.isVisible({ timeout: 15_000 }).catch(() => false)),
      "Sem OS na lista para abrir detalhe"
    );

    await human.humanClick(openTarget);
    await expect(page.getByTestId("os-detail-dialog")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId("os-detail-qr")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /copiar link da os/i })).toBeVisible();

    const maps = page.getByRole("link", { name: /abrir no maps/i });
    if (await maps.isVisible().catch(() => false)) {
      await expect(maps).toHaveAttribute("href", /google\.com\/maps/);
    }

    // Extrai código da OS do título para deep link via listagem
    const title = (await page.getByTestId("os-detail-dialog").locator('[class*="DialogTitle"], h2').first().textContent()) || "";
    const codeMatch = title.match(/(\d{4,})/);
    await page.keyboard.press("Escape");
    await human.randomDelay(500, 800);

    // Deep link: navega com os= inválido — app não deve cair
    await human.humanNavigate("/service-orders?os=00000000-0000-0000-0000-000000000000");
    await human.randomDelay(1200, 2000);
    await expect(page.getByRole("heading", { name: /ordem de serviço/i })).toBeVisible({
      timeout: 45_000,
    });

    // Campo: abrir card se houver
    await human.humanNavigate("/service-orders/campo");
    await expect(page.getByTestId("os-field-tab")).toBeVisible({ timeout: 30_000 });
    const fieldOpen = page.getByRole("button", { name: /^abrir$/i }).first();
    if (await fieldOpen.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await human.humanClick(fieldOpen);
      await expect(page.getByTestId("os-detail-dialog")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("tab", { name: /^vendas$/i })).toHaveCount(0);
      await expect(page.getByRole("tab", { name: /^financeiro$/i })).toHaveCount(0);
      await expect(page.getByTestId("os-detail-qr")).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByText(/nenhuma ordem sua|minhas os/i).first()).toBeVisible();
    }

    // smoke: codeMatch só para log
    if (codeMatch) {
      expect(codeMatch[1].length).toBeGreaterThan(3);
    }
  });

  test("fechamento bloqueia com checklist incompleto @human-behavior", async ({ page }) => {
    test.setTimeout(180_000);
    const human = new HumanBehavior(page);

    await human.humanNavigate("/service-orders");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await expect(page.getByTestId("os-org-ready")).toBeVisible({ timeout: 45_000 });

    const openTarget = page
      .locator("[data-testid^='os-mobile-card-'], table tbody tr, .os-mobile-cards button")
      .first();
    test.skip(!(await openTarget.isVisible({ timeout: 12_000 }).catch(() => false)), "Sem OS na lista");

    await human.humanClick(openTarget);
    await expect(page.getByTestId("os-detail-dialog")).toBeVisible({ timeout: 20_000 });

    await human.humanClick(page.getByRole("tab", { name: /checklist/i }));
    await human.randomDelay(400, 700);

    const items = page.getByTestId("os-detail-dialog").locator('[role="checkbox"]');
    const count = await items.count();
    test.skip(count === 0, "OS sem checklist — gate não aplicável");

    const first = items.first();
    if ((await first.getAttribute("data-state")) === "checked") {
      await human.humanClick(first);
      await human.randomDelay(600, 1000);
    }

    await human.humanClick(page.getByTestId("os-detail-close-btn"));
    await human.randomDelay(700, 1200);

    const toast = page.getByText(/checklist incompleto/i);
    const closeDialog = page.getByTestId("os-close-dialog");

    if (await toast.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await expect(toast).toBeVisible();
      return;
    }

    // Se o dialog abriu, o gate deve disparar no finalize
    await expect(closeDialog).toBeVisible({ timeout: 10_000 });
    const summary = page.getByTestId("os-close-summary");
    if (await summary.isVisible().catch(() => false)) {
      await human.humanType(summary, "Teste E2E bloqueio checklist");
    }
    // Assinatura mínima se necessário — tenta finalizar
    const finalize = page.getByRole("button", { name: /finalizar|encerrar|confirmar/i }).first();
    if (await finalize.isVisible().catch(() => false)) {
      await human.humanClick(finalize);
    }
    await expect(page.getByText(/checklist incompleto/i)).toBeVisible({ timeout: 12_000 });
  });
});
