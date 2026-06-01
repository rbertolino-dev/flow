import { test, expect } from "@playwright/test";
import { hasE2ECredentials, loginAsTestUser } from "../helpers/auth";
import { waitForKanbanReady, trackLeadsListFetches } from "../helpers/funnel";

/**
 * Funil — etiquetas no card (popover), opção A do plano de performance.
 *
 * Credenciais (obrigatório para rodar):
 *   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e:funnel-tags
 */
test.describe("@funnel-tags Funil — etiquetas no card", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Defina E2E_EMAIL e E2E_PASSWORD para executar este teste.");

    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn, "Login E2E falhou — verifique credenciais.");

    await waitForKanbanReady(page);
    await page.waitForTimeout(1500);
  });

  test("adiciona etiqueta no popover sem refetch completo de leads", async ({ page }) => {
    const tracker = trackLeadsListFetches(page);
    const baseline = tracker.getCount();

    const tagButton = page
      .getByRole("button", { name: "Gerenciar etiquetas do lead" })
      .first();
    await tagButton.click();

    const popover = page.locator('[data-state="open"]').filter({ hasText: "Etiquetas" });
    await expect(popover.getByText("Etiquetas", { exact: true })).toBeVisible();

    const addSection = popover.getByText("Adicionar etiqueta");
    const cannotAdd = await popover
      .getByText(/todas as etiquetas já estão|não há etiquetas/i)
      .isVisible()
      .catch(() => false);

    if (cannotAdd) {
      tracker.dispose();
      test.skip(true, "Nenhuma etiqueta disponível para adicionar neste lead/organização.");
    }

    await addSection.scrollIntoViewIfNeeded();

    const combobox = popover.getByRole("combobox").first();
    await combobox.click();

    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible({ timeout: 10_000 });
    const tagName = (await firstOption.textContent())?.trim() ?? "";
    expect(tagName.length).toBeGreaterThan(0);

    await firstOption.click();

    const countBeforeAdd = tracker.getCount() - baseline;

    await popover.getByRole("button", { name: /^adicionar$/i }).click();

    await expect(popover.getByText(tagName, { exact: true })).toBeVisible({ timeout: 3_000 });

    await page.waitForTimeout(800);

    const countAfterAdd = tracker.getCount() - baseline;
    expect(countAfterAdd).toBe(countBeforeAdd);

    tracker.dispose();
  });

  test("remove etiqueta no popover sem refetch completo de leads", async ({ page }) => {
    const tagButton = page
      .getByRole("button", { name: "Gerenciar etiquetas do lead" })
      .first();
    await tagButton.click();

    const popover = page.locator('[data-state="open"]').filter({ hasText: "Etiquetas" });
    await expect(popover.getByText("Etiquetas", { exact: true })).toBeVisible();

    const removeBtn = popover.getByRole("button", { name: /^remover etiqueta /i }).first();
    const hasTag = await removeBtn.isVisible().catch(() => false);

    if (!hasTag) {
      const combobox = popover.getByRole("combobox").first();
      const canAdd = await combobox.isVisible().catch(() => false);
      if (!canAdd) {
        test.skip(true, "Lead sem etiquetas e sem opção de adicionar.");
      }
      await combobox.click();
      const firstOption = page.getByRole("option").first();
      await firstOption.click();
      await popover.getByRole("button", { name: /^adicionar$/i }).click();
      await page.waitForTimeout(500);
    }

    const removeBtnAfter = popover
      .getByRole("button", { name: /^remover etiqueta /i })
      .first();
    await expect(removeBtnAfter).toBeVisible({ timeout: 5_000 });

    const ariaLabel = await removeBtnAfter.getAttribute("aria-label");
    const tagNameMatch = ariaLabel?.match(/Remover etiqueta (.+)/i);
    const tagName = tagNameMatch?.[1] ?? "";

    const tracker = trackLeadsListFetches(page);
    const baseline = tracker.getCount();

    await removeBtnAfter.click();

    if (tagName) {
      await expect(popover.getByText(tagName, { exact: true })).toBeHidden({
        timeout: 3_000,
      });
    }

    await page.waitForTimeout(800);

    expect(tracker.getCount() - baseline).toBe(0);
    tracker.dispose();
  });

  test("abrir modal do lead após trocar etiqueta mantém tags no popover", async ({ page }) => {
    const tagButton = page
      .getByRole("button", { name: "Gerenciar etiquetas do lead" })
      .first();
    const card = page.locator("[data-kanban-sortable-item]").first();
    const leadName = await card.locator("h3").first().textContent();

    await tagButton.click();
    const popover = page.locator('[data-state="open"]').filter({ hasText: "Etiquetas" });
    await expect(popover.getByText("Etiquetas", { exact: true })).toBeVisible();

    let tagName = "";
    const removeExisting = popover.getByRole("button", { name: /^remover etiqueta /i }).first();
    if (await removeExisting.isVisible().catch(() => false)) {
      const aria = await removeExisting.getAttribute("aria-label");
      tagName = aria?.replace(/^Remover etiqueta\s+/i, "").trim() ?? "";
    } else {
      const combobox = popover.getByRole("combobox").first();
      if (!(await combobox.isVisible().catch(() => false))) {
        test.skip(true, "Sem etiquetas para validar sync com modal.");
      }
      await combobox.click();
      const opt = page.getByRole("option").first();
      tagName = (await opt.textContent())?.trim() ?? "";
      await opt.click();
      await popover.getByRole("button", { name: /^adicionar$/i }).click();
      await expect(popover.getByText(tagName, { exact: true })).toBeVisible({
        timeout: 3_000,
      });
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    if (leadName?.trim()) {
      await card.getByRole("heading", { name: leadName.trim() }).click();
    } else {
      await card.click({ position: { x: 40, y: 40 } });
    }

    const modal = page.getByRole("dialog").filter({ hasText: /etiqueta|detalhes|lead/i });
    await expect(modal.first()).toBeVisible({ timeout: 15_000 });

    if (tagName) {
      await expect(modal.getByText(tagName, { exact: false }).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  });
});
