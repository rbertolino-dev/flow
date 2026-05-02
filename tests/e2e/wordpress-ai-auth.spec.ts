import { test, expect } from "@playwright/test";

/**
 * Valida o contrato da edge `wordpress-ai-content` com o gateway Supabase (ou proxy).
 * Sem JWT: deve recusar autenticação.
 *
 * Executar com variáveis do projeto (ex.: do .env):
 *   export VITE_SUPABASE_URL="https://..."
 *   export VITE_SUPABASE_PUBLISHABLE_KEY="eyJ..."
 *   npx playwright test tests/e2e/wordpress-ai-auth.spec.ts --project=chromium
 */
test.describe("WordPress IA – autenticação da edge function", () => {
  test("pedido sem Bearer deve falhar com Não autenticado", async ({ request }) => {
    const base = (
      process.env.VITE_SUPABASE_URL ||
      process.env.PLAYWRIGHT_SUPABASE_URL ||
      ""
    ).replace(/\/$/, "");
    const anon =
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ||
      "";

    test.skip(!base || !anon, "Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente.");

    const url = `${base}/functions/v1/wordpress-ai-content`;
    const res = await request.post(url, {
      headers: {
        apikey: anon,
        "Content-Type": "application/json",
      },
      data: {
        action: "publish",
        organization_id: "00000000-0000-0000-0000-000000000001",
        title: "E2E",
        content: "<p>teste</p>",
      },
    });

    const status = res.status();
    const body = (await res.json().catch(() => ({}))) as { error?: string };

    if (status === 401) {
      if (body.error !== undefined) {
        expect(String(body.error)).toMatch(/autenticado|unauthorized/i);
      }
      return;
    }

    expect(
      status,
      `Esperado 401 ou 200+erro JSON; recebido ${status} body=${JSON.stringify(body)}`,
    ).toBe(200);
    expect(String(body.error || "")).toMatch(/Não autenticado|autenticado|Unauthorized/i);
  });
});
