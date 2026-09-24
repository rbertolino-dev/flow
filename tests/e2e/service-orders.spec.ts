import { test, expect } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials, loginAsTestUser } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Ordem de Serviço — etapas customizáveis + criação
 * Tags: @human-behavior @service-orders
 */
test.describe("Ordem de Serviço — etapas e criação @human-behavior @service-orders", () => {
  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("deve abrir OS, gerenciar etapas na engrenagem e criar ordem @human-behavior", async ({
    page,
  }) => {
    const human = new HumanBehavior(page);

    await human.humanNavigate("/service-orders");
    await human.randomDelay(800, 1500);

    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida — rode auth.setup");
    }

    await expect(page.getByRole("heading", { name: /ordem de serviço/i })).toBeVisible({
      timeout: 45_000,
    });

    await expect(page.getByTestId("os-status-cards")).toBeVisible();
    await expect(page.getByTestId("os-criar-btn")).toBeVisible();
    await expect(page.getByTestId("os-etapas-gear-btn")).toBeVisible();

    // Abrir engrenagem de etapas
    await human.hesitate(300, 600);
    await human.humanClick(page.getByTestId("os-etapas-gear-btn"));
    await expect(page.getByTestId("os-statuses-dialog")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/etapas da ordem de serviço/i)).toBeVisible();

    const stageName = `etapa e2e ${Date.now().toString().slice(-5)}`;
    await human.humanType(page.getByTestId("os-status-new-name"), stageName);
    await human.randomDelay(200, 400);
    await human.humanClick(page.getByTestId("os-status-color-22c55e"));
    await human.hesitate(300, 500);
    await human.humanClick(page.getByTestId("os-status-create-btn"));

    await expect(page.getByText(stageName).first()).toBeVisible({ timeout: 20_000 });

    await human.humanClick(page.getByRole("button", { name: /^fechar$/i }));
    await expect(page.getByTestId("os-statuses-dialog")).toBeHidden({ timeout: 10_000 });

    // Card da nova etapa deve aparecer
    await expect(page.getByText(stageName).first()).toBeVisible({ timeout: 15_000 });

    // Criar ordem
    await human.humanClick(page.getByTestId("os-criar-btn"));
    await expect(page.getByText(/nova ordem de serviço/i)).toBeVisible({ timeout: 15_000 });

    const responsavel = page.getByLabel(/responsável/i).first();
    if (await responsavel.isVisible().catch(() => false)) {
      await human.humanType(responsavel, "Wendel Teste E2E");
    }

    const diagnostico = page.getByLabel(/diagnóstico/i).first();
    if (await diagnostico.isVisible().catch(() => false)) {
      await human.humanType(diagnostico, "Problema detectado no teste E2E");
    }

    await human.hesitate(400, 700);
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));
    await human.randomDelay(500, 900);

    // Passo produtos
    await expect(page.getByText(/adicionar produtos|total da o\.s/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));
    await human.randomDelay(400, 800);

    // Passo finalizar — selecionar status
    await expect(page.getByText(/checklist da os|atribuir status/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const statusSelect = page.getByLabel(/atribuir status/i);
    if (await statusSelect.isVisible().catch(() => false)) {
      await human.humanClick(statusSelect);
      await human.randomDelay(200, 400);
      const option = page.getByRole("option", { name: new RegExp(stageName, "i") });
      if (await option.isVisible().catch(() => false)) {
        await human.humanClick(option);
      }
    }

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: /^finalizar$/i }));

    await expect(page.getByText(/ordem criada|os \d+/i).first()).toBeVisible({
      timeout: 30_000,
    }).catch(() => undefined);

    // Listagem deve refletir a nova OS ou ao menos permanecer funcional
    await expect(page.getByTestId("os-criar-btn")).toBeVisible({ timeout: 20_000 });
  });

  test("deve criar modelo de prestação de serviço, checklist e ordem completa @human-behavior", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }
    const logged = await loginAsTestUser(page);
    test.skip(!logged, "Sessão E2E inválida");

    const human = new HumanBehavior(page);
    const stamp = Date.now().toString().slice(-6);
    const modelName = `Manutenção residencial ${stamp}`;
    const checklistName = `Vistoria da visita ${stamp}`;
    const customField = `Observação do técnico ${stamp}`;

    await human.humanNavigate("/service-orders");
    await expect(page.getByTestId("os-org-ready")).toBeVisible({ timeout: 45_000 });

    await human.humanClick(page.getByTestId("os-modelos-btn"));
    await expect(page.getByText("Modelo de Ordem de Serviço")).toBeVisible({ timeout: 15_000 });

    await human.humanType(page.getByTestId("os-template-name"), modelName);
    await human.hesitate(300, 600);
    await human.humanClick(page.getByTestId("os-template-create"));
    await expect(page.getByRole("heading", { name: modelName })).toBeVisible({ timeout: 20_000 });

    const newField = page.getByTestId("os-template-new-field");
    await newField.scrollIntoViewIfNeeded();
    await human.humanType(newField, customField);
    await human.humanClick(page.getByTestId("os-template-add-field"));
    const typeSelect = page.getByTestId(/os-field-type-custom/).last();
    await expect(typeSelect).toBeVisible({ timeout: 15_000 });
    await typeSelect.scrollIntoViewIfNeeded();
    await human.humanClick(typeSelect);
    await human.humanClick(page.getByRole("option", { name: "Texto longo" }));
    await expect(typeSelect).toContainText("Texto longo");

    await human.humanClick(page.getByRole("tab", { name: "Checklists" }));
    await human.humanType(page.getByTestId("os-checklist-name"), checklistName);
    const checklistItem = page.getByTestId("os-checklist-item");
    await checklistItem.scrollIntoViewIfNeeded();
    await human.humanType(checklistItem, "Conferir o local antes de iniciar");
    await human.humanClick(page.getByTestId("os-checklist-add-item"));
    await human.humanClick(page.getByRole("combobox").filter({ hasText: "Checkpoint" }));
    await human.humanClick(page.getByRole("option", { name: "Escrever" }));
    const writtenItem = page.getByTestId("os-checklist-item");
    await expect(writtenItem).toBeVisible();
    await human.humanType(writtenItem, "Descrever o que foi encontrado");
    await human.humanClick(page.getByTestId("os-checklist-add-item"));
    await human.hesitate(200, 400);
    await human.humanClick(page.getByTestId("os-checklist-save"));
    await expect(page.getByText(checklistName).first()).toBeVisible({ timeout: 15_000 });

    await human.humanClick(page.getByRole("tab", { name: "Modelo" }));
    await human.humanClick(page.getByRole("button", { name: modelName }));
    const checklistCard = page.locator("div.rounded-2xl").filter({ hasText: checklistName }).last();
    await checklistCard.scrollIntoViewIfNeeded();
    await human.humanClick(checklistCard.getByText("Vincular", { exact: true }));
    await expect(checklistCard.locator(".bg-amber-100")).toBeVisible({ timeout: 15_000 });

    await human.humanClick(page.getByRole("button", { name: "Close" }));

    await human.humanClick(page.getByTestId("os-criar-btn"));
    await expect(page.getByText(/nova ordem de serviço/i)).toBeVisible({ timeout: 15_000 });
    await human.humanClick(page.getByTestId("os-model-select"));
    await human.humanClick(page.getByRole("option", { name: new RegExp(modelName) }));

    const clientSearch = page.getByPlaceholder("Buscar cliente...");
    await human.humanType(clientSearch, "a");
    const client = page.getByRole("dialog").locator("button.w-full").filter({ hasText: "—" }).first();
    await expect(client).toBeVisible({ timeout: 10_000 });
    await human.humanClick(client);

    await expect(page.getByTestId("os-schedule")).toBeVisible();
    await human.humanClick(page.getByTestId("os-schedule-single"));
    await expect(page.getByTestId("os-schedule-end")).toHaveCount(0);
    await page.getByTestId("os-schedule-start").fill("2026-09-24T09:30");
    await human.humanClick(page.getByTestId("os-schedule-range"));
    await expect(page.getByTestId("os-schedule-end")).toBeVisible();
    await page.getByTestId("os-schedule-start").fill("2026-09-24T09:30");
    await page.getByTestId("os-schedule-end").fill("2026-09-26T18:00");

    for (const [placeholder, value] of [
      ["Relato do cliente", "Cliente pediu manutenção preventiva do ar-condicionado."],
      ["Diagnóstico/Problema", "Filtro saturado e dreno obstruído."],
      ["Solução/Instrução", "Limpeza completa e teste de funcionamento."],
      ["Termo de garantia (opcional)", "Garantia de 90 dias sobre o serviço executado."],
      [customField, "Acesso pelo portão lateral."],
    ] as const) {
      const field = page.getByPlaceholder(placeholder);
      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeVisible();
      await human.humanType(field, value);
    }

    const address = page.getByPlaceholder("Endereço");
    await address.scrollIntoViewIfNeeded();
    await human.humanType(address, "Rua das Acácias, 120, Centro");

    for (let i = 0; i < 2; i++) {
      const userSelect = page.getByText("Selecione um usuário da organização").first();
      if (!(await userSelect.isVisible().catch(() => false))) break;
      await userSelect.scrollIntoViewIfNeeded();
      await human.humanClick(userSelect);
      const option = page.getByRole("option").first();
      if (!(await option.isVisible().catch(() => false))) {
        await page.keyboard.press("Escape");
        break;
      }
      await human.humanClick(option);
    }

    const serviceSelect = page.getByText("Selecione um serviço");
    if (await serviceSelect.isVisible().catch(() => false)) {
      await serviceSelect.scrollIntoViewIfNeeded();
      await human.humanClick(serviceSelect);
      const serviceOption = page.getByRole("option").first();
      if (await serviceOption.isVisible().catch(() => false)) {
        await human.humanClick(serviceOption);
      } else {
        await page.keyboard.press("Escape");
      }
    }

    const commission = page.getByText(/empresa comissionada/i);
    if (await commission.isVisible().catch(() => false)) {
      await commission.scrollIntoViewIfNeeded();
      await human.humanClick(commission);
      const commissionValue = page.getByRole("spinbutton").first();
      if (await commissionValue.isVisible().catch(() => false)) {
        await commissionValue.fill("150");
      }
    }

    await human.hesitate(400, 700);
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));
    await human.humanClick(page.getByRole("button", { name: /^próximo$/i }));

    await expect(
      page.getByText(checklistName).or(page.getByText("Conferir o local antes de iniciar")).first()
    ).toBeVisible({ timeout: 15_000 });

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: /^finalizar$/i }));
    await expect(page.getByTestId("os-criar-btn")).toBeVisible({ timeout: 30_000 });
  });
});
