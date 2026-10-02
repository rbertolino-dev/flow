import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";
import {
  publicLandingPayloadIssues,
  resolveLandingPageAccess,
  slugifyLandingPage,
} from "../../src/lib/landingPageAccess";

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
