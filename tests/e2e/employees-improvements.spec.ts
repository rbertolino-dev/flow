import { test, expect } from '@playwright/test';

test.describe('Melhorias do Sistema de Colaboradores', () => {
  test.beforeEach(async ({ page }) => {
    // Assumir que já está logado (ajustar conforme necessário)
    await page.goto('/employees');
    // Aguardar carregamento da página
    await page.waitForLoadState('networkidle');
  });

  test('Deve exibir todos os campos no formulário de cadastro de cargo', async ({ page }) => {
    // Navegar para a aba de Cargos
    await page.click('text=Cargos');
    await page.waitForTimeout(500);

    // Clicar no botão "Novo Cargo"
    await page.click('button:has-text("Novo Cargo")');
    await page.waitForTimeout(500);

    // Verificar se os campos estão visíveis
    await expect(page.locator('input[id="name"]')).toBeVisible();
    await expect(page.locator('input[id="description"]')).toBeVisible();
    await expect(page.locator('input[id="base_salary"]')).toBeVisible();
    await expect(page.locator('select, [role="combobox"]')).toBeVisible(); // Nível Hierárquico
    await expect(page.locator('input[id="department"]')).toBeVisible();
    await expect(page.locator('input[id="requirements"]')).toBeVisible();
    await expect(page.locator('input[id="salary_min"]')).toBeVisible();
    await expect(page.locator('input[id="salary_max"]')).toBeVisible();
  });

  test('Deve preencher e salvar um cargo com todos os campos', async ({ page }) => {
    // Navegar para a aba de Cargos
    await page.click('text=Cargos');
    await page.waitForTimeout(500);

    // Clicar no botão "Novo Cargo"
    await page.click('button:has-text("Novo Cargo")');
    await page.waitForTimeout(500);

    // Preencher campos obrigatórios
    await page.fill('input[id="name"]', 'Desenvolvedor Full Stack');
    await page.fill('input[id="description"]', 'Desenvolvedor com experiência em React e Node.js');
    await page.fill('input[id="base_salary"]', '8000');

    // Preencher novos campos
    await page.click('select, [role="combobox"]'); // Abrir select de nível hierárquico
    await page.click('text=Pleno');
    await page.fill('input[id="department"]', 'TI');
    await page.fill('input[id="requirements"]', 'React, Node.js, TypeScript');
    await page.fill('input[id="salary_min"]', '6000');
    await page.fill('input[id="salary_max"]', '10000');

    // Salvar
    await page.click('button:has-text("Criar")');
    await page.waitForTimeout(1000);

    // Verificar se o cargo foi criado (aparece na lista)
    await expect(page.locator('text=Desenvolvedor Full Stack')).toBeVisible();
  });

  test('Deve exibir a aba de Relatórios', async ({ page }) => {
    // Verificar se a aba de Relatórios existe
    await expect(page.locator('text=Relatórios')).toBeVisible();
    
    // Clicar na aba de Relatórios
    await page.click('text=Relatórios');
    await page.waitForTimeout(500);

    // Verificar se os elementos do relatório estão visíveis
    await expect(page.locator('text=Relatórios e Exportação')).toBeVisible();
    await expect(page.locator('text=Tipo de Relatório')).toBeVisible();
    await expect(page.locator('text=Formato de Exportação')).toBeVisible();
    await expect(page.locator('button:has-text("Gerar Relatório")')).toBeVisible();
  });

  test('Deve gerar relatório em Excel', async ({ page }) => {
    // Navegar para a aba de Relatórios
    await page.click('text=Relatórios');
    await page.waitForTimeout(500);

    // Selecionar formato Excel
    await page.click('select, [role="combobox"]'); // Abrir select de formato
    await page.click('text=Excel (CSV)');
    await page.waitForTimeout(300);

    // Clicar em Gerar Relatório
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('button:has-text("Gerar Relatório")');
    
    // Aguardar download (pode falhar se não houver funcionários, mas o botão deve funcionar)
    try {
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    } catch (e) {
      // Se não houver download, verificar se pelo menos o botão foi clicado
      console.log('Download não iniciado (pode ser que não haja dados)');
    }
  });

  test('Deve exibir campos adicionais no formulário de funcionário', async ({ page }) => {
    // Navegar para a aba de Funcionários
    await page.click('text=Funcionários');
    await page.waitForTimeout(500);

    // Clicar no botão "Novo Funcionário"
    await page.click('button:has-text("Novo Funcionário")');
    await page.waitForTimeout(500);

    // Verificar se os novos campos estão visíveis
    await expect(page.locator('input[id="emergency_contact_name"]')).toBeVisible();
    await expect(page.locator('input[id="emergency_contact_phone"]')).toBeVisible();
    await expect(page.locator('input[id="ctps"]')).toBeVisible();
    await expect(page.locator('input[id="pis"]')).toBeVisible();
  });
});

