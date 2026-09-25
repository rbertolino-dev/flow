import { expect, test, type Page, type Response } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Entrada de estoque com conta a pagar opcional.
 * Roda no app publicado (playwright.deployed.config.ts) com a conta E2E da Pubdigital.
 * Tags: @human-behavior @estoque
 */
test.describe("Estoque — despesa opcional na entrada @human-behavior @estoque", () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("oferece conta a pagar editável e só grava se o usuário confirmar @human-behavior", async ({ page }) => {
    const human = new HumanBehavior(page);
    const orgId = process.env.E2E_ORG_ID?.trim() || "";
    const marker = `E2E estoque ${Date.now()}`;
    const today = new Date().toLocaleDateString("pt-BR");
    let productName = "";
    let entriesPosted = 0;
    let financeEntryId = "";
    let financeAuth: { url: string; apikey: string; authorization: string } | null = null;

    const financePosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/rest/v1/rpc/upsert_financial_entry")) {
        financePosts.push(request.url());
      }
    });

    try {
      await human.humanNavigate("/estoque");
      if (page.url().includes("/login")) {
        test.skip(true, "Sessão E2E inválida — rode auth.setup");
      }

      await expect(page.getByRole("heading", { name: "Estoque" })).toBeVisible({ timeout: 45_000 });
      productName = await waitForProductName(page);
      await human.humanClick(page.getByRole("button", { name: "Lançamentos" }));
      const section = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Lançamentos de estoque" }),
      });
      await expect(section).toBeVisible();
      await selectProduct(human, page, section, productName);

      await postEntry(human, page, section, "1");
      entriesPosted += 1;

      const dialog = page.getByRole("dialog", { name: /gerar conta a pagar/i });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await expect(dialog.getByText(/a despesa é opcional/i)).toBeVisible();

      const description = dialog.locator("input").first();
      const amount = dialog.locator("input").nth(1);
      await expect(description).toHaveValue(`${productName} ${today} 1`);
      await expect(dialog.getByText(/você pode alterar antes de registrar/i)).toBeVisible();

      const postsBeforeSkip = financePosts.length;
      await human.humanClick(dialog.getByRole("button", { name: /agora não/i }));
      await expect(dialog).toBeHidden({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      expect(financePosts.length, "Pular a despesa não pode criar conta a pagar").toBe(postsBeforeSkip);

      await postEntry(human, page, section, "1");
      entriesPosted += 1;
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await expect(description).toHaveValue(`${productName} ${today} 1`);

      await human.humanFill(description, marker);
      await human.humanFill(amount, "0,01");
      await human.hesitate(400, 800);

      const financeResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/upsert_financial_entry") &&
          response.request().method() === "POST",
        { timeout: 30_000 }
      );
      await human.humanClick(dialog.getByRole("button", { name: /registrar despesa/i }));
      const saved = await financeResponse;
      expect(saved.ok(), await responseError(saved)).toBeTruthy();
      financeEntryId = String(await saved.json()).replaceAll('"', "");
      expect(financeEntryId).toMatch(/^[0-9a-f-]{36}$/i);
      financeAuth = {
        url: saved.url(),
        apikey: saved.request().headers().apikey || "",
        authorization: saved.request().headers().authorization || "",
      };
      await expect(page.getByText("Conta a pagar criada", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toBeHidden();

      await human.humanNavigate("/financeiro/pagar");
      await expect(page.getByRole("heading", { name: "Contas a pagar" })).toBeVisible({ timeout: 45_000 });
      const search = page.getByPlaceholder("Descrição");
      await human.humanFill(search, marker);
      await human.humanClick(page.getByRole("button", { name: /pesquisar/i }));
      const row = page.getByRole("row").filter({ hasText: marker });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText("Estoque");
      await expect(row).toContainText("Fornecedores");
      const cancel = row.getByTitle("Cancelar");
      const cancelResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/rest/v1/rpc/set_financial_entry_status") &&
          response.request().method() === "POST",
        { timeout: 30_000 }
      );
      await cancel.evaluate((element) => (element as HTMLButtonElement).click());
      const cancelled = await cancelResponse;
      expect(cancelled.ok(), await responseError(cancelled)).toBeTruthy();
      await expect(row).toBeHidden({ timeout: 15_000 });
      financeEntryId = "";
    } finally {
      if (financeEntryId && financeAuth && orgId) {
        await cancelFinanceEntry(page, financeAuth, orgId, financeEntryId);
      }
      if (productName && entriesPosted > 0) {
        await reverseStock(page, human, productName, String(entriesPosted));
      }
    }
  });
});

async function waitForProductName(page: Page) {
  const total = page.getByText(/Total de produtos:/);
  await expect.poll(async () => {
    if (await page.getByText("Carregando produtos").isVisible().catch(() => false)) return 0;
    const label = (await total.textContent().catch(() => "")) || "";
    return Number(label.replace(/[^\d]/g, "")) || 0;
  }, { timeout: 45_000, message: "Produtos da Pubdigital não terminaram de carregar" }).toBeGreaterThan(0);

  const cell = (await page.locator("table tbody tr").first().locator("td").first().innerText()).trim();
  const name = cell.split("\n")[0]?.trim() || "";
  expect(name, "Primeiro produto do cadastro sem nome").not.toBe("");
  return name;
}

async function openSingleEntry(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Lançamento único" });
  if (await dialog.isVisible().catch(() => false)) return dialog;
  await page.getByRole("button", { name: "Novo lançamento" }).click();
  await page.getByRole("menuitem", { name: "Lançamento único" }).click();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectProduct(
  human: HumanBehavior,
  page: Page,
  _section: ReturnType<Page["locator"]>,
  productName: string
) {
  const dialog = await openSingleEntry(page);
  await human.humanClick(dialog.getByRole("combobox").first());
  const option = page.getByRole("option", { name: productName, exact: true });
  await expect(option).toBeVisible({ timeout: 15_000 });
  await human.humanClick(option);
}

async function postEntry(
  human: HumanBehavior,
  page: Page,
  _section: ReturnType<Page["locator"]>,
  quantity: string
) {
  const dialog = await openSingleEntry(page);
  await expect(dialog.getByRole("combobox").nth(1)).toContainText("Entrada");
  await human.humanFill(dialog.locator('input[type="number"]'), quantity);
  const movement = page.waitForResponse(
    (response) =>
      response.url().includes("/functions/v1/products/movements") &&
      response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await human.hesitate(300, 700);
  await human.humanClick(dialog.getByRole("button", { name: "Lançar" }));
  const saved = await movement;
  expect(saved.ok(), await responseError(saved)).toBeTruthy();
}

async function reverseStock(page: Page, human: HumanBehavior, productName: string, quantity: string) {
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Lançamentos" }).click();
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Lançamentos de estoque" }),
  });
  await expect(section).toBeVisible({ timeout: 30_000 });
  const dialog = await openSingleEntry(page);
  await dialog.getByRole("combobox").first().click();
  await page.getByRole("option", { name: productName, exact: true }).click();
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Saída", exact: true }).click();
  await dialog.locator('input[type="number"]').fill(quantity);
  const movement = page.waitForResponse(
    (response) =>
      response.url().includes("/functions/v1/products/movements") &&
      response.request().method() === "POST",
    { timeout: 30_000 }
  );
  await dialog.getByRole("button", { name: "Lançar" }).click();
  const saved = await movement;
  expect(saved.ok(), await responseError(saved)).toBeTruthy();
}

async function cancelFinanceEntry(
  page: Page,
  auth: { url: string; apikey: string; authorization: string },
  orgId: string,
  entryId: string
) {
  const endpoint = auth.url.replace("upsert_financial_entry", "set_financial_entry_status");
  const response = await page.request.post(endpoint, {
    headers: {
      apikey: auth.apikey,
      authorization: auth.authorization,
      "content-type": "application/json",
    },
    data: {
      p_organization_id: orgId,
      p_entry_id: entryId,
      p_status: "cancelled",
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => "");
  return `HTTP ${response.status()} ${body.slice(0, 300)}`;
}
