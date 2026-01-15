# 📋 Plano de Correção - Performance e Erros no Funil

## 🔴 Problemas Identificados

### 1. **Erro 400 - Limite Muito Alto nas Queries**
- **Erro**: `GET /rest/v1/activities?limit=3235` e `GET /rest/v1/lead_tags?limit=3230` retornando 400
- **Causa**: `useLeads.ts` usa `limit(leadIds.length * 5)` que pode gerar limites muito altos (ex: 647 leads × 5 = 3235)
- **Impacto**: Queries falham quando há muitos leads

### 2. **Violações de Performance**
- **Erro**: Handlers de eventos levando 2861ms, 1066ms, 1048ms, etc.
- **Causa**: 
  - Re-renders excessivos
  - Queries pesadas bloqueando thread principal
  - Operações síncronas em handlers de eventos
- **Impacto**: Interface lenta, travamentos, má experiência do usuário

### 3. **Warning de Acessibilidade**
- **Erro**: `Missing Description or aria-describedby for DialogContent`
- **Causa**: Alguns dialogs não têm `DialogDescription`
- **Impacto**: Problemas de acessibilidade

---

## ✅ Plano de Correção

### **FASE 1: Corrigir Limites das Queries (CRÍTICO)**

#### 1.1. Limitar Activities por Lead (useLeads.ts)
**Problema**: `limit(leadIds.length * 5)` pode gerar limites muito altos

**Solução**:
- Limitar a 1000 activities no total (máximo seguro do Supabase)
- Usar paginação se necessário
- Manter limite de 5 activities por lead no agrupamento

**Arquivo**: `src/hooks/useLeads.ts`
**Linha**: ~86

```typescript
// ❌ ANTES (pode gerar limite muito alto)
.limit(leadIds.length * 5)

// ✅ DEPOIS (limite máximo seguro)
.limit(Math.min(leadIds.length * 5, 1000))
```

#### 1.2. Limitar Lead Tags (useLeads.ts)
**Problema**: Query de `lead_tags` sem limite explícito pode retornar muitos registros

**Solução**:
- Adicionar limite máximo de 5000 registros
- Se necessário, usar paginação

**Arquivo**: `src/hooks/useLeads.ts`
**Linha**: ~88

```typescript
// ✅ ADICIONAR limite
.from('lead_tags')
.select('lead_id, tag_id, tags(id, name, color)')
.in('lead_id', leadIds)
.limit(5000) // Limite máximo seguro
```

---

### **FASE 2: Otimizar Performance (IMPORTANTE)**

#### 2.1. Debounce em Handlers de Eventos
**Problema**: Handlers executando operações pesadas síncronamente

**Solução**:
- Usar `useCallback` para memoizar handlers
- Debounce em operações pesadas
- Mover operações pesadas para `requestIdleCallback` ou `setTimeout`

**Arquivos a verificar**:
- `src/components/crm/KanbanBoard.tsx` - Handlers de drag and drop
- `src/components/crm/LeadCard.tsx` - Handlers de clique
- `src/pages/Index.tsx` - Handlers de filtros

#### 2.2. Otimizar Re-renders
**Problema**: Componentes re-renderizando desnecessariamente

**Solução**:
- Verificar dependências de `useEffect` e `useMemo`
- Usar `React.memo` em componentes pesados
- Evitar criar objetos/arrays inline em props

**Arquivos a verificar**:
- `src/components/crm/LeadCard.tsx` - Já tem memo, verificar se está funcionando
- `src/components/crm/KanbanBoard.tsx` - Verificar memoização de filtros

#### 2.3. Lazy Loading de Activities
**Problema**: Carregar todas as activities de uma vez

**Solução**:
- Carregar apenas activities visíveis (virtual scrolling)
- Carregar mais activities sob demanda (infinite scroll)
- Limitar a 5 activities por lead inicialmente (já implementado, mas verificar se está funcionando)

---

### **FASE 3: Corrigir Acessibilidade (BAIXA PRIORIDADE)**

#### 3.1. Adicionar DialogDescription
**Problema**: Alguns dialogs não têm `DialogDescription`

**Solução**:
- Adicionar `DialogDescription` em todos os dialogs que não têm
- Ou adicionar `aria-describedby` quando não houver descrição

**Arquivos a verificar**:
- `src/components/crm/ScheduleMessagePanel.tsx` - Dialog de cancelamento
- `src/components/crm/CreateLeadDialog.tsx` - Verificar se tem description
- Outros dialogs sem description

---

## 🎯 Ordem de Implementação

### **Prioridade 1 (CRÍTICO - Corrigir Erros 400)**
1. ✅ Limitar activities a máximo de 1000
2. ✅ Adicionar limite de 5000 em lead_tags
3. ✅ Testar com muitos leads (500+)

### **Prioridade 2 (IMPORTANTE - Melhorar Performance)**
4. ✅ Debounce em handlers pesados
5. ✅ Otimizar re-renders
6. ✅ Verificar memoização de componentes

### **Prioridade 3 (BAIXA - Acessibilidade)**
7. ✅ Adicionar DialogDescription onde faltar

---

## 🧪 Testes Necessários

### Teste 1: Muitos Leads
- Criar 500+ leads
- Verificar se queries não retornam erro 400
- Verificar se performance está aceitável

### Teste 2: Performance
- Abrir funil com muitos leads
- Verificar console por violações de performance
- Verificar se handlers não levam mais de 200ms

### Teste 3: Acessibilidade
- Verificar console por warnings de DialogContent
- Testar com leitor de tela (opcional)

---

## 📝 Notas Importantes

- **NÃO remover funcionalidades existentes**
- **NÃO alterar estrutura de dados**
- **Apenas otimizar queries e performance**
- **Manter compatibilidade com código existente**

---

## ✅ Checklist de Implementação

- [ ] Fase 1.1: Limitar activities a máximo de 1000
- [ ] Fase 1.2: Adicionar limite de 5000 em lead_tags
- [ ] Fase 2.1: Debounce em handlers pesados
- [ ] Fase 2.2: Otimizar re-renders
- [ ] Fase 2.3: Verificar lazy loading de activities
- [ ] Fase 3.1: Adicionar DialogDescription onde faltar
- [ ] Testes: Verificar com muitos leads
- [ ] Testes: Verificar performance
- [ ] Deploy: Aplicar correções
