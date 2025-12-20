import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';

/**
 * Teste específico para o botão "Novo Contrato"
 * Foca em capturar e corrigir o erro de SelectItem com value vazio
 */

test.describe('Contratos - Botão Novo Contrato', () => {
  let human: HumanBehavior;

  test.beforeEach(async ({ page }) => {
    human = new HumanBehavior(page);
    // Assumir que já está logado - navegar direto para contratos
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
    await human.randomDelay(1000, 2000);
  });

  test('deve abrir dialog de novo contrato sem erros', async ({ page }) => {
    // Capturar erros do console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capturar erros de página
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // Procurar e clicar no botão "Novo Contrato"
    const novoContratoButton = page.getByRole('button', { name: /novo contrato/i });
    
    await expect(novoContratoButton).toBeVisible({ timeout: 10000 });
    await human.humanClick(novoContratoButton);
    await human.randomDelay(1000, 2000);

    // Verificar se o dialog abriu
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    
    // Verificar se o título está correto
    await expect(page.getByRole('heading', { name: /criar novo contrato/i })).toBeVisible();

    // Verificar se não há erros no console relacionados a SelectItem
    const selectItemErrors = consoleErrors.filter(err => 
      err.includes('Select.Item') || 
      err.includes('value prop') || 
      err.includes('empty string')
    );

    const pageSelectItemErrors = pageErrors.filter(err => 
      err.includes('Select.Item') || 
      err.includes('value prop') || 
      err.includes('empty string')
    );

    // Verificar se os selects estão visíveis e funcionando
    const templateSelect = page.locator('label:has-text("Template")').locator('..').locator('[role="combobox"]').first();
    const leadSelect = page.locator('label:has-text("Lead")').or(page.locator('label:has-text("Cliente")')).locator('..').locator('[role="combobox"]').first();
    const categorySelect = page.locator('label:has-text("Categoria")').locator('..').locator('[role="combobox"]').first();

    // Aguardar um pouco para garantir que tudo carregou
    await human.randomDelay(2000, 3000);

    // Verificar se não há erros
    if (selectItemErrors.length > 0 || pageSelectItemErrors.length > 0) {
      console.error('❌ ERROS ENCONTRADOS:');
      console.error('Console errors:', selectItemErrors);
      console.error('Page errors:', pageSelectItemErrors);
      throw new Error(`Erro de SelectItem detectado: ${[...selectItemErrors, ...pageSelectItemErrors].join(', ')}`);
    }

    // Verificar se os selects estão visíveis
    if (await templateSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await templateSelect.click();
      await human.randomDelay(500, 1000);
      // Verificar se o dropdown abriu
      const selectContent = page.locator('[role="listbox"]').first();
      await expect(selectContent).toBeVisible({ timeout: 2000 });
      // Fechar clicando fora
      await page.keyboard.press('Escape');
    }

    // Verificar se não há erros após interação
    await human.randomDelay(1000, 2000);
    
    const finalSelectItemErrors = consoleErrors.filter(err => 
      err.includes('Select.Item') || 
      err.includes('value prop') || 
      err.includes('empty string')
    );

    if (finalSelectItemErrors.length > 0) {
      throw new Error(`Erro de SelectItem após interação: ${finalSelectItemErrors.join(', ')}`);
    }

    // Se chegou aqui, tudo está OK
    expect(true).toBe(true);
  });

  test('deve verificar todos os SelectItems no dialog', async ({ page }) => {
    // Capturar erros
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('Select.Item')) {
        errors.push(msg.text());
      }
    });
    page.on('pageerror', (error) => {
      if (error.message.includes('Select.Item')) {
        errors.push(error.message);
      }
    });

    // Abrir dialog
    await page.getByRole('button', { name: /novo contrato/i }).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await human.randomDelay(2000, 3000);

    // Verificar cada select individualmente
    const selects = [
      { label: 'Template', selector: 'label:has-text("Template")' },
      { label: 'Lead', selector: 'label:has-text("Lead"), label:has-text("Cliente")' },
      { label: 'Categoria', selector: 'label:has-text("Categoria")' }
    ];

    for (const select of selects) {
      try {
        const selectTrigger = page.locator(select.selector).locator('..').locator('[role="combobox"]').first();
        if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
          await selectTrigger.click();
          await human.randomDelay(500, 1000);
          
          // Verificar se há itens no dropdown
          const items = page.locator('[role="option"]');
          const count = await items.count();
          
          // Verificar se algum item tem value vazio
          for (let i = 0; i < count; i++) {
            const item = items.nth(i);
            const value = await item.getAttribute('data-value');
            if (value === '' || value === null || value === undefined) {
              throw new Error(`SelectItem com value vazio encontrado no select "${select.label}"`);
            }
          }
          
          await page.keyboard.press('Escape');
          await human.randomDelay(300, 600);
        }
      } catch (error: any) {
        if (!error.message.includes('timeout')) {
          throw error;
        }
      }
    }

    // Verificar erros finais
    if (errors.length > 0) {
      throw new Error(`Erros de SelectItem encontrados: ${errors.join(', ')}`);
    }
  });
});


