# 📋 Análise do Módulo de Contratos - Melhorias Sugeridas

## 📊 Resumo Executivo

### Pontos Fortes ✅
- Soft delete implementado
- Sistema de assinaturas com autenticação
- Auditoria de ações
- Integração WhatsApp
- Geração de PDF

### Principais Melhorias Necessárias 🔧
1. **Performance:** Paginação e debounce
2. **UX:** Feedback visual e loading states
3. **Segurança:** Validações e sanitização
4. **Funcionalidades:** Notificações, exportação, ações em lote

---

## 🚀 1. PERFORMANCE (PRIORIDADE ALTA)

### 1.1 Paginação de Contratos
**Arquivo:** `src/hooks/useContracts.ts`

**Problema:** Carrega todos os contratos de uma vez.

**Solução:**
```typescript
// Adicionar paginação (35 por página)
const page = filters?.page || 1;
const pageSize = 35;
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;

query = query.range(from, to).select('*', { count: 'exact' });
```

### 1.2 Debounce na Busca
**Arquivo:** `src/pages/Contracts.tsx`

**Solução:**
```typescript
const debouncedSearch = useDebouncedValue(searchQuery, 300);
```

---

## 🎨 2. UX/UI (PRIORIDADE MÉDIA)

### 2.1 Loading States
- Skeleton loaders na lista
- Spinners durante operações
- Feedback de progresso

### 2.2 Toast Messages Melhoradas
- Mensagens mais descritivas
- Duração adequada (5s)
- Ações de retry quando aplicável

### 2.3 Dashboard de Contratos
- Cards com estatísticas
- Gráficos por período
- Lista de contratos que precisam atenção

---

## 🔒 3. SEGURANÇA (PRIORIDADE ALTA)

### 3.1 Validações
- Validar tamanho máximo de conteúdo
- Validar formato de datas
- Validar que lead existe

### 3.2 Sanitização
```typescript
import DOMPurify from 'dompurify';
const sanitizedContent = DOMPurify.sanitize(content);
```

---

## 🎯 4. FUNCIONALIDADES FALTANTES

### 4.1 Notificações de Expiração
- Cron job para verificar contratos próximos de expirar
- Enviar notificação 7, 3 e 1 dia antes

### 4.2 Ações em Lote
- Seleção múltipla
- Assinar/Enviar/Cancelar múltiplos

### 4.3 Exportação
- Exportar para Excel/CSV
- Relatórios por período

---

## 🔧 5. CÓDIGO (PRIORIDADE MÉDIA)

### 5.1 Dependências Instáveis
**Arquivo:** `src/pages/Contracts.tsx:66`

**Problema:**
```typescript
// ❌ Dependências instáveis
useEffect(() => { ... }, [filters?.status, filters?.lead_id]);
```

**Solução:**
```typescript
// ✅ Usar useMemo
const stableFilters = useMemo(() => filters, [filters?.status, ...]);
useEffect(() => { ... }, [stableFilters]);
```

### 5.2 Cache de Templates
```typescript
// Usar React Query
const { data: templates } = useQuery({
  queryKey: ['contract-templates', activeOrgId],
  queryFn: fetchTemplates,
  staleTime: 5 * 60 * 1000,
});
```

---

## 📊 6. BANCO DE DADOS

### 6.1 Índices
```sql
CREATE INDEX idx_contracts_org_status 
  ON contracts(organization_id, status) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_contracts_expires 
  ON contracts(expires_at) 
  WHERE deleted_at IS NULL;
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### 🔴 Prioridade ALTA
- [ ] Paginação (35 por página)
- [ ] Debounce na busca (300ms)
- [ ] Validações de entrada
- [ ] Corrigir dependências instáveis
- [ ] Adicionar índices no BD

### 🟡 Prioridade MÉDIA
- [ ] Loading states melhorados
- [ ] Notificações de expiração
- [ ] Cache de templates
- [ ] Dashboard de contratos

### 🟢 Prioridade BAIXA
- [ ] Ações em lote
- [ ] Exportação de relatórios
- [ ] Histórico de versões

---

**Última atualização:** 2025-01-XX
