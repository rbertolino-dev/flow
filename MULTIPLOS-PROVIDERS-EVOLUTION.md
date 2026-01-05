# ✅ Implementação: Múltiplos Evolution Providers por Organização

## 📋 Resumo das Mudanças

Implementada funcionalidade para permitir que cada organização tenha **múltiplos Providers Evolution (WhatsApp)** cadastrados, ao invés de apenas um.

### 🎯 O Que Foi Implementado

1. **Nova Tabela**: `organization_evolution_providers` (many-to-many)
   - Permite relacionar múltiplos providers a uma organização
   - Mantém compatibilidade com estrutura antiga durante migração

2. **Componente Super Admin Atualizado**:
   - `OrganizationLimitsPanel` agora usa **checkboxes** para seleção múltipla
   - Interface permite selecionar/deselecionar múltiplos providers
   - Salva todos os providers selecionados na nova tabela

3. **Dialog de Criação de Instância Atualizado**:
   - `EvolutionInstanceDialog` permite **escolher entre múltiplos providers**
   - Se houver apenas 1 provider, seleciona automaticamente
   - Se houver múltiplos, usuário escolhe qual usar
   - Se não houver nenhum, permite entrada manual

4. **Função RPC Atualizada**:
   - `get_organization_evolution_provider` agora retorna **todos os providers** (não apenas 1)
   - Mantém fallback para estrutura antiga durante migração

### 📁 Arquivos Criados/Modificados

**Migrations:**
- `supabase/migrations/20250131000001_create_organization_evolution_providers.sql`
- `supabase/migrations/20250131000002_update_get_organization_evolution_provider.sql`

**Componentes:**
- `src/components/superadmin/OrganizationLimitsPanel.tsx` - Checkboxes para múltipla seleção
- `src/components/crm/EvolutionInstanceDialog.tsx` - Select para escolher provider

**Scripts:**
- `scripts/aplicar-migrations-multiplos-providers-sql.sh` - Gera SQL combinado

### 🚀 Como Aplicar as Migrations

#### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Execute o conteúdo de cada migration em ordem:

**Migration 1:**
```sql
-- Conteúdo de: supabase/migrations/20250131000001_create_organization_evolution_providers.sql
```

**Migration 2:**
```sql
-- Conteúdo de: supabase/migrations/20250131000002_update_get_organization_evolution_provider.sql
```

#### Opção 2: Via Script (SQL Combinado)

O script `aplicar-migrations-multiplos-providers-sql.sh` já gerou um arquivo SQL combinado em:
```
/tmp/migration_multiplos_providers.sql
```

Execute este arquivo no Supabase SQL Editor.

### ✅ Funcionalidades

**No Super Admin:**
- ✅ Selecionar múltiplos providers para cada organização
- ✅ Ver quais providers estão selecionados (badge "Selecionado")
- ✅ Desmarcar providers para remover da organização
- ✅ Salvar todas as seleções de uma vez

**Ao Criar Instância WhatsApp:**
- ✅ Se houver 1 provider: usa automaticamente
- ✅ Se houver múltiplos: usuário escolhe qual usar
- ✅ Se não houver nenhum: permite entrada manual de URL/API Key

**Migração Automática:**
- ✅ Dados existentes em `organization_limits.evolution_provider_id` são migrados automaticamente
- ✅ Mantém compatibilidade com estrutura antiga durante transição

### 🔄 Fluxo Completo

1. **Super Admin configura providers:**
   - Acessa organização no Super Admin
   - Vai em aba "Limites"
   - Marca checkboxes dos providers desejados
   - Salva

2. **Usuário cria instância:**
   - Abre dialog de criar instância WhatsApp
   - Se houver providers configurados, vê select para escolher
   - Seleciona provider desejado
   - URL e API Key são preenchidos automaticamente
   - Informa apenas o nome da instância
   - Cria instância

3. **Todos os providers funcionam:**
   - Cada provider cadastrado pode ser usado
   - Organização pode ter quantos providers quiser
   - Usuário escolhe qual usar ao criar cada instância

### 📝 Notas Importantes

- ✅ **Compatibilidade**: Mantém compatibilidade com estrutura antiga durante migração
- ✅ **RLS**: Políticas de segurança configuradas corretamente
- ✅ **Migração de Dados**: Providers existentes são migrados automaticamente
- ✅ **Interface**: Checkboxes intuitivos no Super Admin, Select no dialog de criação

### 🎉 Pronto para Deploy!

Após aplicar as migrations, a funcionalidade estará 100% operacional.

