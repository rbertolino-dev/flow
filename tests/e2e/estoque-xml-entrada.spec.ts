import { readFileSync } from "fs";
import { expect, test, type Page, type Response } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Entrada por XML: exclui itens da nota, cadastra o que falta e só então lança o estoque.
 * O arquivo de exemplo segue a NF-1635 enviada (cinco itens). Os nomes ganham um sufixo
 * único para o cadastro não esbarrar num produto que já existe.
 * Tags: @human-behavior @estoque
 */
test.describe("Estoque — entrada por XML @human-behavior @estoque", () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("cadastra o item que falta, ignora os demais e lança só o que ficou @human-behavior", async ({ page }) => {
    const human = new HumanBehavior(page);
    const stamp = String(Date.now());
    const keptName = `E2E XML Camiseta tricot slim premium ${stamp}`;
    const droppedNames = [
      `E2E XML Camiseta polo texturizada ${stamp}`,
      `E2E XML Calca jeans ${stamp}`,
      `E2E XML Blusa moletom ${stamp}`,
      `E2E XML Camisa linho ${stamp}`,
    ];
    const xml = readFileSync("tests/fixtures/NF-1635-3.xml", "utf8")
      .replaceAll("E2EXML", `E2EXML${stamp}`)
      .replaceAll("premium", `premium ${stamp}`)
      .replaceAll("texturizada", `texturizada ${stamp}`)
      .replaceAll("jeans", `jeans ${stamp}`)
      .replaceAll("moletom", `moletom ${stamp}`)
      .replaceAll("linho", `linho ${stamp}`);
    let stockPosted = false;

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
      await human.humanClick(page.getByRole("button", { name: "Lançamentos" }));
      await human.humanClick(page.getByRole("button", { name: "Novo lançamento" }));
      await human.humanClick(page.getByRole("menuitem", { name: "Entrada por XML" }));

      const xmlDialog = page.getByRole("dialog", { name: /dar entrada em produtos usando xml/i });
      await expect(xmlDialog).toBeVisible();
      await xmlDialog.locator('input[type="file"]').setInputFiles({
        name: "NF-1635-3.xml",
        mimeType: "text/xml",
        buffer: Buffer.from(xml),
      });
      await expect(xmlDialog.getByRole("button", { name: "NF-1635-3.xml" })).toBeVisible();
      await human.hesitate(300, 700);
      await human.humanClick(xmlDialog.getByRole("button", { name: "Abrir XML" }));

      await expect(xmlDialog.getByText(keptName)).toBeVisible();
      for (const name of droppedNames) {
        await expect(xmlDialog.getByText(name)).toBeVisible();
      }
      await expect(xmlDialog.getByRole("button", { name: "Não lançar" })).toHaveCount(5);

      for (const name of droppedNames) {
        const card = xmlDialog.locator("div.rounded-md.border").filter({ hasText: name }).first();
        await human.humanClick(card.getByRole("button", { name: "Não lançar" }));
        await expect(xmlDialog.getByText(name)).toHaveCount(0);
      }
      await expect(xmlDialog.getByRole("button", { name: "Não lançar" })).toHaveCount(1);
      await expect(xmlDialog.getByText(keptName)).toBeVisible();

      await human.humanClick(xmlDialog.getByRole("button", { name: "Cadastrar produto" }));
      const createDialog = page.getByRole("dialog", { name: "Cadastrar produto" });
      await expect(createDialog).toBeVisible();
      await expect(createDialog.locator("#product-nome-do-produto")).toHaveValue(keptName);
      await expect(createDialog.locator("#product-quantidade-atual")).toHaveValue("0");
      await expect(createDialog.locator("#product-quantidade-atual")).toBeDisabled();

      await human.humanFill(createDialog.locator("#product-preco-de-venda"), "25");
      await human.humanFill(createDialog.locator("#product-limite-ideal"), "5");
      await human.humanFill(createDialog.locator("#product-limite-de-falta"), "1");
      await human.hesitate(400, 800);

      const created = page.waitForResponse(
        (response) =>
          response.url().includes("/functions/v1/products") &&
          response.request().method() === "POST" &&
          !response.url().includes("/movements"),
        { timeout: 30_000 },
      );
      await human.humanClick(createDialog.getByRole("button", { name: "Cadastrar produto" }));
      const createdResponse = await created;
      expect(createdResponse.ok(), await responseError(createdResponse)).toBeTruthy();
      const createdBody = await createdResponse.json();
      expect(createdBody?.data?.id, "o cadastro precisa devolver o produto").toBeTruthy();

      await expect(createDialog).toBeHidden({ timeout: 15_000 });
      await expect(xmlDialog).toBeVisible();
      await expect(xmlDialog.getByText("Produto vinculado")).toBeVisible();
      await expect(xmlDialog.getByText(keptName).first()).toBeVisible();

      const movement = page.waitForResponse(
        (response) =>
          response.url().includes("/functions/v1/products/movements") &&
          response.request().method() === "POST",
        { timeout: 30_000 },
      );
      const postsBeforeSkip = financePosts.length;
      await human.hesitate(300, 700);
      await human.humanClick(xmlDialog.getByRole("button", { name: "FINALIZAR" }));
      const movementResponse = await movement;
      expect(movementResponse.ok(), await responseError(movementResponse)).toBeTruthy();
      const movementBody = movementResponse.request().postDataJSON() as { product_id?: string; quantity?: number };
      expect(movementBody.product_id).toBe(createdBody.data.id);
      expect(movementBody.quantity).toBe(1);
      stockPosted = true;

      const expense = page.getByRole("dialog", { name: /gerar conta a pagar/i });
      await expect(expense).toBeVisible({ timeout: 15_000 });
      await expect(expense.locator("input").nth(1)).toHaveValue("10,00");
      await human.humanClick(expense.getByRole("button", { name: /agora não/i }));
      await expect(expense).toBeHidden({ timeout: 10_000 });
      expect(financePosts.length, "pular a despesa não pode criar conta a pagar").toBe(postsBeforeSkip);
      await expect(page.getByText("Entrada por XML registrada", { exact: true })).toBeVisible();
    } finally {
      if (stockPosted) {
        await reverseStock(page, human, keptName, "1");
      }
    }
  });
});

async function reverseStock(page: Page, human: HumanBehavior, productName: string, quantity: string) {
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Lançamentos" }).click();
  const dialog = page.getByRole("dialog", { name: "Lançamento único" });
  if (!(await dialog.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Novo lançamento" }).click();
    await page.getByRole("menuitem", { name: "Lançamento único" }).click();
  }
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await human.humanClick(dialog.getByRole("combobox").first());
  await human.humanClick(page.getByRole("option", { name: productName, exact: true }));
  await human.humanClick(dialog.getByRole("combobox").nth(1));
  await human.humanClick(page.getByRole("option", { name: "Saída", exact: true }));
  await human.humanFill(dialog.locator('input[type="number"]'), quantity);
  const movement = page.waitForResponse(
    (response) =>
      response.url().includes("/functions/v1/products/movements") &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await human.humanClick(dialog.getByRole("button", { name: "Lançar" }));
  const saved = await movement;
  expect(saved.ok(), await responseError(saved)).toBeTruthy();
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => "");
  return `HTTP ${response.status()} ${body.slice(0, 300)}`;
}
