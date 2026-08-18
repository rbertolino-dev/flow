import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';
import { checkAccessibility } from '../helpers/accessibility';
import { hasE2ECredentials, loginAsTestUser } from '../helpers/auth';

/**
 * Criação em lote de instâncias WhatsApp em Configurações.
 * Não confirma a criação — só valida o diálogo, geração de nomes e cancelamento.
 */
test.describe('Configurações — criação em lote de instâncias @human-behavior @accessibility', () => {
  test('deve abrir o diálogo, gerar nomes e cancelar sem criar', async ({ page }) => {
    test.setTimeout(90_000);
    test.skip(!hasE2ECredentials(), 'Credenciais E2E não configuradas');

    const human = new HumanBehavior(page);
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn, 'Não foi possível autenticar para o teste E2E');

    await human.humanNavigate('/settings');
    await human.randomDelay(800, 1400);

    const whatsappTab = page.getByRole('tab', { name: /whatsapp/i });
    test.skip(!(await whatsappTab.isVisible().catch(() => false)), 'Aba WhatsApp não disponível neste usuário');

    await human.humanClick(whatsappTab);
    await human.randomDelay(800, 1400);

    const bulkButton = page.getByTestId('bulk-create-instances');
    await expect(bulkButton).toBeVisible();

    const a11yResults = await checkAccessibility(page, {
      exclude: ['.recharts-wrapper', '[data-radix-popper-content-wrapper]'],
    });
    if (a11yResults.violations.length > 0) {
      console.warn('⚠️ Violações de acessibilidade:', a11yResults.violations.length);
    }

    await human.humanClick(bulkButton);
    await human.randomDelay(400, 800);

    const dialog = page.getByTestId('bulk-create-instances-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /criar instâncias em lote/i })).toBeVisible();

    await human.humanClick(dialog.getByRole('button', { name: /gerar lista/i }));
    await human.randomDelay(300, 600);

    const names = dialog.getByTestId('bulk-create-names');
    await expect(names).toHaveValue(/Chip 1/);

    await human.hesitate(300, 600);
    await human.humanClick(dialog.getByRole('button', { name: /cancelar/i }));
    await expect(dialog).toBeHidden();
  });
});
