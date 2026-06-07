import { test, expect } from "@playwright/test";
import { loadE2eEnvSecure } from "../helpers/loadE2eEnv";
import { waitForKanbanReady, trackLeadsListFetches, gotoFunnelPage } from "../helpers/funnel";

async function openTagsPopover(page: import("@playwright/test").Page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  const tagButton = page
    .getByRole("button", { name: "Gerenciar etiquetas do lead" })
    .first();
  await tagButton.scrollIntoViewIfNeeded();
  await tagButton.click({ force: true });

  const popover = page
    .getByTestId("lead-tags-popover")
    .or(page.locator("[data-state=open]").filter({ hasText: "Adicionar etiqueta" }));
  await expect(popover.first()).toBeVisible({ timeout: 15_000 });
  return popover.first();
}

async function pickFirstAvailableTag(page: import("@playwright/test").Page, popover: import("@playwright/test").Locator) {
  const loading = popover.getByText("Carregando…");
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  }

  const cannotAdd = await popover
    .getByText(/todas as etiquetas já estão|não há etiquetas na organização/i)
    .isVisible()
    .catch(() => false);

  if (cannotAdd) {
    return null;
  }

  const combobox = popover.getByRole("combobox").first();
  await expect(combobox).toBeVisible({ timeout: 15_000 });
  await combobox.click();

  const listbox = page.getByRole("listbox").last();
  await expect(listbox).toBeVisible({ timeout: 10_000 });
  const firstOption = listbox.getByRole("option").first();
  await expect(firstOption).toBeVisible({ timeout: 10_000 });
  const tagName = (await firstOption.textContent())?.trim() ?? "";
  expect(tagName.length).toBeGreaterThan(0);
  await firstOption.click();
  await page.waitForTimeout(400);
  return tagName;
}

async function clickAddTagButton(popover: import("@playwright/test").Locator) {
  const addBtn = popover.getByRole("button", { name: /^adicionar$/i });
  await expect(addBtn).toBeVisible({ timeout: 10_000 });
  await expect(addBtn).toBeEnabled({ timeout: 5_000 });
  await addBtn.click();
}

/**
 * Funil — etiquetas no card (popover), opção A do plano de performance.
 */
test.describe("@funnel-tags Funil — etiquetas no card", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!loadE2eEnvSecure(), "Configure .env.e2e.local");

    await gotoFunnelPage(page);
    await waitForKanbanReady(page);
    await page.waitForTimeout(1500);

    const tagBtn = page.getByRole("button", { name: "Gerenciar etiquetas do lead" }).first();
    const tagBtnVisible = await tagBtn.isVisible().catch(() => false);
    test.skip(!tagBtnVisible, "Nenhum botão de etiquetas visível no funil (scroll/virtualização).");
  });

  test("adiciona etiqueta no popover sem refetch completo de leads", async ({ page }) => {
    const tracker = trackLeadsListFetches(page);
    const baseline = tracker.getCount();

    const popover = await openTagsPopover(page);
    const tagName = await pickFirstAvailableTag(page, popover);

    if (!tagName) {
      tracker.dispose();
      test.skip(true, "Nenhuma etiqueta disponível para adicionar neste lead/organização.");
    }

    const countBeforeAdd = tracker.getCount() - baseline;

    await clickAddTagButton(popover);

    await expect(popover.getByText(tagName!, { exact: true })).toBeVisible({ timeout: 5_000 });

    await page.waitForTimeout(800);

    const countAfterAdd = tracker.getCount() - baseline;
    expect(countAfterAdd).toBe(countBeforeAdd);

    tracker.dispose();
  });

  test("remove etiqueta no popover sem refetch completo de leads", async ({ page }) => {
    const popover = await openTagsPopover(page);

    let removeBtn = popover.getByRole("button", { name: /^remover etiqueta /i }).first();
    const hasTag = await removeBtn.isVisible().catch(() => false);

    if (!hasTag) {
      const tagName = await pickFirstAvailableTag(page, popover);
      if (!tagName) {
        test.skip(true, "Lead sem etiquetas e sem opção de adicionar.");
      }
      await clickAddTagButton(popover);
      await page.waitForTimeout(500);
    }

    removeBtn = popover.getByRole("button", { name: /^remover etiqueta /i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 5_000 });

    const ariaLabel = await removeBtn.getAttribute("aria-label");
    const tagNameMatch = ariaLabel?.match(/Remover etiqueta (.+)/i);
    const tagName = tagNameMatch?.[1] ?? "";

    const tracker = trackLeadsListFetches(page);
    const baseline = tracker.getCount();

    await removeBtn.click();

    if (tagName) {
      await expect(popover.getByText(tagName, { exact: true })).toBeHidden({
        timeout: 5_000,
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

    await tagButton.scrollIntoViewIfNeeded();
    await tagButton.click();

    const popover = page
      .getByTestId("lead-tags-popover")
      .or(page.locator("[data-state=open]").filter({ hasText: "Adicionar etiqueta" }))
      .first();
    await expect(popover.getByText("Etiquetas", { exact: true })).toBeVisible();

    let tagName = "";
    const removeExisting = popover.getByRole("button", { name: /^remover etiqueta /i }).first();
    if (await removeExisting.isVisible().catch(() => false)) {
      const aria = await removeExisting.getAttribute("aria-label");
      tagName = aria?.replace(/^Remover etiqueta\s+/i, "").trim() ?? "";
    } else {
      const picked = await pickFirstAvailableTag(page, popover);
      if (!picked) {
        test.skip(true, "Sem etiquetas para validar sync com modal.");
      }
      tagName = picked;
      await clickAddTagButton(popover);
      await expect(popover.getByText(tagName, { exact: true })).toBeVisible({
        timeout: 5_000,
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
