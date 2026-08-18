import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';
import { checkAccessibility } from '../helpers/accessibility';
import { measurePerformance } from '../helpers/performance';
import { hasE2ECredentials, loginAsTestUser } from '../helpers/auth';

/**
 * Seleção múltipla e exclusão em lote de instâncias WhatsApp em Configurações.
 * Não confirma a exclusão — apenas valida o fluxo de seleção e o diálogo.
 */
test.describe('Configurações — exclusão em lote de instâncias @human-behavior @accessibility @performance', () => {
  test('deve selecionar várias instâncias e abrir confirmação de exclusão', async ({ page }) => {
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
    await human.randomDelay(1000, 1800);

    const toolbar = page.getByTestId('instance-bulk-toolbar');
    test.skip(!(await toolbar.isVisible().catch(() => false)), 'Nenhuma instância listada para testar seleção múltipla');

    await expect(toolbar).toBeVisible();
    await expect(page.getByTestId('bulk-delete-instances')).toBeDisabled();

    const a11yResults = await checkAccessibility(page, {
      exclude: ['.recharts-wrapper', '[data-radix-popper-content-wrapper]'],
    });
    if (a11yResults.violations.length > 0) {
      console.warn('⚠️ Violações de acessibilidade:', a11yResults.violations.length);
    }

    const metrics = await measurePerformance(page, 'Configurações WhatsApp — seleção de instâncias');
    expect(metrics.domContentLoaded).toBeLessThan(15000);

    await human.humanClick(page.getByTestId('select-all-instances'));
    await human.randomDelay(300, 600);

    await expect(page.getByText(/selecionada/i).first()).toBeVisible();
    await expect(page.getByTestId('bulk-delete-instances')).toBeEnabled();

    await human.hesitate(400, 900);
    await human.humanClick(page.getByTestId('bulk-delete-instances'));
    await human.randomDelay(400, 800);

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /excluir \d+ instância/i })).toBeVisible();

    await human.humanClick(dialog.getByRole('button', { name: /cancelar/i }));
    await expect(dialog).toBeHidden();
  });
});
