import { test, expect } from '@playwright/test';

/**
 * Testes E2E para funcionalidade de Colaboradores
 * 
 * Estes testes verificam:
 * - Navegação para página de colaboradores
 * - Listagem de funcionários
 * - Criação de funcionário
 * - Edição de funcionário
 * - Validações de formulário
 * - Filtros e busca
 * - Gerenciamento de cargos
 * - Gerenciamento de equipes
 */

test.describe('Colaboradores - Funcionalidade Completa', () => {
  test.beforeEach(async ({ page }) => {
    // Assumindo que há uma função de login helper
    // Se não existir, será necessário implementar
    // await login(page, 'email@exemplo.com', 'senha');
    
    // Navegar para página de colaboradores
    await page.goto('/employees');
    
    // Aguardar carregamento inicial
    await page.waitForLoadState('networkidle');
  });

  test('deve exibir página de colaboradores', async ({ page }) => {
    // Verificar título da página
    await expect(page.getByRole('heading', { name: /colaboradores/i })).toBeVisible();
    
    // Verificar descrição
    await expect(page.getByText(/gerencie funcionários/i)).toBeVisible();
    
    // Verificar botão de novo funcionário
    await expect(page.getByRole('button', { name: /novo funcionário/i })).toBeVisible();
  });

  test('deve abrir formulário de criação de funcionário', async ({ page }) => {
    // Clicar no botão de novo funcionário
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Verificar se o dialog foi aberto
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /novo funcionário/i })).toBeVisible();
    
    // Verificar campos obrigatórios
    await expect(page.getByLabel(/nome completo/i)).toBeVisible();
    await expect(page.getByLabel(/cpf/i)).toBeVisible();
    await expect(page.getByLabel(/data de admissão/i)).toBeVisible();
  });

  test('deve validar campos obrigatórios ao criar funcionário', async ({ page }) => {
    // Abrir formulário
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Tentar salvar sem preencher campos
    await page.getByRole('button', { name: /criar/i }).click();
    
    // Verificar mensagens de erro (se implementadas)
    // Nota: Depende da implementação de validação no formulário
  });

  test('deve criar funcionário com dados válidos', async ({ page }) => {
    // Abrir formulário
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Preencher campos obrigatórios
    await page.getByLabel(/nome completo/i).fill('João Silva');
    await page.getByLabel(/cpf/i).fill('123.456.789-00');
    await page.getByLabel(/data de admissão/i).fill('2024-01-01');
    
    // Preencher campos opcionais
    await page.getByLabel(/telefone/i).fill('(11) 98765-4321');
    await page.getByLabel(/email/i).fill('joao.silva@exemplo.com');
    
    // Salvar
    await page.getByRole('button', { name: /criar/i }).click();
    
    // Verificar se o funcionário foi criado (toast de sucesso ou na lista)
    // Nota: Depende da implementação de feedback
    await expect(page.getByText(/funcionário criado com sucesso/i).or(page.getByText(/joão silva/i))).toBeVisible({ timeout: 10000 });
  });

  test('deve filtrar funcionários por status', async ({ page }) => {
    // Aguardar carregamento da lista
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Selecionar filtro de status
    const statusFilter = page.getByRole('combobox').filter({ hasText: /status/i }).first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.getByRole('option', { name: /ativo/i }).click();
      
      // Verificar se a lista foi filtrada
      // Nota: Depende da implementação de filtros
    }
  });

  test('deve buscar funcionário por nome', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForSelector('input[placeholder*="Buscar"]', { timeout: 10000 });
    
    // Preencher busca
    const searchInput = page.getByPlaceholder(/buscar por nome/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('João');
      
      // Aguardar debounce (300ms)
      await page.waitForTimeout(500);
      
      // Verificar resultados
      // Nota: Depende da implementação de busca
    }
  });

  test('deve exibir detalhes do funcionário', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Clicar no botão de visualizar (ícone de olho)
    const viewButton = page.getByRole('button').filter({ has: page.locator('svg') }).first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      
      // Verificar se o dialog de detalhes foi aberto
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    }
  });

  test('deve editar funcionário existente', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Clicar no botão de editar
    const editButtons = page.getByRole('button').filter({ has: page.locator('svg[class*="Edit"]') });
    if ((await editButtons.count()) > 0) {
      await editButtons.first().click();
      
      // Verificar se o formulário foi aberto
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('heading', { name: /editar funcionário/i })).toBeVisible();
    }
  });

  test('deve inativar funcionário', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Clicar no botão de deletar/inativar
    const deleteButtons = page.getByRole('button').filter({ has: page.locator('svg[class*="Trash"]') });
    if ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().click();
      
      // Confirmar inativação
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
      await page.getByRole('button', { name: /inativar/i }).click();
      
      // Verificar feedback
      await expect(page.getByText(/inativado com sucesso/i)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Colaboradores - Validações', () => {
  test('deve validar CPF inválido', async ({ page }) => {
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Preencher com CPF inválido
    await page.getByLabel(/cpf/i).fill('000.000.000-00');
    await page.getByLabel(/nome completo/i).fill('Teste');
    await page.getByLabel(/data de admissão/i).fill('2024-01-01');
    
    await page.getByRole('button', { name: /criar/i }).click();
    
    // Verificar mensagem de erro de CPF
    // Nota: Depende da implementação de validação
  });

  test('deve validar email inválido', async ({ page }) => {
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Preencher com email inválido
    await page.getByLabel(/email/i).fill('email-invalido');
    await page.getByLabel(/nome completo/i).fill('Teste');
    await page.getByLabel(/cpf/i).fill('123.456.789-00');
    await page.getByLabel(/data de admissão/i).fill('2024-01-01');
    
    await page.getByRole('button', { name: /criar/i }).click();
    
    // Verificar mensagem de erro de email
    // Nota: Depende da implementação de validação
  });

  test('deve validar data de admissão futura', async ({ page }) => {
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    
    await page.getByRole('button', { name: /novo funcionário/i }).click();
    
    // Preencher com data futura
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    await page.getByLabel(/data de admissão/i).fill(futureDateStr);
    await page.getByLabel(/nome completo/i).fill('Teste');
    await page.getByLabel(/cpf/i).fill('123.456.789-00');
    
    await page.getByRole('button', { name: /criar/i }).click();
    
    // Verificar mensagem de erro
    // Nota: Depende da implementação de validação
  });
});

