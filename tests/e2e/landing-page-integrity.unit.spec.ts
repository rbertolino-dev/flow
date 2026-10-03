import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import {
  publicLandingPayloadIssues,
  resolveLandingPageAccess,
  slugifyLandingPage,
} from "../../src/lib/landingPageAccess";
import { buildLandingPagePreview, landingPageChecklist, productInStock } from "../../src/lib/landingPagePreview";
import { buildLandingCartItemText, buildLandingCartMessage } from "../../src/lib/landingPageCart";
import { filterLandingItems, sortLandingItems } from "../../src/lib/landingPageCatalogFilters";
import type { LandingPageConfig } from "../../src/types/landing-page";

test("mensagem do carrinho lista todos os itens no lugar de {item}", () => {
  const item = buildLandingCartItemText(
    [
      { productId: "a", name: "Detergente", price: 9, quantity: 2 },
      { productId: "b", name: "Esponja", price: 3.5, quantity: 1 },
    ],
    true,
  );
  expect(item).toBe("• 2x Detergente — R$ 18,00\n• 1x Esponja — R$ 3,50");

  const message = buildLandingCartMessage(
    "Olá {empresa}. Quero:\n{item}\n{url_pagina} às {data_hora}",
    { empresa: "Loja", item, url: "https://loja.test/p/loja", dataHora: "01/10/2026" },
  );
  expect(message).toContain("• 2x Detergente — R$ 18,00");
  expect(message).toContain("• 1x Esponja — R$ 3,50");
  expect(message).not.toContain("{item}");

  const withoutPlaceholder = buildLandingCartMessage("Olá {empresa}", {
    empresa: "Loja",
    item,
    url: "https://loja.test/p/loja",
    dataHora: "01/10/2026",
  });
  expect(withoutPlaceholder).toContain("Olá Loja");
  expect(withoutPlaceholder).toContain("• 2x Detergente");
});

test("ordenação e filtro de categoria da vitrine", () => {
  const items = [
    { id: "1", created_at: "2026-01-02", product: { name: "Detergente", price: 9, category: "Limpeza" } },
    { id: "2", created_at: "2026-03-01", product: { name: "Esponja", price: 3.5, category: "Cozinha" } },
    { id: "3", created_at: "2026-01-01", product: { name: "Balde", price: 12, category: "Limpeza" } },
  ];
  expect(sortLandingItems(items, "alpha").map((item) => item.product.name)).toEqual(["Balde", "Detergente", "Esponja"]);
  expect(sortLandingItems(items, "price-asc").map((item) => item.product.name)).toEqual(["Esponja", "Detergente", "Balde"]);
  expect(sortLandingItems(items, "price-desc").map((item) => item.product.name)).toEqual(["Balde", "Detergente", "Esponja"]);
  expect(sortLandingItems(items, "newest").map((item) => item.id)).toEqual(["2", "1", "3"]);
  expect(sortLandingItems(items, "oldest").map((item) => item.id)).toEqual(["3", "1", "2"]);
  expect(filterLandingItems(items, "Cozinha", "").map((item) => item.id)).toEqual(["2"]);
  expect(filterLandingItems(items, null, "balde").map((item) => item.id)).toEqual(["3"]);
});

function draftConfig(overrides: Partial<LandingPageConfig> = {}): LandingPageConfig {
  return {
    title: "Loja",
    slug: "loja",
    template: "modern",
    showAllItems: false,
    selectedProductIds: [],
    itemOrder: "manual",
    showPrice: true,
    whatsappEnabled: true,
    whatsappFloatingButton: true,
    whatsappButtonText: "Pedir",
    formEnabled: false,
    footerEnabled: true,
    ...overrides,
  };
}

function supabaseEnv(): { url: string; key: string } | null {
  const file = join(process.cwd(), ".env");
  let url = process.env.VITE_SUPABASE_URL || "";
  let key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const name = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (name === "VITE_SUPABASE_URL" && !url) url = value;
      if (name === "VITE_SUPABASE_PUBLISHABLE_KEY" && !key) key = value;
    }
  } catch {
    // ambiente sem .env
  }
  if (!url || !key) return null;
  return { url, key };
}

test("endereço da landing page fica único e legível @human-behavior", () => {
  expect(slugifyLandingPage("Minha Empresa!")).toBe("minha-empresa");
  expect(slugifyLandingPage("Ação & Pós-Venda")).toBe("acao-pos-venda");
  expect(slugifyLandingPage("***")).toBe("landing-page");
});

test("acesso segue feature, admin e permissão de leitura", () => {
  const base = {
    featuresLoading: false,
    permsLoading: false,
    roleLoading: false,
    isPlatformAdmin: false,
    hasFeature: true,
    isOrgAdmin: false,
    hasSavedPermissions: true,
    canView: true,
  };
  expect(resolveLandingPageAccess({ ...base, featuresLoading: true })).toBe("loading");
  expect(resolveLandingPageAccess({ ...base, isPlatformAdmin: true, hasFeature: false })).toBe("allow");
  expect(resolveLandingPageAccess({ ...base, hasFeature: false })).toBe("deny");
  expect(resolveLandingPageAccess({ ...base, isOrgAdmin: true, canView: false })).toBe("allow");
  expect(resolveLandingPageAccess({ ...base, hasSavedPermissions: false, canView: false })).toBe("allow");
  expect(resolveLandingPageAccess({ ...base, canView: false })).toBe("deny");
});

test("prévia da landing usa só o catálogo da organização @human-behavior", () => {
  expect(productInStock(0)).toBe(false);
  expect(productInStock(2)).toBe(true);
  expect(productInStock(null)).toBe(false);

  const products = [
    { id: "a", organization_id: "org", name: "Ativo", price: 10, category: "B", is_active: true, stock_quantity: 2, created_at: "2026-01-02" },
    { id: "b", organization_id: "org", name: "Esgotado", price: 5, category: "A", is_active: true, stock_quantity: 0, created_at: "2026-01-03" },
    { id: "c", organization_id: "org", name: "Insumo", price: 1, is_active: true, is_supply: true, stock_quantity: 9 },
    { id: "d", organization_id: "outra", name: "Alheio", price: 1, is_active: true, stock_quantity: 4 },
  ];
  const preview = buildLandingPagePreview({
    config: draftConfig({ showAllItems: false, itemOrder: "manual", selectedProductIds: ["b", "a"] }),
    products,
    items: [
      { id: "i2", landing_page_id: "p", product_id: "b", display_order: 0, custom_title: "Oferta", is_visible: true, created_at: "", updated_at: "" },
      { id: "i1", landing_page_id: "p", product_id: "a", display_order: 1, custom_title: "Nome da página", is_visible: true, created_at: "", updated_at: "" },
    ],
    organization: { id: "org", name: "Empresa" },
  });
  expect(preview.items.map((item) => item.product_id)).toEqual(["b", "a"]);
  expect(preview.items[0].custom_title).toBe("Oferta");
  expect(preview.items[0].product.in_stock).toBe(false);
  expect(preview.items[1].product.in_stock).toBe(true);

  const all = buildLandingPagePreview({
    config: draftConfig({ showAllItems: true, itemOrder: "category" }),
    products,
    items: [],
    organization: { id: "org", name: "Empresa" },
  });
  expect(all.items.map((item) => item.product.name)).toEqual(["Esgotado", "Ativo"]);
  expect(all.items.every((item) => item.custom_title == null)).toBe(true);

  const checks = landingPageChecklist({
    config: draftConfig({ title: "", slug: "", whatsappEnabled: true, showAllItems: false }),
    selectedCount: 0,
    isActive: false,
  });
  expect(checks.find((item) => item.id === "title")?.done).toBe(false);
  expect(checks.find((item) => item.id === "catalog")?.done).toBe(false);
  expect(checks.find((item) => item.id === "whatsapp")?.done).toBe(false);
  expect(landingPageChecklist({
    config: draftConfig({ whatsappNumber: "5511999999999", showAllItems: true }),
    selectedCount: 0,
    isActive: true,
  }).every((item) => item.done)).toBe(true);
});

test("vitrine pública não devolve custo, saldo nem dados internos @human-behavior", async ({ request }) => {
  const env = supabaseEnv();
  test.skip(!env, "Sem URL do Supabase neste ambiente");
  const headers = { apikey: env!.key, Authorization: `Bearer ${env!.key}` };

  const missing = await request.get(`${env!.url}/functions/v1/public-landing-page`, { headers });
  expect(missing.status()).toBe(400);

  const unknown = await request.get(`${env!.url}/functions/v1/public-landing-page?slug=slug-que-nao-existe`, { headers });
  expect(unknown.status()).toBe(404);

  const live = await request.get(`${env!.url}/functions/v1/public-landing-page?slug=teste`, { headers });
  test.skip(live.status() === 404, "Página de teste não está publicada");
  expect(live.ok()).toBeTruthy();
  const payload = await live.json();
  expect(publicLandingPayloadIssues(payload)).toEqual([]);
  expect(payload.organization?.id).toBeTruthy();
  expect(Array.isArray(payload.items)).toBeTruthy();

  const anonPages = await request.get(
    `${env!.url}/rest/v1/landing_pages?select=id,form_notification_email,whatsapp_instance_id&is_active=eq.true`,
    { headers },
  );
  expect(anonPages.ok()).toBeTruthy();
  expect(await anonPages.json()).toEqual([]);

  const foreignProduct = await request.post(`${env!.url}/functions/v1/submit-landing-page-form`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: {
      landing_page_id: payload.id,
      organization_id: payload.organization_id,
      name: "Teste automatizado",
      phone: "11999990000",
      product_id: "11111111-1111-1111-1111-111111111111",
      form_destination: "email",
    },
  });
  expect(foreignProduct.status()).toBe(400);

  const wrongOrg = await request.post(`${env!.url}/functions/v1/submit-landing-page-form`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: {
      landing_page_id: payload.id,
      organization_id: "00000000-0000-0000-0000-000000000099",
      name: "Teste",
      phone: "11999990000",
    },
  });
  expect(wrongOrg.status()).toBe(404);

  const anonInsert = await request.post(`${env!.url}/rest/v1/landing_page_leads`, {
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    data: {
      landing_page_id: payload.id,
      organization_id: payload.organization_id,
      name: "Invasor",
      phone: "11999990000",
    },
  });
  expect(anonInsert.ok()).toBeFalsy();
});
