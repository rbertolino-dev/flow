import { Page, test as base } from '@playwright/test';
// @ts-ignore - axe-core types podem não estar disponíveis
import AxeBuilder from '@axe-core/playwright';

/**
 * 🔍 Helpers para testes de acessibilidade
 * 
 * Usa axe-core para detectar problemas de acessibilidade
 * automaticamente em testes E2E
 */

/**
 * Executa análise de acessibilidade na página atual
 * Retorna violações encontradas
 */
export async function checkAccessibility(page: Page, options?: {
  tags?: string[];
  rules?: string[];
  exclude?: string[];
}) {
  const builder = new AxeBuilder({ page })
    .withTags(options?.tags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .exclude(options?.exclude || []);

  if (options?.rules) {
    builder.withRules(options.rules);
  }

  const results = await builder.analyze();
  
  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
  };
}

/**
 * Testa acessibilidade e falha se houver violações críticas
 */
export async function assertAccessibility(
  page: Page,
  options?: {
    tags?: string[];
    rules?: string[];
    exclude?: string[];
    failOnViolations?: boolean;
  }
) {
  const results = await checkAccessibility(page, options);
  
  if (results.violations.length > 0) {
    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
    }));
    
    console.error('❌ Violações de acessibilidade encontradas:', violations);
    
    if (options?.failOnViolations !== false) {
      throw new Error(
        `Encontradas ${results.violations.length} violações de acessibilidade. ` +
        `Verifique o console para detalhes.`
      );
    }
  }
  
  return results;
}

/**
 * Test fixture para testes de acessibilidade
 */
export const test = base.extend<{
  checkA11y: (options?: Parameters<typeof checkAccessibility>[1]) => ReturnType<typeof checkAccessibility>;
}>({
  checkA11y: async ({ page }, use) => {
    await use((options) => checkAccessibility(page, options));
  },
});

