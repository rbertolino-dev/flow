import { test, expect } from "@playwright/test";
import { hasE2ECredentials, loginAsTestUser } from "../helpers/auth";

test("configuração da landing mostra checklist, contato e rascunho @human-behavior", async ({ page }) => {
  test.skip(!hasE2ECredentials(), "Sem credenciais de teste");
  const loggedIn = await loginAsTestUser(page);
  test.skip(!loggedIn, "Login de teste indisponível");

  await page.goto("/admin/landing-page");
  await expect(page.getByRole("heading", { name: "Landing Page de Vendas" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Para publicar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();
  await expect(page.getByText("Pré-visualização do rascunho")).toBeVisible();

  await expect(page.getByText("WhatsApp, telefone, horário e mapa")).toBeVisible();
  await page.getByRole("tab", { name: "Contato" }).click();
  await expect(page.getByText("Horário de Atendimento")).toBeVisible();
  await expect(page.getByText("Mapa de Localização")).toBeVisible();

  await page.getByRole("tab", { name: "Formulário" }).click();
  await expect(page.getByText("Mapa de Localização")).toHaveCount(0);
  await expect(page.getByText("Habilitar Formulário")).toBeVisible();

  await page.getByRole("tab", { name: "Catálogo" }).click();
  await expect(page.getByText("Mostrar Todos os Produtos")).toBeVisible();

  await page.getByRole("tab", { name: "Geral" }).click();
  const title = page.locator("#title");
  const original = await title.inputValue();
  await title.fill(`${original} revisão`);
  await expect(page.getByText("Alterações não salvas")).toBeVisible();
  await title.fill(original);
  await expect(page.getByText("Tudo salvo")).toBeVisible();
});
