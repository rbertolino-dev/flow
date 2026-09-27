import { expect, test, type APIRequestContext, type APIResponse, type Response } from "@playwright/test";
import { HumanBehavior } from "../helpers/human-behavior";
import { hasE2ECredentials } from "../helpers/auth";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";

/**
 * Isolamento, integridade e rastreio do estoque entre empresas.
 * A conta E2E pertence a uma empresa. A outra é um UUID do qual ela não é membro.
 * Tags: @human-behavior @estoque
 */
test.describe("Estoque — isolamento entre empresas @human-behavior @estoque", () => {
  test.describe.configure({ retries: 0 });

  test.beforeEach(() => {
    loadE2eEnvSecure();
    test.skip(!hasE2ECredentials(), "Credenciais E2E ausentes (.env.e2e.local)");
  });

  test("separa o cadastro, não repete a baixa e guarda o histórico @human-behavior", async ({ page, request }) => {
    const human = new HumanBehavior(page);
    const stamp = String(Date.now());
    const productName = `E2E isolamento ${stamp}`;
    const sku = `E2EISO${stamp}`;
    const foreignOrgId = "00000000-0000-4000-8000-00000000e2e1";
    let apiBase = "";
    let authorization = "";
    let orgId = "";
    let productId = "";
    let saleId = "";
    let saleCancelled = false;

    try {
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
          !response.url().includes("/budget-stock"),
        { timeout: 30_000 },
      );
      await human.humanClick(dialog.getByRole("button", { name: "Cadastrar produto" }));
      const createdResponse = await created;
      expect(createdResponse.ok(), await responseError(createdResponse)).toBeTruthy();
      const createdBody = await createdResponse.json();
      productId = String(createdBody?.data?.id || "");
      expect(productId, "o cadastro precisa devolver o produto").toBeTruthy();
      expect(createdBody.data.organization_id).toBeTruthy();
      orgId = String(createdResponse.request().headers()["x-organization-id"] || createdBody.data.organization_id);
      authorization = createdResponse.request().headers().authorization || "";
      apiBase = createdResponse.url().split("/functions/v1")[0];
      expect(authorization).toContain("Bearer ");
      await expect(dialog).toBeHidden({ timeout: 15_000 });

      const entry = await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/products/movements", {
        product_id: productId,
        kind: "in",
        quantity: 2,
        notes: "Compra — isolamento",
      });
      expect(entry.status, JSON.stringify(entry.body)).toBe(200);
      expect(Number(asRow(entry.body.data).stock_before)).toBe(0);
      expect(Number(asRow(entry.body.data).stock_after)).toBe(2);

      const movements = await callApi(request, apiBase, authorization, orgId, "GET", "/functions/v1/products/movements?limit=30");
      expect(movements.status).toBe(200);
      const row = asRows(movements.body.data).find((item) => item.product_id === productId);
      expect(row, "a entrada precisa aparecer no histórico da empresa").toBeTruthy();
      expect(row?.source).toBe("purchase");
      expect(Number(row?.stock_before)).toBe(0);
      expect(Number(row?.stock_after)).toBe(2);
      expect(row?.created_by).toBeTruthy();
      expect(row?.organization_id).toBe(orgId);

      const foreignList = await callApi(request, apiBase, authorization, foreignOrgId, "GET", "/functions/v1/products");
      expect(foreignList.status).toBe(403);
      expect(JSON.stringify(foreignList.body)).not.toContain(productId);

      const foreignMove = await callApi(request, apiBase, authorization, foreignOrgId, "POST", "/functions/v1/products/movements", {
        product_id: productId,
        kind: "out",
        quantity: 1,
        notes: "não pode sair",
      });
      expect(foreignMove.status).toBe(403);
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(2);

      const requestId = crypto.randomUUID();
      const saleBody = {
        action: "finalize_sale",
        client_request_id: requestId,
        apply_stock: true,
        generate_financial: false,
        items: [{ item_type: "product", item_id: productId, name: productName, sku, quantity: 1, unit_price: 10 }],
        payments: [{ method: "dinheiro", amount: 10 }],
      };
      const firstSale = await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/pos-sales", saleBody);
      saleId = String(asRow(firstSale.body.data).id || "");
      expect([200, 201]).toContain(firstSale.status);
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(1);

      const replay = await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/pos-sales", saleBody);
      expect(replay.status, JSON.stringify(replay.body)).toBe(200);
      expect(replay.body.idempotent).toBe(true);
      expect(asRow(replay.body.data).id).toBe(saleId);
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(1);

      const cancel = await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/pos-sales", {
        action: "cancel_sale",
        sale_id: saleId,
      });
      expect(cancel.status, JSON.stringify(cancel.body)).toBe(200);
      saleCancelled = true;
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(2);

      const cancelAgain = await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/pos-sales", {
        action: "cancel_sale",
        sale_id: saleId,
      });
      expect(cancelAgain.status).toBe(400);
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(2);

      const audit = await callApi(
        request,
        apiBase,
        authorization,
        orgId,
        "GET",
        `/functions/v1/products/audit?product_id=${productId}`,
      );
      expect(audit.status, JSON.stringify(audit.body)).toBe(200);
      const createdLog = asRows(audit.body.data).find((item) => item.action === "create");
      expect(createdLog, "o cadastro precisa ficar na auditoria").toBeTruthy();
      const afterState = typeof createdLog?.after === "string"
        ? JSON.parse(createdLog.after) as { name?: string }
        : createdLog?.after as { name?: string } | null;
      expect(afterState?.name).toBe(productName);
      expect(createdLog?.before ?? null).toBeNull();

      const removed = await callApi(request, apiBase, authorization, orgId, "DELETE", `/functions/v1/products/${productId}`);
      expect(removed.status).toBe(409);
      expect(String(removed.body.error || "")).toMatch(/inative/i);
      expect(await readStock(request, apiBase, authorization, orgId, productId)).toBe(2);
    } finally {
      if (productId && authorization && apiBase && orgId) {
        if (saleId && !saleCancelled) {
          await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/pos-sales", {
            action: "cancel_sale",
            sale_id: saleId,
          });
        }
        const left = await readStock(request, apiBase, authorization, orgId, productId);
        if (left > 0) {
          await callApi(request, apiBase, authorization, orgId, "POST", "/functions/v1/products/movements", {
            product_id: productId,
            kind: "out",
            quantity: left,
            notes: "Saída — limpeza do teste",
          });
        }
        await callApi(request, apiBase, authorization, orgId, "PUT", `/functions/v1/products/${productId}`, {
          is_active: false,
        });
      }
    }
  });
});

type ApiRow = {
  id?: string;
  product_id?: string;
  organization_id?: string;
  source?: string;
  stock_before?: number;
  stock_after?: number;
  stock_quantity?: number;
  created_by?: string;
  action?: string;
  before?: unknown;
  after?: unknown;
};

async function callApi(
  request: APIRequestContext,
  apiBase: string,
  authorization: string,
  orgId: string,
  method: string,
  path: string,
  body?: unknown,
) {
  const response = await request.fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      "X-Organization-Id": orgId,
    },
    data: body,
  });
  const payload = await response.json().catch(() => ({}));
  return {
    status: response.status(),
    body: payload as { data?: unknown; error?: string; idempotent?: boolean },
  };
}

async function readStock(
  request: APIRequestContext,
  apiBase: string,
  authorization: string,
  orgId: string,
  productId: string,
) {
  const listed = await callApi(request, apiBase, authorization, orgId, "GET", "/functions/v1/products");
  const rows = asRows(listed.body.data);
  const product = rows.find((item) => item.id === productId);
  return Number(product?.stock_quantity ?? NaN);
}

function asRows(data: unknown): ApiRow[] {
  return Array.isArray(data) ? data : [];
}

function asRow(data: unknown): ApiRow {
  return data && typeof data === "object" && !Array.isArray(data) ? data as ApiRow : {};
}

async function responseError(response: Response | APIResponse) {
  const body = await response.text().catch(() => "");
  return `HTTP ${response.status()} ${body.slice(0, 300)}`;
}
