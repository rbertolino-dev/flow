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

    await expect(page.getByRole("heading", { name: /^resumo$/i })).toBeVisible();
    await expect(page.getByText(/valor unit/i).first()).toBeVisible({ timeout: 10_000 });

    // Cliente da organização (obrigatório) — cria se necessário
    const clientInput = page.getByPlaceholder(/buscar cliente da organização/i);
    await expect(clientInput).toBeVisible();
    await human.humanClick(clientInput);
    await human.humanType(clientInput, "E2E");
    await human.randomDelay(600, 1000);
    const clientOption = page
      .locator(".absolute.z-20 button")
      .filter({ hasText: /./ })
      .first();
    const hasClient = await clientOption.isVisible().catch(() => false);
    if (hasClient) {
      await human.humanClick(clientOption);
    } else {
      await human.humanClick(page.getByTitle(/criar cliente nesta organização/i));
      const createDialog = page.getByRole("dialog").filter({ hasText: /novo cliente/i });
      await expect(createDialog).toBeVisible();
      await human.humanType(createDialog.locator("input").nth(0), `Cliente E2E ${Date.now()}`);
      await human.humanType(createDialog.locator("input").nth(1), "11999998888");
      await human.hesitate(300, 600);
      await human.humanClick(createDialog.getByRole("button", { name: /^criar cliente$/i }));
      await expect(page.getByText(/cliente criado/i)).toBeVisible({ timeout: 15_000 });
    }

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
    await human.humanClick(finalize);

    // Dialog Confirmar venda
    await expect(page.getByRole("heading", { name: /confirmar venda/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/forma de pag/i)).toBeVisible();

    const finalizeResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.request().method() === "POST" &&
        res.status() < 500,
      { timeout: 45_000 }
    );

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: /^confirmar$/i }));
    const res = await finalizeResponse;
    expect(res.ok() || res.status() === 201).toBeTruthy();

    // Tela VENDA FINALIZADA + impressão cupom/A4 + nova venda
    await expect(page.getByText(/venda finalizada/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /nova venda/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /imprimir cupom/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /imprimir comprovante a4/i })).toBeVisible();

    await human.humanClick(page.getByRole("button", { name: /nova venda/i }));
    await expect(page.getByText(/clique em um produto ou serviço/i)).toBeVisible({
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

    // Abrir comprovante da venda recém-criada (mesma sessão / org)
    const dataRow = page
      .locator("table tbody tr")
      .filter({ hasNotText: /nenhuma venda encontrada/i })
      .first();
    if (await dataRow.isVisible().catch(() => false)) {
      await human.randomDelay(300, 600);
      await human.humanClick(dataRow.locator("td").first());
      await expect(
        page.locator("span").filter({ hasText: /^Comprovante de venda$/i })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("button", { name: /excluir venda/i })).toBeVisible();
    }
  });

  test("PDV histórico — dialog Filtrar vendas @human-behavior @pdv", async ({
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

    await human.humanClick(page.getByRole("button", { name: /filtros/i }).first());
    const dialog = page.getByRole("dialog").filter({ hasText: /filtrar vendas/i });
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await expect(dialog.getByText(/^cliente$/i)).toBeVisible();
    await expect(dialog.getByText(/^responsável$/i)).toBeVisible();
    await expect(dialog.getByText(/forma de pagamento/i)).toBeVisible();
    await expect(dialog.getByText(/^origem$/i)).toBeVisible();
    await expect(dialog.getByText(/preço acima de/i)).toBeVisible();
    await expect(dialog.getByText(/preço abaixo de/i)).toBeVisible();

    // Forma de pagamento = PIX (4º combobox: cliente-tipo, responsável, pagamento, origem)
    const comboboxes = dialog.locator('[role="combobox"]');
    await expect(comboboxes).toHaveCount(4, { timeout: 10_000 });
    await human.humanClick(comboboxes.nth(2));
    await human.randomDelay(200, 400);
    await human.humanClick(page.getByRole("option", { name: /^pix$/i }));

    const filterResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.url().includes("list_sales") &&
        res.url().includes("payment_method=pix") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );

    await human.hesitate(300, 600);
    await human.humanClick(
      dialog.getByRole("button", { name: /filtrar vendas com nota emitida/i })
    );

    const res = await filterResponse;
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.summary).toBeTruthy();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(/quantidade de vendas/i)).toBeVisible({
      timeout: 15_000,
    });

    // Limpar filtros
    await human.humanClick(page.getByRole("button", { name: /filtros/i }).first());
    await expect(dialog).toBeVisible();
    const clearResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.url().includes("list_sales") &&
        !res.url().includes("payment_method=") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );
    await human.humanClick(dialog.getByRole("button", { name: /limpar filtros/i }));
    const clearRes = await clearResponse;
    expect(clearRes.ok()).toBeTruthy();
  });

  test("PDV — novo cliente no atalho F10 @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/pdv");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await expect(page.getByRole("heading", { name: /^resumo$/i })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByRole("button", { name: /f10\s*novo cliente/i })).toBeVisible();
    await expect(page.locator("kbd", { hasText: /^F5$/ })).toHaveCount(0);
  });

  test("PDV — configurações de venda @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    await human.humanNavigate("/pdv");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await expect(page.getByRole("heading", { name: /^resumo$/i })).toBeVisible({
      timeout: 45_000,
    });
    await human.humanClick(page.getByRole("button", { name: /configurações do pdv/i }));
    await expect(page.getByRole("heading", { name: /configuração de venda/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/observações da venda/i)).toBeVisible();
    await expect(page.getByText(/cliente padrão/i)).toBeVisible();
    await expect(page.getByText(/venda simples/i)).toBeVisible();
    await expect(page.getByText(/comissão de venda obrigatória/i)).toBeVisible();
    await expect(page.getByText(/registro de meio de pagamento/i)).toBeVisible();
    await expect(page.getByText(/código do estoque padrão/i)).toBeVisible();
    await expect(page.getByText(/bloqueio de produtos em falta/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^salvar$/i })).toBeVisible();

    await human.humanClick(page.getByRole("button", { name: /^descontos$/i }));
    await expect(page.getByRole("heading", { name: /desconto por forma de pagamento/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^adicionar$/i })).toBeVisible();
    await human.humanClick(page.getByRole("combobox").first());
    await expect(page.getByRole("option", { name: /^pix$/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /^permuta$/i })).toBeVisible();
    await expect(page.getByRole("option", { name: /^crediário$/i })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("PDV — desconto à vista aplicado na venda @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }

    await human.humanNavigate("/pdv/configuracoes");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await human.humanClick(page.getByRole("button", { name: /^descontos$/i }));
    await expect(page.getByRole("heading", { name: /desconto por forma de pagamento/i })).toBeVisible({
      timeout: 20_000,
    });

    await human.humanClick(page.getByRole("combobox").first());
    await human.humanClick(page.getByRole("option", { name: /^dinheiro$/i }));
    await human.humanType(page.getByPlaceholder("Desconto"), "5");
    const saved = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.request().method() === "POST" &&
        res.ok(),
      { timeout: 30_000 }
    );
    await human.hesitate(300, 600);
    await human.humanClick(page.getByRole("button", { name: /^adicionar$/i }));
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByText(/normalizePosSettings is not defined/i)).toHaveCount(0);
    await expect(page.getByText("5%").first()).toBeVisible({ timeout: 15_000 });

    await human.humanNavigate("/pdv");
    await expect(page.getByRole("heading", { name: /^resumo$/i })).toBeVisible({ timeout: 45_000 });
    const productBtn = page.locator("ul.divide-y li button").first();
    await expect(productBtn).toBeVisible({ timeout: 20_000 });
    await human.humanClick(productBtn);
    await human.humanClick(page.getByRole("combobox").filter({ hasText: /adicione uma ou mais formas/i }));
    await human.humanClick(page.getByRole("option", { name: /^cheque$/i }));
    await expect(page.getByText(/11% à vista nesta forma de pagamento/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("PDV — promoção e acréscimo na venda @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }

    await human.humanNavigate("/pdv/configuracoes");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }
    await human.humanClick(page.getByRole("button", { name: /^acréscimos$/i }));
    await expect(page.getByRole("heading", { name: /acréscimo por forma de pagamento/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/^pix$/i).first()).toBeVisible();
    await expect(page.getByText("3%").first()).toBeVisible();
    await expect(page.getByText(/à vista/i).first()).toBeVisible();

    await human.humanClick(page.getByRole("button", { name: /^promoções$/i }));
    await expect(page.getByRole("heading", { name: /^promoções$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /nova promoção/i })).toBeVisible();
    await expect(page.getByText(/dia dos pais/i)).toBeVisible();
    await human.humanClick(page.getByRole("button", { name: /nova promoção/i }));
    await expect(page.getByText(/^nome$/i)).toBeVisible();
    await expect(page.getByText(/^validade$/i)).toBeVisible();
    await expect(page.getByText(/desconto \(%\)/i)).toBeVisible();
    await expect(page.getByText(/categorias de produtos/i)).toBeVisible();
    await human.humanClick(page.getByRole("button", { name: /^cancelar$/i }));

    await human.humanNavigate("/pdv");
    await expect(page.getByRole("heading", { name: /^resumo$/i })).toBeVisible({ timeout: 45_000 });
    const productBtn = page.locator("ul.divide-y li button").first();
    await expect(productBtn).toBeVisible({ timeout: 20_000 });
    await human.humanClick(productBtn);
    await human.humanClick(page.getByRole("combobox").filter({ hasText: /nenhuma/i }));
    await human.humanClick(page.getByRole("option", { name: /dia dos pais/i }));
    await expect(page.getByText(/10%/)).toBeVisible();
    await human.humanClick(page.getByRole("combobox").filter({ hasText: /adicione uma ou mais formas/i }));
    await human.humanClick(page.getByRole("option", { name: /^pix$/i }));
    await expect(page.getByText(/acréscimo de 3%/i)).toBeVisible({ timeout: 10_000 });
  });

  test("PDV histórico — caixa consolidado @human-behavior @pdv", async ({ page }) => {
    const human = new HumanBehavior(page);
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }

    await human.humanNavigate("/pdv/historico");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }

    await expect(page.getByRole("heading", { name: /histórico de vendas/i })).toBeVisible({
      timeout: 45_000,
    });

    await human.randomDelay(400, 800);
    await human.humanClick(page.getByRole("button", { name: /^caixa$/i }));
    await expect(page.getByRole("menuitem", { name: /abrir\/fechar caixa/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /caixa consolidado/i })).toBeVisible();

    const opened = page.waitForResponse(
      (res) =>
        res.url().includes("/functions/v1/pos-sales") &&
        res.url().includes("cash_consolidated") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );
    await human.humanClick(page.getByRole("menuitem", { name: /caixa consolidado/i }));

    const openRes = await opened;
    expect(openRes.ok()).toBeTruthy();
    const openBody = await openRes.json();
    expect(Array.isArray(openBody.data?.payments)).toBeTruthy();
    expect(Array.isArray(openBody.data?.products_by_category)).toBeTruthy();
    expect(Array.isArray(openBody.data?.services_by_category)).toBeTruthy();
    expect(Array.isArray(openBody.data?.other_entries)).toBeTruthy();

    const dialog = page.getByRole("dialog", { name: /caixa consolidado/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/formas de pagamento/i)).toBeVisible();
    await expect(dialog.getByText(/vendas de produtos por categoria/i)).toBeVisible();
    await expect(dialog.getByText(/vendas de serviços por categoria/i)).toBeVisible();
    await expect(dialog.getByText(/outras entradas/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^consultar$/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^exportar$/i })).toBeVisible();

    await human.humanClick(dialog.getByRole("combobox"));
    await human.randomDelay(200, 400);
    await human.humanClick(page.getByRole("option", { name: /manhã/i }));

    const morning = page.waitForResponse(
      (res) =>
        res.url().includes("cash_consolidated") &&
        res.url().includes("day_period=morning") &&
        res.request().method() === "GET",
      { timeout: 45_000 }
    );
    await human.hesitate(300, 600);
    await human.humanClick(dialog.getByRole("button", { name: /^consultar$/i }));
    const morningRes = await morning;
    expect(morningRes.ok()).toBeTruthy();
    const morningBody = await morningRes.json();
    expect(Array.isArray(morningBody.data?.payments)).toBeTruthy();
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
    const orgId = process.env.E2E_ORG_ID?.trim();
    if (orgId) {
      await page.addInitScript((id) => {
        localStorage.setItem("active_organization_id", id);
      }, orgId);
    }

    await human.humanNavigate("/pdv/historico");
    if (page.url().includes("/login")) {
      test.skip(true, "Sessão E2E inválida");
    }

    await expect(
      page.getByRole("heading", { name: /histórico de vendas/i })
    ).toBeVisible({ timeout: 45_000 });

    const emptyCell = page.getByRole("cell", { name: /nenhuma venda encontrada/i });
    const dataRow = page
      .locator("table tbody tr")
      .filter({ hasNotText: /nenhuma venda encontrada/i })
      .first();

    await expect(dataRow.or(emptyCell)).toBeVisible({ timeout: 45_000 });
    test.skip(
      await emptyCell.isVisible().catch(() => false),
      "Sem vendas no período para abrir comprovante"
    );

    await human.randomDelay(400, 800);
    // Clica na célula do código (evita áreas com scroll interno)
    await human.humanClick(dataRow.locator("td").first());

    await expect(
      page.locator("span").filter({ hasText: /^Comprovante de venda$/i })
    ).toBeVisible({ timeout: 20_000 });
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
