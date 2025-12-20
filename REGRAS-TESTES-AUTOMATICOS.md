# 🧪 Regras para Testes Automáticos E2E

**Status:** ✅ Implementado  
**Data:** 17/12/2025

---

## 🎯 Regra Principal

**SEMPRE** executar testes E2E automatizados antes de fazer deploy ou mudanças críticas.

---

## 🚀 Comandos Disponíveis

### Executar Testes com Análise Automática

```bash
# Executar testes e analisar erros automaticamente
npm run test:e2e:auto

# Apenas gerar relatório (sem executar testes)
npm run test:e2e:analyze

# Executar e tentar aplicar correções automáticas
npm run test:e2e:fix
```

---

## 📊 O Que É Capturado

Quando testes falham, o sistema automaticamente captura:

1. **Screenshots** - Imagens das páginas no momento do erro
2. **Vídeos** - Gravação completa da execução que falhou
3. **Logs** - Logs detalhados de erros
4. **Stack traces** - Rastreamento completo do erro
5. **Seletores** - Informações sobre seletores que falharam
6. **Tempo de resposta** - Métricas de performance

---

## 🔍 Análise Automática de Erros

O sistema analisa automaticamente os erros e gera sugestões:

### Tipos de Análise:

1. **Timeouts:**
   - Detecta: Elementos que demoram muito para aparecer
   - Sugere: Aumentar timeout ou otimizar performance
   - Ação: Ajustar `timeout` no `playwright.config.ts`

2. **Seletores Quebrados:**
   - Detecta: Elementos não encontrados
   - Sugere: Atualizar seletores ou verificar se elemento existe
   - Ação: Atualizar seletores nos testes

3. **Validações:**
   - Detecta: Validações que falharam
   - Sugere: Ajustar validações ou dados de teste
   - Ação: Corrigir lógica de validação

4. **Performance:**
   - Detecta: Elementos lentos
   - Sugere: Otimizar queries ou adicionar waits
   - Ação: Melhorar performance do código

---

## 📝 Relatórios Gerados

Após executar testes, são gerados:

1. **`test-results/analysis/error-analysis.json`**
   - Análise completa em JSON
   - Lista de erros
   - Sugestões de correção

2. **`test-results/analysis/fix-suggestions.html`**
   - Relatório visual interativo
   - Screenshots e vídeos
   - Sugestões de correção

3. **`test-results/results.json`**
   - Resultados brutos do Playwright

4. **`test-results/test-execution.log`**
   - Log completo da execução

---

## 🔄 Fluxo de Trabalho

```
1. Desenvolvedor faz mudanças
    ↓
2. Executa: npm run test:e2e:auto
    ↓
3. Testes executam e capturam erros
    ↓
4. Sistema analisa erros automaticamente
    ↓
5. Gera relatório com sugestões
    ↓
6. Desenvolvedor revisa sugestões
    ↓
7. Aplica correções
    ↓
8. Re-executa testes
    ↓
9. ✅ Testes passam → Deploy
```

---

## ✅ Checklist Antes de Deploy

- [ ] Executar testes: `npm run test:e2e:auto`
- [ ] Revisar relatório: `test-results/analysis/fix-suggestions.html`
- [ ] Aplicar correções sugeridas
- [ ] Re-executar testes
- [ ] Verificar que todos passam
- [ ] Fazer deploy

---

## 🎯 Prioridades de Teste

### 🔴 Alta Prioridade (Sempre Testar):

- Login/Autenticação
- CRUD de Leads
- CRUD de Organizações
- Fluxos de pagamento
- Integrações críticas

### 🟡 Média Prioridade (Testar Regularmente):

- Formulários
- Navegação
- Filtros e buscas
- Relatórios

### 🟢 Baixa Prioridade (Testar Ocasionalmente):

- UI/UX
- Performance
- Acessibilidade

---

## ⚠️ Regras Importantes

1. **NUNCA** fazer deploy sem executar testes primeiro
2. **SEMPRE** revisar erros capturados
3. **SEMPRE** aplicar correções críticas antes de deploy
4. **SEMPRE** manter testes atualizados com mudanças no código
5. **NUNCA** ignorar erros de teste sem investigar

---

## 📚 Documentação

- **Regras:** `.cursorrules-testes`
- **Script:** `scripts/teste-automatico-completo.sh`
- **Guia:** Este arquivo

---

**🎯 Objetivo:** Garantir qualidade através de testes automatizados que capturam erros e sugerem correções automaticamente.

