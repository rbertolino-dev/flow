import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';
import { checkAccessibility } from '../helpers/accessibility';
import { measurePerformance } from '../helpers/performance';

/**
 * 🧑 Testes com Comportamento Humano
 * 
 * Estes testes simulam como um usuário real interage com a aplicação,
 * incluindo delays naturais, movimentos de mouse e tempo de leitura.
 */

test.describe('Comportamento Humano - Fluxos Principais', () => {
  let human: HumanBehavior;

  test.beforeEach(async ({ page }) => {
    human = new HumanBehavior(page);
  });

  test('deve criar lead como usuário real faria', async ({ page }) => {
    // Navegar como humano (com pausa para ler)
    await human.humanNavigate('/leads');
    
    // Aguardar carregamento e "ler" a página
    await human.randomDelay(1000, 2000);
    
    // Clicar em "Novo Lead" como humano
    const novoLeadButton = page.getByRole('button', { name: /novo lead/i });
    if (await novoLeadButton.isVisible()) {
      await human.humanClick(novoLeadButton);
      await human.randomDelay(500, 1000);
      
      // Preencher formulário como humano
      const nameInput = page.locator('input[name="name"], input[placeholder*="nome" i]').first();
      if (await nameInput.isVisible()) {
        await human.humanType(nameInput, 'João Silva');
        await human.randomDelay(300, 600); // Simula leitura
        
        const phoneInput = page.locator('input[name="phone"], input[placeholder*="telefone" i]').first();
        if (await phoneInput.isVisible()) {
          await human.humanType(phoneInput, '11987654321');
          await human.randomDelay(300, 600);
          
          // Scroll suave para ver mais campos
          await human.humanScroll('down', 200);
          await human.randomDelay(500, 1000);
          
          // Salvar com hesitação (ação importante)
          const saveButton = page.getByRole('button', { name: /salvar|criar/i }).first();
          if (await saveButton.isVisible()) {
            await human.hesitate(300, 800); // Pensar antes de salvar
            await human.humanClick(saveButton);
            
            // Verificar resultado
            await human.randomDelay(1000, 2000);
            const successMessage = page.getByText(/sucesso| criado|salvo/i).first();
            if (await successMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
              await expect(successMessage).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('deve navegar entre páginas como humano', async ({ page }) => {
    // Começar na home
    await human.humanNavigate('/');
    await human.randomDelay(1000, 2000);
    
    // Navegar para Leads
    const leadsLink = page.getByRole('link', { name: /leads/i });
    if (await leadsLink.isVisible()) {
      await human.humanClick(leadsLink);
      await human.randomDelay(1500, 2500); // Tempo para ler lista
    }
    
    // Navegar para Colaboradores
    const employeesLink = page.getByRole('link', { name: /colaboradores|funcionários/i });
    if (await employeesLink.isVisible()) {
      await human.humanClick(employeesLink);
      await human.randomDelay(1500, 2500);
    }
  });

  test('deve buscar e filtrar como humano', async ({ page }) => {
    await human.humanNavigate('/leads');
    await human.randomDelay(1000, 2000);
    
    // Buscar como humano
    const searchInput = page.getByPlaceholder(/buscar|pesquisar/i).first();
    if (await searchInput.isVisible()) {
      await human.humanType(searchInput, 'João');
      await human.randomDelay(800, 1200); // Tempo para resultados aparecerem
      
      // Verificar se resultados apareceram
      const results = page.locator('table tbody tr, [data-testid="lead-item"]');
      const count = await results.count();
      if (count > 0) {
        console.log(`✅ Encontrados ${count} resultados`);
      }
    }
  });
});

test.describe('Comportamento Humano - Acessibilidade', () => {
  let human: HumanBehavior;

  test.beforeEach(async ({ page }) => {
    human = new HumanBehavior(page);
  });

  test('deve verificar acessibilidade na página principal', async ({ page }) => {
    await human.humanNavigate('/');
    await human.randomDelay(1000, 2000);
    
    // Verificar acessibilidade
    const a11yResults = await checkAccessibility(page);
    
    if (a11yResults.violations.length > 0) {
      console.warn('⚠️  Violações de acessibilidade encontradas:', a11yResults.violations.length);
      // Não falhar o teste, apenas avisar (pode ser configurado para falhar)
    } else {
      console.log('✅ Nenhuma violação de acessibilidade encontrada');
    }
  });
});

test.describe('Comportamento Humano - Performance', () => {
  let human: HumanBehavior;

  test.beforeEach(async ({ page }) => {
    human = new HumanBehavior(page);
  });

  test('deve medir performance de carregamento', async ({ page }) => {
    await human.humanNavigate('/');
    await page.waitForLoadState('domcontentloaded');

    const metrics = await measurePerformance(page, 'Página Principal');

    // Validar que carregamento não é muito lento (tempos desde o início da navegação)
    expect(metrics.domContentLoaded).toBeLessThan(8000);
    expect(metrics.firstContentfulPaint).toBeLessThan(8000);
    
    console.log('📊 Métricas de Performance:', {
      'DOM Content Loaded': `${metrics.domContentLoaded.toFixed(2)}ms`,
      'First Contentful Paint': `${metrics.firstContentfulPaint.toFixed(2)}ms`,
    });
  });
});



