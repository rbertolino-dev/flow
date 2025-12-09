# Correções e Revisão do Sistema de Planos

## Problemas Identificados e Corrigidos

### 1. ✅ Conflito na Função `get_organization_limits`
**Problema**: A função estava sendo criada duas vezes com assinaturas diferentes:
- Migration 20250130000000: versão antiga sem `plan_name` e `has_custom_limits`
- Migration 20250130000002: versão nova com esses campos

**Correção**: 
- Atualizada a primeira migration para incluir os campos `plan_name` e `has_custom_limits` na assinatura
- A função agora retorna sempre os mesmos campos, permitindo atualização incremental

### 2. ✅ Lógica no Componente React
**Problema**: No `OrganizationLimitsPanel.tsx`, a lógica de atualização do estado do plano estava condicionada incorretamente.

**Correção**: 
- Simplificada a lógica para sempre atualizar `plan_name` e `has_custom_limits` quando `countsData` existe
- Removida duplicação de código

### 3. ✅ Ordem das Migrations
**Verificação**: As migrations estão na ordem correta:
1. `20250130000000` - Cria estrutura base (enum, tabela, funções iniciais)
2. `20250130000001` - Adiciona validações
3. `20250130000002` - Adiciona sistema de planos (atualiza funções)
4. `20250130000003` - Atualiza RPC para incluir plan_id

### 4. ✅ Dependências de Funções
**Verificação**: Todas as funções necessárias existem:
- ✅ `has_role()` - definida em migration anterior
- ✅ `is_pubdigital_user()` - definida em migration anterior
- ✅ `user_belongs_to_org()` - definida em migration anterior
- ✅ `get_organization_limits()` - criada e atualizada corretamente

### 5. ✅ Compatibilidade com Código Existente
**Verificação**: 
- A função `get_organization_limits` mantém compatibilidade retornando sempre os mesmos campos
- Componentes React foram atualizados para lidar com os novos campos opcionais
- Edge functions foram atualizadas para usar as novas funções

## Estrutura Final

### Migrations (Ordem de Execução)
1. **20250130000000_create_organization_limits.sql**
   - Cria enum `organization_feature`
   - Cria tabela `organization_limits`
   - Cria funções base (com suporte a planos na assinatura)

2. **20250130000001_add_limit_validations.sql**
   - Atualiza `create_lead_secure` para validar limites
   - Cria trigger para validar instâncias Evolution

3. **20250130000002_create_plans_system.sql**
   - Cria tabela `plans`
   - Adiciona `plan_id` em `organizations`
   - **Atualiza** `get_organization_limits` para buscar de planos
   - Cria planos padrão

4. **20250130000003_update_get_organizations_rpc.sql**
   - Atualiza RPC para incluir `plan_id`

### Componentes React
- ✅ `PlansManagementPanel.tsx` - Gerenciamento de planos
- ✅ `OrganizationLimitsPanel.tsx` - Limites customizados (com suporte a planos)
- ✅ `OrganizationDetailPanel.tsx` - Seletor de plano
- ✅ `SuperAdminDashboard.tsx` - Navegação para planos

### Edge Functions
- ✅ `create-evolution-instance/index.ts` - Valida limites antes de criar

## Testes Recomendados

1. **Criar organização sem plano** → Deve funcionar (ilimitado)
2. **Associar plano a organização** → Limites do plano devem ser aplicados
3. **Criar limites customizados** → Devem sobrescrever o plano
4. **Criar lead acima do limite** → Deve bloquear
5. **Criar instância EVO acima do limite** → Deve bloquear
6. **Criar instância EVO sem funcionalidade habilitada** → Deve bloquear

## Correções Adicionais Aplicadas

### 6. ✅ Lógica de Verificação de Funcionalidades
**Problema**: A verificação de funcionalidades em `can_create_evolution_instance` poderia falhar com NULL.

**Correção**: 
- Adicionada verificação explícita de `array_length IS NOT NULL` antes de verificar se a funcionalidade está no array
- Garante que arrays vazios ou NULL sejam tratados corretamente

## Notas Importantes

- ⚠️ A migration `20250130000002` **sobrescreve** a função `get_organization_limits` criada na primeira migration
- ✅ Isso é intencional e seguro, pois a assinatura é compatível
- ✅ Organizações sem plano continuam funcionando (ilimitado)
- ✅ Limites customizados têm prioridade sobre planos
- ✅ Todas as funções verificam NULL corretamente
- ✅ Arrays vazios são tratados como "todas funcionalidades habilitadas" (compatibilidade)

## Checklist de Validação

- [x] Todas as migrations têm sintaxe SQL válida
- [x] Funções não têm conflitos de assinatura
- [x] Componentes React não têm erros de lint
- [x] Imports estão corretos
- [x] Tipos TypeScript estão corretos
- [x] Lógica de NULL está tratada
- [x] Arrays vazios são tratados corretamente
- [x] Ordem de migrations está correta
- [x] Dependências entre migrations estão corretas

