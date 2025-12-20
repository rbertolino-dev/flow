# 🧑 Testes com Comportamento Humano

Este documento descreve as ferramentas implementadas para testar a aplicação como um usuário real faria, incluindo delays naturais, movimentos de mouse e tempo de leitura.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Helpers Disponíveis](#helpers-disponíveis)
3. [Como Usar](#como-usar)
4. [Comandos Disponíveis](#comandos-disponíveis)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Integração com Cursor AI](#integração-com-cursor-ai)

---

## 🎯 Visão Geral

Os testes com comportamento humano simulam como um usuário real interage com a aplicação:

- ✅ **Delays aleatórios** - Simula tempo de leitura e pensamento
- ✅ **Movimentos naturais do mouse** - Hover antes de clicar
- ✅ **Digitação variável** - Velocidade de digitação como humano
- ✅ **Scroll suave** - Movimento natural de scroll
- ✅ **Hesitação** - Pausas antes de ações importantes
- ✅ **Acessibilidade** - Verificação automática de acessibilidade
- ✅ **Performance** - Medição de métricas de performance

---

## 🛠️ Helpers Disponíveis

### 1. HumanBehavior (`tests/helpers/human-behavior.ts`)

Classe principal para simular comportamento humano:

```typescript
import { HumanBehavior } from '../helpers/human-behavior';

const human = new HumanBehavior(page);

// Clicar como humano (com hover e delay)
await human.humanClick('button:has-text("Salvar")');

// Digitar como humano (com delays variáveis)
await human.humanType('input[name="name"]', 'João Silva');

// Scroll suave
await human.humanScroll('down', 300);

// Navegar com pausa para "ler"
await human.humanNavigate('/leads');

// Hesitar antes de ação importante
await human.hesitate(500, 1000);

// Delay aleatório (tempo de leitura)
await human.randomDelay(1000, 2000);
```

**Métodos disponíveis:**
- `humanClick()` - Clica com movimento natural
- `humanType()` - Digita com velocidade variável
- `humanFill()` - Preenche campo de forma natural
- `humanScroll()` - Scroll suave
- `humanNavigate()` - Navega com pausas
- `humanWaitFor()` - Aguarda elemento aparecer
- `humanSelect()` - Seleciona dropdown como humano
- `randomDelay()` - Delay aleatório
- `simulateReading()` - Simula leitura de texto
- `hesitate()` - Hesitação antes de ação importante

### 2. Accessibility (`tests/helpers/accessibility.ts`)

Verifica acessibilidade automaticamente:

```typescript
import { checkAccessibility, assertAccessibility } from '../helpers/accessibility';

// Verificar acessibilidade
const results = await checkAccessibility(page);

// Falhar teste se houver violações
await assertAccessibility(page);
```

### 3. Performance (`tests/helpers/performance.ts`)

Mede métricas de performance:

```typescript
import { measurePerformance, validatePerformance } from '../helpers/performance';

// Medir performance
const metrics = await measurePerformance(page, 'Nome do Teste');

// Validar se está dentro dos limites
const validation = validatePerformance(metrics, {
  maxDomContentLoaded: 3000,
  maxFirstPaint: 2000,
});
```

---

## 🚀 Como Usar

### Exemplo Básico

```typescript
import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';

test('deve criar lead como usuário real', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  // Navegar
  await human.humanNavigate('/leads');
  await human.randomDelay(1000, 2000);
  
  // Clicar em "Novo Lead"
  await human.humanClick('button:has-text("Novo Lead")');
  await human.randomDelay(500, 1000);
  
  // Preencher formulário
  await human.humanType('input[name="name"]', 'João Silva');
  await human.randomDelay(300, 600);
  
  await human.humanType('input[name="phone"]', '11987654321');
  await human.randomDelay(300, 600);
  
  // Hesitar antes de salvar
  await human.hesitate(500, 1000);
  await human.humanClick('button:has-text("Salvar")');
  
  // Verificar resultado
  await expect(page.getByText(/sucesso/i)).toBeVisible();
});
```

### Exemplo com Acessibilidade

```typescript
import { test } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';
import { checkAccessibility } from '../helpers/accessibility';

test('deve verificar acessibilidade', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  await human.humanNavigate('/');
  await human.randomDelay(1000, 2000);
  
  // Verificar acessibilidade
  const results = await checkAccessibility(page);
  
  if (results.violations.length > 0) {
    console.warn('Violações encontradas:', results.violations);
  }
});
```

### Exemplo com Performance

```typescript
import { test, expect } from '@playwright/test';
import { HumanBehavior } from '../helpers/human-behavior';
import { measurePerformance } from '../helpers/performance';

test('deve medir performance', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  const metrics = await measurePerformance(page, 'Página Principal');
  
  // Validar que não é muito lento
  expect(metrics.domContentLoaded).toBeLessThan(3000);
  expect(metrics.firstContentfulPaint).toBeLessThan(2000);
});
```

---

## 📝 Comandos Disponíveis

### Testar Nova Funcionalidade (Completo)

```bash
# Executa todos os testes (E2E, acessibilidade, performance, visual)
npm run test:new-feature [nome-funcionalidade]

# Exemplo
npm run test:new-feature "criar-lead"
```

### Testes Específicos

```bash
# Testes com comportamento humano
npm run test:e2e:human

# Testes de acessibilidade
npm run test:e2e:accessibility

# Testes de performance
npm run test:e2e:performance

# Testes visuais (visual regression)
npm run test:e2e:visual

# Gerar teste automaticamente (codegen)
npm run test:e2e:codegen
```

---

## 💡 Exemplos Práticos

### 1. Teste de CRUD Completo

```typescript
test('deve criar, editar e deletar lead como humano', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  // Criar
  await human.humanNavigate('/leads');
  await human.humanClick('button:has-text("Novo Lead")');
  await human.humanType('input[name="name"]', 'Teste');
  await human.hesitate(300, 600);
  await human.humanClick('button:has-text("Salvar")');
  
  // Editar
  await human.randomDelay(1000, 2000);
  await human.humanClick('button[aria-label="Editar"]');
  await human.humanType('input[name="name"]', 'Teste Editado');
  await human.humanClick('button:has-text("Salvar")');
  
  // Deletar
  await human.randomDelay(1000, 2000);
  await human.humanClick('button[aria-label="Deletar"]');
  await human.hesitate(500, 1000); // Hesitar antes de confirmar
  await human.humanClick('button:has-text("Confirmar")');
});
```

### 2. Teste de Navegação

```typescript
test('deve navegar entre páginas como humano', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  // Home
  await human.humanNavigate('/');
  await human.randomDelay(1500, 2500);
  
  // Leads
  await human.humanClick('a:has-text("Leads")');
  await human.randomDelay(1500, 2500);
  
  // Colaboradores
  await human.humanClick('a:has-text("Colaboradores")');
  await human.randomDelay(1500, 2500);
});
```

### 3. Teste de Busca

```typescript
test('deve buscar como humano', async ({ page }) => {
  const human = new HumanBehavior(page);
  
  await human.humanNavigate('/leads');
  await human.randomDelay(1000, 2000);
  
  // Buscar
  await human.humanType('input[placeholder*="Buscar"]', 'João');
  await human.randomDelay(800, 1200); // Aguardar resultados
  
  // Verificar resultados
  const results = page.locator('table tbody tr');
  const count = await results.count();
  expect(count).toBeGreaterThan(0);
});
```

---

## 🤖 Integração com Cursor AI

As regras foram adicionadas ao `.cursorrules` para uso automático:

### Quando o Cursor Executa Automaticamente:

- ✅ Criar nova funcionalidade → `npm run test:new-feature`
- ✅ Implementar novo CRUD → Testa fluxo completo
- ✅ Adicionar nova página → Testa navegação
- ✅ Modificar formulário → Testa preenchimento

### Fluxo Automático:

```
Usuário: "Crie funcionalidade X"
    ↓
Cursor implementa
    ↓
Cursor AUTOMATICAMENTE executa: npm run test:new-feature
    ↓
Sistema testa:
  - E2E com comportamento humano
  - Acessibilidade
  - Performance
  - Visual regression
    ↓
Cursor analisa resultados e corrige se necessário
```

---

## 📊 Tags para Organização

Use tags para organizar testes:

```typescript
test('teste com comportamento humano @human-behavior', async ({ page }) => {
  // ...
});

test('teste de acessibilidade @accessibility', async ({ page }) => {
  // ...
});

test('teste de performance @performance', async ({ page }) => {
  // ...
});

test('teste visual @visual', async ({ page }) => {
  // ...
});
```

---

## 🎯 Benefícios

### Realismo
- ✅ Testa como usuário real usaria a aplicação
- ✅ Detecta problemas que testes rápidos não detectam
- ✅ Simula condições reais de uso

### Confiabilidade
- ✅ Menos falsos positivos
- ✅ Detecta problemas de timing
- ✅ Valida experiência do usuário

### Qualidade
- ✅ Verifica acessibilidade automaticamente
- ✅ Mede performance
- ✅ Detecta regressões visuais

---

## 📚 Documentação Adicional

- [Ferramentas de Desenvolvimento](./FERRAMENTAS-DESENVOLVIMENTO.md)
- [Regras de Testes](./REGRAS-TESTES-AUTOMATICOS.md)
- [Regras do Cursor](./.cursorrules)

---

**Última atualização:** 2025-01-XX  
**Mantido por:** Equipe de Desenvolvimento



