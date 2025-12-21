<!-- 74538fd9-2df9-4ed5-8b15-8cc2b7af4d0b 01f970d2-b381-4c10-9849-734360069cdf -->
# Migração de Produtos: Supabase → PostgreSQL

## Objetivo

Migrar completamente o sistema de produtos do Supabase para PostgreSQL direto, seguindo o mesmo padrão já implementado para serviços (budgets).

## Estrutura Atual (Supabase)

### Tabela `products` no Supabase:

- Campos: id, organization_id, name, description, sku, price, cost, category, is_active, stock_quantity, min_stock, unit, image_url, created_at, updated_at, created_by
- Campos adicionais: commission_percentage, commission_fixed (adicionados em migration posterior)
- RLS habilitado com políticas por organização
- Relação: `leads.product_id` → `products.id` (foreign key)

### Arquivos que usam produtos:

- `src/hooks/useProducts.ts` - Hook principal (usa Supabase direto)
- `src/components/crm/ProductsManagement.tsx` - Gerenciamento de produtos
- `src/components/budgets/ProductSelector.tsx` - Seleção de produtos em orçamentos
- `src/components/onboarding/ProductsStep.tsx` - Onboarding de produtos
- `src/types/product.ts` - Tipos TypeScript

## Estrutura Nova (PostgreSQL)

### Banco de dados:

- **Database:** `budget_services` (mesmo banco usado para serviços)
- **Tabela:** `products` (nova tabela no PostgreSQL)
- **Conexão:** Via Edge Function (padrão já estabelecido)

### Campos da nova tabela:

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  unit TEXT DEFAULT 'un',
  image_url TEXT,
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  commission_fixed NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  UNIQUE(organization_id, sku)
);
```

## Plano de Implementação

### Fase 1: Preparação e Criação de Infraestrutura

**1.1. Criar migration SQL para PostgreSQL**

- Arquivo: `supabase/migrations/20250125000000_create_products_table_postgres.sql`
- Criar tabela `products` no banco `budget_services`
- Criar índices: organization_id, category, is_active, sku
- Criar trigger para `updated_at`

**1.2. Criar Edge Function para produtos**

- Arquivo: `supabase/functions/products/index.ts`
- Padrão similar a `supabase/functions/employees/index.ts` e `supabase/functions/positions/index.ts`
- Endpoints:
  - `GET /` - Listar produtos (filtro por organization_id)
  - `GET /:id` - Buscar produto por ID
  - `POST /` - Criar produto
  - `PUT /:id` - Atualizar produto
  - `DELETE /:id` - Deletar produto
- Validação de permissões (organization_members via Supabase)
- Conexão PostgreSQL usando `getPostgresClient()`

**1.3. Configurar variáveis de ambiente**

- Adicionar variáveis PostgreSQL na Edge Function `products`
- POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

### Fase 2: Migração de Dados

**2.1. Criar script de migração de dados**

- Arquivo: `scripts/migrate-products-to-postgres.sh`
- Script que:

  1. Conecta ao Supabase e busca todos os produtos
  2. Conecta ao PostgreSQL
  3. Insere produtos no PostgreSQL (preservando IDs UUID)
  4. Valida integridade (contagem, campos críticos)
  5. Gera relatório de migração

**2.2. Executar migração em ambiente de desenvolvimento primeiro**

- Testar script de migração
- Validar dados migrados
- Verificar integridade referencial

### Fase 3: Atualização do Código Frontend

**3.1. Criar novo hook `useProductsPostgres`**

- Arquivo: `src/hooks/useProductsPostgres.ts`
- Usar Edge Function `/functions/v1/products` ao invés de Supabase direto
- Manter mesma interface do hook atual (`useProducts`)
- Métodos: fetchProducts, createProduct, updateProduct, deleteProduct, getProductsByCategory, getActiveProducts

**3.2. Atualizar `useProducts.ts` para usar novo hook**

- Substituir chamadas Supabase por chamadas à Edge Function
- Manter compatibilidade com componentes existentes
- Ou renomear `useProductsPostgres` para `useProducts` após migração completa

**3.3. Atualizar componentes (se necessário)**

- `ProductsManagement.tsx` - Verificar se precisa de ajustes
- `ProductSelector.tsx` - Verificar se precisa de ajustes
- `ProductsStep.tsx` - Verificar se precisa de ajustes
- Todos devem continuar funcionando com o novo hook

### Fase 4: Tratamento de Relações

**4.1. Decidir sobre `leads.product_id`**

- Opção A: Manter `product_id` em leads como UUID (sem foreign key)
- Opção B: Criar tabela de relacionamento `lead_products` (many-to-many)
- Opção C: Remover `product_id` de leads (se não for crítico)
- **Recomendação:** Opção A (manter como UUID sem FK, validar na aplicação)

**4.2. Atualizar queries de leads que usam produtos**

- Verificar se há queries que fazem JOIN com products
- Atualizar para buscar produtos via Edge Function quando necessário
- Ou manter `product_id` apenas como referência (sem JOIN)

### Fase 5: Remoção do Supabase

**5.1. Desabilitar RLS e políticas (opcional)**

- Manter tabela no Supabase temporariamente para rollback
- Ou remover imediatamente após validação

**5.2. Remover tabela `products` do Supabase**

- Criar migration: `supabase/migrations/20250125000001_remove_products_from_supabase.sql`
- Remover foreign key de `leads.product_id` (ou manter como UUID simples)
- Remover políticas RLS
- Remover triggers
- **IMPORTANTE:** Fazer apenas após validação completa da migração

**5.3. Limpar tipos TypeScript do Supabase**

- Remover `products` de `src/integrations/supabase/types.ts` (será regenerado)
- Atualizar imports se necessário

### Fase 6: Validação e Testes

**6.1. Testes funcionais**

- Criar produto
- Listar produtos
- Atualizar produto
- Deletar produto
- Filtrar por categoria
- Buscar produtos ativos
- Validar permissões (apenas membros da organização)

**6.2. Testes de integração**

- Produtos em orçamentos (ProductSelector)
- Produtos no onboarding
- Produtos vinculados a leads (se aplicável)

**6.3. Validação de performance**

- Comparar tempo de resposta (Supabase vs PostgreSQL)
- Verificar índices estão sendo usados

## Arquivos a Criar/Modificar

### Novos arquivos:

1. `supabase/migrations/20250125000000_create_products_table_postgres.sql`
2. `supabase/functions/products/index.ts`
3. `src/hooks/useProductsPostgres.ts` (ou substituir `useProducts.ts`)
4. `scripts/migrate-products-to-postgres.sh`
5. `supabase/migrations/20250125000001_remove_products_from_supabase.sql`

### Arquivos a modificar:

1. `src/hooks/useProducts.ts` - Substituir Supabase por Edge Function
2. `src/types/product.ts` - Verificar se precisa ajustes
3. Configuração Edge Function (variáveis de ambiente)

### Arquivos que NÃO precisam modificar (devem continuar funcionando):

1. `src/components/crm/ProductsManagement.tsx`
2. `src/components/budgets/ProductSelector.tsx`
3. `src/components/onboarding/ProductsStep.tsx`

## Considerações Importantes

### Segurança:

- Edge Function valida permissões via Supabase (organization_members)
- PostgreSQL não tem RLS (validação na aplicação)
- Manter validação de `organization_id` em todas as operações

### Performance:

- Índices criados para queries comuns (organization_id, category, is_active)
- Edge Function pode fazer cache se necessário
- Considerar paginação se houver muitos produtos

### Rollback:

- Manter tabela no Supabase até validação completa
- Script de rollback: migrar dados de volta do PostgreSQL para Supabase
- Documentar processo de rollback

### Compatibilidade:

- Manter mesma interface do hook `useProducts`
- Componentes não devem precisar de mudanças
- IDs UUID preservados na migração

## Ordem de Execução

1. ✅ Criar tabela no PostgreSQL (com constraints de organização)
2. ✅ Criar Edge Function com validações robustas de organização
3. ✅ Implementar validações obrigatórias (organization_id, permissões, rastreamento)
4. ✅ Criar novo hook (testar isoladamente)
5. ✅ Atualizar hook principal
6. ✅ Testar todos os componentes
7. ✅ Validar segurança (testar vazamento de dados entre organizações)
8. ✅ Atualizar produção
9. ✅ Validar produção (testar isolamento de dados)
10. ✅ Remover tabela do Supabase (após período de validação)

## Validação Final

- [ ] Edge Function funcionando com todas as validações
- [ ] Hook atualizado e funcionando
- [ ] Componentes funcionando
- [ ] Permissões validadas (apenas organização do usuário)
- [ ] Isolamento de dados testado (não vaza dados entre organizações)
- [ ] organization_name sendo sincronizado corretamente
- [ ] Rastreamento (created_by_name, updated_by_name) funcionando
- [ ] Validação de organization_id em todas as operações
- [ ] Performance aceitável
- [ ] Dados íntegros
- [ ] Testes de segurança passando (tentativas de acesso não autorizado)

### To-dos

- [ ] Criar migration SQL para tabela products no PostgreSQL (budget_services)
- [ ] Criar Edge Function products/index.ts com endpoints CRUD completos
- [ ] Criar script de migração de dados do Supabase para PostgreSQL
- [ ] Criar hook useProductsPostgres que usa Edge Function ao invés de Supabase
- [ ] Atualizar useProducts.ts para usar Edge Function (substituir Supabase)
- [ ] Executar migração de dados em ambiente de desenvolvimento e validar
- [ ] Testar todos os componentes que usam produtos (ProductsManagement, ProductSelector, ProductsStep)
- [ ] Decidir e implementar tratamento de leads.product_id (manter UUID sem FK)
- [ ] Executar migração de dados em produção
- [ ] Criar migration para remover tabela products do Supabase (após validação)