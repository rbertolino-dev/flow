import { expect, test, type APIRequestContext, type APIResponse, type Page, type Response } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Livro de estoque e rastro da baixa: PDV, orçamento e ordem de serviço.
 * Tags: @human-behavior @estoque
 */
test.describe("Estoque — integridade e rastro da baixa @human-behavior @estoque", () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("encadeia entrada, saída e ajuste no livro @human-behavior", async ({ page, request }) => {
    const ctx = await createDisposableProduct(page, "livro");
    try {
      const entry = await move(request, ctx, { kind: "in", quantity: 10, notes: "compra recebimento" });
      expect(entry.status, JSON.stringify(entry.body)).toBe(200);
      expect(num(asRow(entry.body.data).stock_before)).toBe(0);
      expect(num(asRow(entry.body.data).stock_after)).toBe(10);

      const entryAgain = await move(request, ctx, { kind: "in", quantity: 5, notes: "compra complementar" });
      expect(entryAgain.status, JSON.stringify(entryAgain.body)).toBe(200);
      expect(num(asRow(entryAgain.body.data).stock_after)).toBe(15);

      const exit = await move(request, ctx, { kind: "out", quantity: 3, notes: "consumo interno" });
      expect(exit.status, JSON.stringify(exit.body)).toBe(200);
      expect(num(asRow(exit.body.data).stock_before)).toBe(15);
      expect(num(asRow(exit.body.data).stock_after)).toBe(12);

      const adjust = await move(request, ctx, { kind: "adjust", quantity: 10, notes: "inventario" });
      expect(adjust.status, JSON.stringify(adjust.body)).toBe(200);
      expect(num(asRow(adjust.body.data).stock_after)).toBe(10);
      expect(num(asRow(adjust.body.data).quantity_delta)).toBe(-2);

      const same = await move(request, ctx, { kind: "adjust", quantity: 10, notes: "inventario igual" });
      expect(same.status, JSON.stringify(same.body)).toBe(200);
      expect(asRow(same.body.data).unchanged).toBe(true);
      expect(await readStock(request, ctx)).toBe(10);

      const rows = await movementsOf(request, ctx);
      expect(rows.map((row) => row.source)).toEqual(["purchase", "purchase", "manual", "adjustment"]);
      expect(rows.map((row) => row.movement_type)).toEqual(["in", "in", "out", "adjust"]);
      expect(num(rows[0].stock_before)).toBe(0);
      for (let i = 1; i < rows.length; i += 1) {
        expect(num(rows[i].stock_before), `elo ${i}`).toBe(num(rows[i - 1].stock_after));
      }
      const deltaSum = rows.reduce((sum, row) => sum + num(row.quantity_delta), 0);
      expect(deltaSum).toBe(10);
      expect(num(rows[rows.length - 1].stock_after)).toBe(10);
      for (const row of rows) {
        expect(row.organization_id).toBe(ctx.orgId);
        expect(row.created_by).toBeTruthy();
      }

      const beforeInvalid = await readStock(request, ctx);
      for (const quantity of [0, -1, "abc"]) {
        const invalid = await move(request, ctx, { kind: "in", quantity, notes: "invalida" });
        expect(invalid.status, JSON.stringify(invalid.body)).toBe(400);
      }
      expect(await readStock(request, ctx)).toBe(beforeInvalid);

      const foreign = await callApi(request, ctx, "POST", "/functions/v1/products/movements", {
        product_id: ctx.productId,
        kind: "out",
        quantity: 1,
      }, FOREIGN_ORG);
      expect(foreign.status).toBe(403);
      expect(await readStock(request, ctx)).toBe(beforeInvalid);

      const missing = await callApi(request, ctx, "POST", "/functions/v1/products/movements", {
        product_id: "00000000-0000-4000-8000-00000000e2e2",
        kind: "out",
        quantity: 1,
      });
      expect(missing.status).toBe(404);
      expect(await readStock(request, ctx)).toBe(beforeInvalid);
    } finally {
      await cleanup(request, ctx);
    }
  });

  test("a venda do PDV gera a saída ligada a ela quando a baixa está ligada @human-behavior", async ({ page, request }) => {
    const ctx = await createDisposableProduct(page, "pdv");
    try {
      expect((await move(request, ctx, { kind: "in", quantity: 10, notes: "compra pdv" })).status).toBe(200);

      const sale = await sell(request, ctx, { quantity: 2, applyStock: true, requestId: crypto.randomUUID() });
      expect([200, 201]).toContain(sale.status);
      const saleId = String(asRow(sale.body.data).id || "");
      expect(saleId).toBeTruthy();
      ctx.saleIds.push(saleId);
      expect(await readStock(request, ctx)).toBe(8);

      const saleRows = (await movementsOf(request, ctx)).filter((row) => row.sale_id === saleId && row.movement_type === "sale");
      expect(saleRows).toHaveLength(1);
      expect(saleRows[0].source).toBe("sale");
      expect(num(saleRows[0].quantity_delta)).toBe(-2);
      expect(num(saleRows[0].stock_after)).toBe(8);

      const stockBeforeOptOut = await readStock(request, ctx);
      const saleCountBefore = (await movementsOf(request, ctx)).filter((row) => row.movement_type === "sale").length;
      const optedOut = await sell(request, ctx, { quantity: 1, applyStock: false, requestId: crypto.randomUUID() });
      expect([200, 201]).toContain(optedOut.status);
      const optedOutId = String(asRow(optedOut.body.data).id || "");
      ctx.saleIds.push(optedOutId);
      expect(await readStock(request, ctx)).toBe(stockBeforeOptOut);
      const optedOutMoves = (await movementsOf(request, ctx)).filter((row) => row.sale_id === optedOutId);
      expect(optedOutMoves).toHaveLength(0);
      expect((await movementsOf(request, ctx)).filter((row) => row.movement_type === "sale")).toHaveLength(saleCountBefore);

      const beforeParallel = await readStock(request, ctx);
      const sharedRequest = crypto.randomUUID();
      const [first, second] = await Promise.all([
        sell(request, ctx, { quantity: 1, applyStock: true, requestId: sharedRequest }),
        sell(request, ctx, { quantity: 1, applyStock: true, requestId: sharedRequest }),
      ]);
      for (const result of [first, second]) {
        expect([200, 201], JSON.stringify(result.body)).toContain(result.status);
      }
      const parallelIds = [first, second].map((result) => String(asRow(result.body.data).id || ""));
      expect(new Set(parallelIds).size).toBe(1);
      expect([first, second].filter((result) => result.body.idempotent === true).length).toBeGreaterThan(0);
      const parallelId = parallelIds[0];
      ctx.saleIds.push(parallelId);
      expect(await readStock(request, ctx)).toBe(beforeParallel - 1);
      const parallelSales = (await movementsOf(request, ctx)).filter((row) => row.sale_id === parallelId && row.movement_type === "sale");
      expect(parallelSales).toHaveLength(1);
      expect(num(parallelSales[0].quantity_delta)).toBe(-1);

      const cancel = await callApi(request, ctx, "POST", "/functions/v1/pos-sales", {
        action: "cancel_sale",
        sale_id: parallelId,
      });
      expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
      ctx.cancelled.add(parallelId);
      expect(await readStock(request, ctx)).toBe(beforeParallel);
      const restored = (await movementsOf(request, ctx)).filter((row) => row.sale_id === parallelId && row.movement_type === "sale_cancel");
      expect(restored).toHaveLength(1);
      expect(num(restored[0].quantity_delta)).toBe(1);

      const cancelAgain = await callApi(request, ctx, "POST", "/functions/v1/pos-sales", {
        action: "cancel_sale",
        sale_id: parallelId,
      });
      expect(cancelAgain.status).toBe(400);
      expect(await readStock(request, ctx)).toBe(beforeParallel);
    } finally {
      await cleanup(request, ctx);
    }
  });

  test("o orçamento gera uma saída ligada a ele e a venda do PDV não baixa de novo @human-behavior", async ({ page, request }) => {
    const ctx = await createDisposableProduct(page, "orcamento");
    const budgetId = crypto.randomUUID();
    ctx.budgetId = budgetId;
    try {
      expect((await move(request, ctx, { kind: "in", quantity: 10, notes: "compra orcamento" })).status).toBe(200);

      const apply = await callApi(request, ctx, "POST", "/functions/v1/products/budget-stock", {
        action: "apply",
        budget_id: budgetId,
        items: [{ id: ctx.productId, quantity: 3 }],
      });
      expect(apply.status, JSON.stringify(apply.body)).toBe(200);
      expect(apply.body.posted).toBe(true);
      expect(await readStock(request, ctx)).toBe(7);

      const budgetRows = (await movementsOf(request, ctx)).filter((row) => row.budget_id === budgetId);
      expect(budgetRows).toHaveLength(1);
      expect(budgetRows[0].movement_type).toBe("out");
      expect(budgetRows[0].source).toBe("budget");
      expect(num(budgetRows[0].quantity_delta)).toBe(-3);
      expect(num(budgetRows[0].stock_after)).toBe(7);

      const again = await callApi(request, ctx, "POST", "/functions/v1/products/budget-stock", {
        action: "apply",
        budget_id: budgetId,
        items: [{ id: ctx.productId, quantity: 3 }],
      });
      expect(again.status, JSON.stringify(again.body)).toBe(200);
      expect(again.body.already).toBe(true);
      expect(await readStock(request, ctx)).toBe(7);
      expect((await movementsOf(request, ctx)).filter((row) => row.budget_id === budgetId)).toHaveLength(1);

      const sale = await sell(request, ctx, {
        quantity: 3,
        applyStock: false,
        requestId: `orcamento:${budgetId}`,
        saleOrigin: "orcamento",
      });
      expect([200, 201], JSON.stringify(sale.body)).toContain(sale.status);
      const saleId = String(asRow(sale.body.data).id || "");
      ctx.saleIds.push(saleId);
      expect(await readStock(request, ctx)).toBe(7);
      expect((await movementsOf(request, ctx)).filter((row) => row.sale_id === saleId)).toHaveLength(0);
      expect((await movementsOf(request, ctx)).filter((row) => row.movement_type === "sale")).toHaveLength(0);

      const reverse = await callApi(request, ctx, "POST", "/functions/v1/products/budget-stock", {
        action: "reverse",
        budget_id: budgetId,
      });
      expect(reverse.status, JSON.stringify(reverse.body)).toBe(200);
      ctx.budgetReversed = true;
      expect(await readStock(request, ctx)).toBe(10);
      const afterReverse = (await movementsOf(request, ctx)).filter((row) => row.budget_id === budgetId);
      expect(afterReverse.reduce((sum, row) => sum + num(row.quantity_delta), 0)).toBe(0);

      const reverseAgain = await callApi(request, ctx, "POST", "/functions/v1/products/budget-stock", {
        action: "reverse",
        budget_id: budgetId,
      });
      expect(reverseAgain.status, JSON.stringify(reverseAgain.body)).toBe(200);
      expect(await readStock(request, ctx)).toBe(10);
    } finally {
      await cleanup(request, ctx);
    }
  });

  test("a ordem de serviço gera uma saída ligada a ela e não repete @human-behavior", async ({ page, request }) => {
    const ctx = await createDisposableProduct(page, "os");
    const serviceOrderId = crypto.randomUUID();
    try {
      expect((await move(request, ctx, { kind: "in", quantity: 10, notes: "compra os" })).status).toBe(200);

      const blocked = await callApi(request, ctx, "POST", "/functions/v1/products/service-order-stock", {
        service_order_id: serviceOrderId,
        code: "E2E-OS",
        items: [{ product_id: ctx.productId, quantity: 2 }],
      });
      expect(blocked.status, JSON.stringify(blocked.body)).toBe(400);
      expect(await readStock(request, ctx)).toBe(10);
      expect((await movementsOf(request, ctx)).filter((row) => row.service_order_id === serviceOrderId)).toHaveLength(0);

      const marked = await callApi(request, ctx, "PUT", `/functions/v1/products/${ctx.productId}`, { is_supply: true });
      expect(marked.status, JSON.stringify(marked.body)).toBe(200);

      const synced = await callApi(request, ctx, "POST", "/functions/v1/products/service-order-stock", {
        service_order_id: serviceOrderId,
        code: "E2E-OS",
        items: [{ product_id: ctx.productId, quantity: 2 }],
      });
      expect(synced.status, JSON.stringify(synced.body)).toBe(200);
      expect(synced.body.synced).toBe(true);
      expect(await readStock(request, ctx)).toBe(8);

      const osRows = (await movementsOf(request, ctx)).filter((row) => row.service_order_id === serviceOrderId);
      expect(osRows).toHaveLength(1);
      expect(osRows[0].movement_type).toBe("out");
      expect(osRows[0].source).toBe("service_order");
      expect(num(osRows[0].quantity_delta)).toBe(-2);
      expect(num(osRows[0].stock_after)).toBe(8);
      expect(osRows[0].organization_id).toBe(ctx.orgId);

      const repeated = await callApi(request, ctx, "POST", "/functions/v1/products/service-order-stock", {
        service_order_id: serviceOrderId,
        code: "E2E-OS",
        items: [{ product_id: ctx.productId, quantity: 2 }],
      });
      expect(repeated.status, JSON.stringify(repeated.body)).toBe(200);
      expect(await readStock(request, ctx)).toBe(8);
      expect((await movementsOf(request, ctx)).filter((row) => row.service_order_id === serviceOrderId)).toHaveLength(1);
    } finally {
      await cleanup(request, ctx);
    }
  });
});

const FOREIGN_ORG = "00000000-0000-4000-8000-00000000e2e1";

type Session = {
  apiBase: string;
  authorization: string;
  orgId: string;
  productId: string;
  productName: string;
  sku: string;
  saleIds: string[];
  cancelled: Set<string>;
  budgetId?: string;
  budgetReversed?: boolean;
};

type Movement = {
  product_id?: string;
  organization_id?: string;
  sale_id?: string | null;
  budget_id?: string | null;
  service_order_id?: string | null;
  movement_type?: string;
  source?: string;
  quantity_delta?: number;
  stock_before?: number;
  stock_after?: number;
  created_by?: string;
  created_at?: string;
  unchanged?: boolean;
};

type ApiBody = {
  data?: unknown;
  error?: string;
  idempotent?: boolean;
  posted?: boolean;
  already?: boolean;
  reversed?: boolean;
  synced?: boolean;
};

async function createDisposableProduct(page: Page, label: string): Promise<Session> {
  const human = new HumanBehavior(page);
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const productName = `E2E integridade ${label} ${stamp}`;
  const sku = `E2EINT${label}${stamp}`.slice(0, 40);

  await human.humanNavigate("/estoque");
  if (page.url().includes("/login")) {
    test.skip(true, "Sessão E2E inválida — rode auth.setup");
  }
  await expect(page.getByRole("heading", { name: "Estoque" })).toBeVisible({ timeout: 45_000 });
  await human.humanClick(page.getByRole("button", { name: "Cadastrar produto" }).first());
  const dialog = page.getByRole("dialog", { name: "Cadastrar produto" });
  await expect(dialog).toBeVisible();
  await human.humanType(dialog.locator("#product-nome-do-produto"), productName);
  await human.humanFill(dialog.locator("#product-quantidade-atual"), "0");
  await human.humanFill(dialog.locator("#product-limite-ideal"), "5");
  await human.humanFill(dialog.locator("#product-limite-de-falta"), "1");
  await human.humanFill(dialog.locator("#product-preco-de-venda"), "10");
  await human.humanFill(dialog.locator("#product-custo-unitario"), "4");
  await human.humanType(dialog.locator("#product-codigo-sku"), sku);
  await human.hesitate(400, 900);

  const created = page.waitForResponse(
    (response) =>
      response.url().includes("/functions/v1/products") &&
      response.request().method() === "POST" &&
      !response.url().includes("/movements") &&
      !response.url().includes("/budget-stock") &&
      !response.url().includes("/service-order-stock"),
    { timeout: 30_000 },
  );
  await human.humanClick(dialog.getByRole("button", { name: "Cadastrar produto" }));
  const createdResponse = await created;
  expect(createdResponse.ok(), await responseError(createdResponse)).toBeTruthy();
  const createdBody = await createdResponse.json();
  const productId = String(createdBody?.data?.id || "");
  expect(productId).toBeTruthy();
  const orgId = String(createdResponse.request().headers()["x-organization-id"] || createdBody.data.organization_id);
  const authorization = createdResponse.request().headers().authorization || "";
  expect(authorization).toContain("Bearer ");
  await expect(dialog).toBeHidden({ timeout: 15_000 });

  return {
    apiBase: createdResponse.url().split("/functions/v1")[0],
    authorization,
    orgId,
    productId,
    productName,
    sku,
    saleIds: [],
    cancelled: new Set<string>(),
  };
}

async function move(
  request: APIRequestContext,
  ctx: Session,
  input: { kind: "in" | "out" | "adjust"; quantity: number | string; notes?: string },
) {
  return callApi(request, ctx, "POST", "/functions/v1/products/movements", {
    product_id: ctx.productId,
    kind: input.kind,
    quantity: input.quantity,
    notes: input.notes,
  });
}

async function sell(
  request: APIRequestContext,
  ctx: Session,
  input: { quantity: number; applyStock: boolean; requestId: string; saleOrigin?: string },
) {
  const amount = input.quantity * 10;
  return callApi(request, ctx, "POST", "/functions/v1/pos-sales", {
    action: "finalize_sale",
    client_request_id: input.requestId,
    apply_stock: input.applyStock,
    generate_financial: false,
    sale_origin: input.saleOrigin || "pdv",
    items: [{
      item_type: "product",
      item_id: ctx.productId,
      name: ctx.productName,
      sku: ctx.sku,
      quantity: input.quantity,
      unit_price: 10,
    }],
    payments: [{ method: "dinheiro", amount }],
  });
}

async function movementsOf(request: APIRequestContext, ctx: Session) {
  const listed = await callApi(request, ctx, "GET", "/functions/v1/products/movements?limit=100");
  expect(listed.status, JSON.stringify(listed.body)).toBe(200);
  return asRows(listed.body.data)
    .filter((row) => row.product_id === ctx.productId)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

async function readStock(request: APIRequestContext, ctx: Session) {
  const listed = await callApi(request, ctx, "GET", `/functions/v1/products/${ctx.productId}`);
  expect(listed.status, JSON.stringify(listed.body)).toBe(200);
  return num(asRow(listed.body.data).stock_quantity);
}

async function cleanup(request: APIRequestContext, ctx: Session) {
  for (const saleId of ctx.saleIds) {
    if (ctx.cancelled.has(saleId)) continue;
    await callApi(request, ctx, "POST", "/functions/v1/pos-sales", { action: "cancel_sale", sale_id: saleId });
  }
  if (ctx.budgetId && !ctx.budgetReversed) {
    await callApi(request, ctx, "POST", "/functions/v1/products/budget-stock", {
      action: "reverse",
      budget_id: ctx.budgetId,
    });
  }
  const left = await readStock(request, ctx).catch(() => 0);
  if (left > 0) {
    await callApi(request, ctx, "POST", "/functions/v1/products/movements", {
      product_id: ctx.productId,
      kind: "out",
      quantity: left,
      notes: "limpeza do teste",
    });
  }
  await callApi(request, ctx, "PUT", `/functions/v1/products/${ctx.productId}`, { is_active: false });
}

async function callApi(
  request: APIRequestContext,
  ctx: Session,
  method: string,
  path: string,
  body?: unknown,
  orgId = ctx.orgId,
) {
  const response = await request.fetch(`${ctx.apiBase}${path}`, {
    method,
    headers: {
      Authorization: ctx.authorization,
      "Content-Type": "application/json",
      "X-Organization-Id": orgId,
    },
    data: body,
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status(), body: payload as ApiBody };
}

function asRows(data: unknown): Movement[] {
  return Array.isArray(data) ? data as Movement[] : [];
}

function asRow(data: unknown): Movement & { id?: string; stock_quantity?: number } {
  return data && typeof data === "object" && !Array.isArray(data)
    ? data as Movement & { id?: string; stock_quantity?: number }
    : {};
}

function num(value: unknown) {
  return Number(value);
}

async function responseError(response: Response | APIResponse) {
  const body = await response.text().catch(() => "");
  return `HTTP ${response.status()} ${body.slice(0, 300)}`;
}
