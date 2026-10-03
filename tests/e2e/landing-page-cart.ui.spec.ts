import { test, expect, type Page } from "@playwright/test";

function pagePayload(template: "modern" | "catalog") {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    organization_id: "22222222-2222-2222-2222-222222222222",
    title: "Loja do carrinho",
    slug: "carrinho-teste",
    template,
    is_active: true,
    show_price: true,
    whatsapp_enabled: true,
    whatsapp_floating_button: false,
    whatsapp_number: "5511999990000",
    whatsapp_button_text: "Falar no WhatsApp",
    whatsapp_message_template: "Olá {empresa}. Interesse em {item}.",
    form_enabled: false,
    footer_enabled: false,
    organization: { id: "22222222-2222-2222-2222-222222222222", name: "Loja Teste" },
    items: [
      item("a", "Detergente", 9, true),
      item("b", "Esponja", 3.5, true),
      item("c", "Balde", 12, false),
    ],
  };
}

function item(id: string, name: string, price: number, inStock: boolean) {
  return {
    id: `item-${id}`,
    product_id: id,
    is_visible: true,
    display_order: 0,
    product: {
      id,
      name,
      description: name,
      price,
      category: "Limpeza",
      in_stock: inStock,
      is_active: true,
    },
  };
}

async function openFixture(page: Page, template: "modern" | "catalog") {
  await page.route("**/functions/v1/public-landing-page**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(pagePayload(template)),
    });
  });
  await page.goto("/p/carrinho-teste");
  await expect(page.getByRole("button", { name: "Adicionar ao carrinho" })).toHaveCount(2);
  const box = await page.getByRole("button", { name: "Adicionar ao carrinho" }).first().boundingBox();
  expect(box?.height ?? 99).toBeLessThanOrEqual(36);
  await expect(page.getByText("Esgotado")).toBeVisible();
}

test("carrinho junta os produtos e o Continuar abre o WhatsApp da loja", async ({ page }) => {
  await openFixture(page, "catalog");

  const cards = page.locator("h3", { hasText: "Detergente" }).locator("xpath=ancestor::div[contains(@class,'group')]");
  await cards.getByRole("button", { name: "Adicionar ao carrinho" }).click();
  await cards.getByRole("button", { name: "Aumentar quantidade" }).click();
  await page.locator("h3", { hasText: "Esponja" }).locator("xpath=ancestor::div[contains(@class,'group')]").getByRole("button", { name: "Adicionar ao carrinho" }).click();

  await expect(page.getByText("3 itens")).toBeVisible();
  await expect(page.getByText("R$ 21,50")).toBeVisible();
  await page.getByRole("button", { name: "Ver carrinho" }).click();
  await expect(page.getByRole("heading", { name: /Seu carrinho/ })).toBeVisible();
  await expect(page.getByText("Seu pedido vai ser finalizado no WhatsApp da loja.")).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continuar" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toContain("phone=5511999990000");
  const text = decodeURIComponent(new URL(popup.url()).searchParams.get("text") || "");
  expect(text).toContain("• 2x Detergente — R$ 18,00");
  expect(text).toContain("• 1x Esponja — R$ 3,50");
  expect(text).not.toContain("Balde");
  await popup.close();
});

test("botão geral abre conversa sem a lista do carrinho", async ({ page }) => {
  await openFixture(page, "modern");
  await page.getByRole("button", { name: "Adicionar ao carrinho" }).first().click();

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Falar no WhatsApp" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toContain("phone=5511999990000");
  const text = decodeURIComponent(new URL(popup.url()).searchParams.get("text") || "");
  expect(text).toContain("produto");
  expect(text).not.toContain("Detergente");
  expect(text).not.toContain("•");
  await popup.close();
});
