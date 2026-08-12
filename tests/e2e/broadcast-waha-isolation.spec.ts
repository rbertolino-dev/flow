import { expect, test } from "@playwright/test";

import { loginAsTestUser, hasE2ECredentials } from "../helpers/auth";
import { HumanBehavior } from "../helpers/human-behavior";

test.describe("Disparador WAHA isolado @human-behavior", () => {
  test("alterna entre WAHA e Evolution sem misturar os painéis", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByRole("heading", { name: "Disparador WAHA" })).toBeVisible();
    await expect(page.getByTestId("waha-dispatch-stats")).toBeVisible();
    await expect(page.getByText("Disparos no período")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dia" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Semana" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mês" })).toBeVisible();
    await expect(page.getByText("Realizados")).toBeVisible();
    await expect(page.getByText("Falharam")).toBeVisible();
    await human.hesitate(300, 600);
    await human.humanClick(page.getByRole("button", { name: "Semana" }));
    await expect(page.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
    await human.humanClick(page.getByRole("button", { name: "Mês" }));
    await expect(page.getByRole("button", { name: "Mês" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Criar campanha Evolution" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar campanha WAHA" })).toBeVisible();
    await expect(page.getByText("Sincronizar status com Evolution")).toHaveCount(0);

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: "Criar campanha Evolution" }));
    await expect(page).toHaveURL(/\/broadcast-2$/);
    await expect(page.getByText("Sincronizar status com Evolution")).toBeVisible();
  });

  test("cria template antes da campanha e permite selecioná-lo", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);
    const templateName = `Template WAHA E2E ${Date.now()}`;

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await human.humanClick(page.getByRole("button", { name: "Novo template WAHA" }));
    await expect(page.getByRole("heading", { name: "Novo template WAHA" })).toBeVisible();
    await expect(page.locator("#waha-template-method")).toHaveCount(0);
    await expect(page.locator("#waha-template-min-delay")).toHaveCount(0);
    await expect(page.locator("#waha-template-max-delay")).toHaveCount(0);

    await human.humanType("#waha-template-name", templateName);
    await human.humanType("#waha-template-message", "Olá {nome}, falamos da");
    const templateDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Novo template WAHA" }),
    });
    await human.humanClick(
      templateDialog.getByRole("button", { name: "Inserir {empresa}" }),
    );
    await human.humanClick(
      templateDialog.getByRole("button", { name: "Adicionar variações" }),
    );
    await human.humanType(
      "#waha-template-message",
      "Oi {nome}, esta mensagem é da {empresa}.",
    );
    await human.humanClick(
      templateDialog.getByRole("button", { name: "Adicionar variação", exact: true }),
    );
    await human.hesitate(400, 800);
    await human.humanClick(
      templateDialog.getByRole("button", { name: "Salvar template WAHA" }),
    );

    await expect(page.getByText(templateName, { exact: true })).toBeVisible();
    await human.humanClick(page.getByRole("button", { name: "Nova campanha WAHA" }));
    await expect(page.locator("#waha-name")).toHaveValue("");
    await human.humanClick(page.locator("#waha-method"));
    await human.humanClick(page.getByRole("option", { name: /Separado/ }));
    await human.humanClick(page.locator("#waha-template"));
    await human.humanClick(
      page.getByRole("option", { name: new RegExp(templateName) }),
    );
    await expect(page.getByText("2 variação(ões).")).toBeVisible();
    await expect(page.locator("#waha-name")).toHaveValue("");
    await expect(page.locator("#waha-method")).toContainText("Separado");

    await human.humanClick(page.getByRole("button", { name: "Fechar" }));
    await human.humanClick(
      page.getByRole("button", { name: `Excluir template ${templateName}` }),
    );
    await expect(page.getByText(templateName, { exact: true })).toHaveCount(0);
  });

  test("valida WhatsApp e simula sem criar campanha", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByText("Templates WAHA")).toBeVisible();

    const phoneText = await page.getByText(/^55\d{10,13}\s·/).first().textContent();
    const phone = phoneText?.match(/55\d{10,13}/)?.[0];
    test.skip(!phone, "Nenhuma sessão WAHA com telefone disponível");

    await human.humanClick(page.getByRole("button", { name: "Nova campanha WAHA" }));
    await human.humanType("#waha-name", "Simulação E2E WAHA");
    await human.humanClick(page.locator('[role="checkbox"]').first());
    await human.humanType(
      "#waha-message",
      "Olá, {nome} da {empresa}! Teste de simulação.",
    );
    await human.humanClick(page.getByRole("button", { name: "Adicionar variações" }));
    await human.humanType(
      "#waha-message",
      "Oi, {nome} da {empresa}! Segunda variação.",
    );
    await human.humanClick(page.getByRole("button", { name: "Adicionar variação", exact: true }));
    await expect(page.getByText("2 variação(ões).")).toBeVisible();
    await human.humanType(
      "#waha-contacts",
      `Nome;Empresa;Telefone\nContato teste;Empresa E2E;${phone}`,
    );

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: "Checar e validar WhatsApp" }));
    await expect(page.getByText("Com WhatsApp")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    await human.humanClick(page.getByRole("button", { name: "Simular envio" }));
    await expect(page.getByRole("heading", { name: "Simulação do envio WAHA" })).toBeVisible();
    await expect(page.getByText("Esta simulação não envia mensagens nem grava a campanha.")).toBeVisible();
    await expect(page.getByText("Distribuição por sessão")).toBeVisible();
    await expect(page.getByText("Prévia das variações personalizadas")).toBeVisible();
    const simulationDialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Simulação do envio WAHA" }),
    });
    await expect(simulationDialog.getByText("Variação 1")).toBeVisible();
    await expect(simulationDialog.getByText("Variação 2")).toBeVisible();
    await expect(simulationDialog.getByText(/Empresa E2E/).first()).toBeVisible();
  });

  test("abre histórico de envio da campanha WAHA como no Evolution", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByRole("heading", { name: "Disparador WAHA" })).toBeVisible();

    const logsButton = page.getByRole("button", { name: "Logs" }).first();
    test.skip(
      (await logsButton.count()) === 0,
      "Nenhuma campanha WAHA disponível para abrir o histórico",
    );

    await human.hesitate(400, 800);
    await human.humanClick(logsButton);
    await expect(page.getByRole("heading", { name: "Logs de Disparo" })).toBeVisible();
    await expect(page.getByText(/Histórico detalhado de todos os disparos/)).toBeVisible();
    await expect(page.getByText("Total na fila")).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por número de telefone...")).toBeVisible();
    await expect(page.getByText("Filtrar por sessão")).toBeVisible();
  });

  test("permite editar o nome da campanha WAHA depois de criada", async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByRole("heading", { name: "Disparador WAHA" })).toBeVisible();

    const editButton = page.getByRole("button", { name: /Editar nome da campanha/ }).first();
    test.skip(
      (await editButton.count()) === 0,
      "Nenhuma campanha WAHA disponível para editar o nome",
    );

    await human.hesitate(400, 800);
    await human.humanClick(editButton);
    const nameInput = page.getByLabel("Novo nome da campanha WAHA");
    await expect(nameInput).toBeVisible();
    await expect(nameInput).not.toHaveValue("");
    await expect(page.getByRole("button", { name: "Salvar nome da campanha" })).toBeVisible();
    await human.humanClick(page.getByRole("button", { name: "Cancelar edição do nome" }));
    await expect(nameInput).toHaveCount(0);
    await expect(editButton).toBeVisible();
  });
});
