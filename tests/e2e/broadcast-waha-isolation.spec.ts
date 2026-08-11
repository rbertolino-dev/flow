import { expect, test } from "@playwright/test";

import { loginAsTestUser, hasE2ECredentials } from "../helpers/auth";
import { HumanBehavior } from "../helpers/human-behavior";

test.describe("Disparador WAHA isolado @human-behavior", () => {
  test("alterna entre WAHA e Evolution sem misturar os painéis", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Sem credenciais E2E");
    const human = new HumanBehavior(page);

    await loginAsTestUser(page);
    await human.humanNavigate("/broadcast-2?provider=waha");
    await expect(page.getByRole("heading", { name: "Disparador WAHA" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar campanha Evolution" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar campanha WAHA" })).toBeVisible();
    await expect(page.getByText("Sincronizar status com Evolution")).toHaveCount(0);

    await human.hesitate(400, 800);
    await human.humanClick(page.getByRole("button", { name: "Criar campanha Evolution" }));
    await expect(page).toHaveURL(/\/broadcast-2$/);
    await expect(page.getByText("Sincronizar status com Evolution")).toBeVisible();
  });
});
