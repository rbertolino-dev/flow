# 📋 Regras para Adicionar Novas Funcionalidades com Sistema de Permissões

## 🎯 Regra Principal

**TODAS as novas funcionalidades DEVEM ser adicionadas ao sistema de permissões e aparecer automaticamente no painel de Super Admin para liberação por organização.**

---

## ✅ Checklist Obrigatório ao Criar Nova Funcionalidade

### 1. Adicionar Feature em `useOrganizationFeatures.ts`

**Arquivo:** `src/hooks/useOrganizationFeatures.ts`

**Ação:** Adicionar a nova feature no array `AVAILABLE_FEATURES`:

```typescript
export const AVAILABLE_FEATURES = [
  // ... features existentes
  { value: 'nova_feature', label: 'Nova Funcionalidade', description: 'Descrição da funcionalidade' },
] as const;
```

**Exemplo:**
```typescript
{ value: 'budgets', label: 'Orçamentos', description: 'Criação e gestão de orçamentos' },
{ value: 'employees', label: 'Colaboradores', description: 'Gerenciamento de colaboradores' },
```

### 2. Mapear Feature no Menu em `CRMLayout.tsx`

**Arquivo:** `src/components/crm/CRMLayout.tsx`

**Ação:** Adicionar mapeamento no objeto `menuToFeatureMap`:

```typescript
const menuToFeatureMap: Record<string, FeatureKey | null> = {
  // ... mapeamentos existentes
  'nova-feature': 'nova_feature', // controlado por feature
};
```

**IMPORTANTE:**
- Use `'nova_feature'` (mesmo valor do `value` em `AVAILABLE_FEATURES`)
- NUNCA use `null` para novas funcionalidades (sempre controlado por feature)
- Apenas itens especiais como `settings`, `superadmin` podem ser `null`

### 3. Adicionar Item no Menu em `CRMLayout.tsx`

**Arquivo:** `src/components/crm/CRMLayout.tsx`

**Ação:** Adicionar item no array `allBaseMenuItems`:

```typescript
const allBaseMenuItems = [
  // ... itens existentes
  { id: "nova-feature" as const, label: "Nova Funcionalidade", icon: IconComponent },
];
```

### 4. Adicionar Navegação em `CRMLayout.tsx`

**Arquivo:** `src/components/crm/CRMLayout.tsx`

**Ação:** Adicionar handler de navegação no `handleClick`:

```typescript
} else if (item.id === 'nova-feature') {
  navigate('/nova-feature');
}
```

**IMPORTANTE:** Adicionar tanto no menu desktop quanto no mobile.

### 5. Adicionar Rota em `App.tsx`

**Arquivo:** `src/App.tsx`

**Ação:** Adicionar rota:

```typescript
import NovaFeature from "./pages/NovaFeature";

// Dentro do Routes:
<Route path="/nova-feature" element={<NovaFeature />} />
```

### 6. Adicionar Tipo em `CRMLayout.tsx`

**Arquivo:** `src/components/crm/CRMLayout.tsx`

**Ação:** Adicionar no tipo `CRMView`:

```typescript
export type CRMView = 
  | "kanban"
  | "calls"
  // ... outros
  | "nova-feature";
```

---

## 🔄 Fluxo Automático

Após seguir o checklist acima:

1. ✅ A feature aparecerá **automaticamente** no painel de Super Admin
2. ✅ Super Admin poderá habilitar/desabilitar por organização
3. ✅ O menu só aparecerá para organizações com a feature habilitada
4. ✅ Funciona com sistema de planos (features podem vir do plano)
5. ✅ Funciona com trial (todas as features liberadas durante trial)

---

## 📝 Exemplo Completo: Adicionar "Relatórios"

### 1. `useOrganizationFeatures.ts`:
```typescript
{ value: 'reports', label: 'Relatórios', description: 'Acessar relatórios e análises' },
```

### 2. `CRMLayout.tsx` - Mapeamento:
```typescript
'reports': 'reports', // controlado por feature
```

### 3. `CRMLayout.tsx` - Menu Item:
```typescript
{ id: "reports" as const, label: "Relatórios", icon: BarChart },
```

### 4. `CRMLayout.tsx` - Navegação:
```typescript
} else if (item.id === 'reports') {
  navigate('/reports');
}
```

### 5. `App.tsx` - Rota:
```typescript
<Route path="/reports" element={<Reports />} />
```

### 6. `CRMLayout.tsx` - Tipo:
```typescript
| "reports";
```

---

## ⚠️ Regras Importantes

### ❌ NUNCA Fazer:

1. **NUNCA** adicionar feature sem mapear no `menuToFeatureMap`
2. **NUNCA** usar `null` no mapeamento para novas funcionalidades
3. **NUNCA** esquecer de adicionar a feature em `AVAILABLE_FEATURES`
4. **NUNCA** criar funcionalidade sem adicionar ao sistema de permissões

### ✅ SEMPRE Fazer:

1. **SEMPRE** adicionar feature em `AVAILABLE_FEATURES` primeiro
2. **SEMPRE** mapear no `menuToFeatureMap` com o mesmo valor
3. **SEMPRE** adicionar item no menu e navegação
4. **SEMPRE** adicionar rota no `App.tsx`
5. **SEMPRE** testar que aparece no Super Admin

---

## 🎨 Funcionalidades Especiais (Podem ser `null`)

Apenas estas funcionalidades podem ter `null` no mapeamento (sempre visíveis):

- `settings` - Configurações (sempre visível)
- `superadmin` - Super Admin (controlado por role, não feature)
- `users` - Usuários (sempre visível para admins)
- `assistant` - Assistente (sempre visível)

**Todas as outras funcionalidades DEVEM ser controladas por feature.**

---

## 📊 Verificação Final

Após implementar, verificar:

1. ✅ Feature aparece em `Super Admin → Organização → Funcionalidades`
2. ✅ Menu aparece/desaparece conforme feature habilitada/desabilitada
3. ✅ Rota funciona corretamente
4. ✅ Funciona com trial (todas liberadas)
5. ✅ Funciona com planos (features do plano)

---

## 🔍 Como Testar

1. Acesse Super Admin
2. Selecione uma organização
3. Vá em "Limites e Funcionalidades"
4. Verifique se a nova feature aparece na lista
5. Habilite/desabilite e verifique se o menu aparece/desaparece
6. Teste com trial ativo (deve aparecer todas)
7. Teste com plano (deve aparecer apenas as do plano)

---

**Última atualização:** 2025-12-17
**Mantido por:** Sistema de desenvolvimento













