# 🔧 Aplicar Migration RLS Post-Sale - Instruções Manuais

## ⚠️ Problema

O erro `new row violates row-level security policy for table "lead_follow_ups"` ocorre porque as políticas RLS de `lead_follow_ups` não incluem verificação para `post_sale_leads`.

## ✅ Solução

Aplicar a migration `20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql` que atualiza as políticas RLS para incluir `post_sale_leads`.

## 📋 Método 1: Via Supabase Dashboard (RECOMENDADO)

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql`
4. Clique em **Run** para executar

## 📋 Método 2: Via Supabase CLI (se histórico de migrations estiver sincronizado)

```bash
cd /root/kanban-buzz-95241
./scripts/aplicar-migration-rls-post-sale-direto.sh
```

## 📋 Método 3: Aplicar SQL Diretamente

Se os métodos acima não funcionarem, você pode aplicar o SQL diretamente:

1. Copie o conteúdo de `supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql`
2. Cole no Supabase SQL Editor
3. Execute

## ✅ Verificação

Após aplicar, teste aplicando um template de follow-up em um cliente de pós-venda. O erro não deve mais ocorrer.

## 🔍 O que a migration faz:

1. Remove as políticas RLS antigas de `lead_follow_ups`
2. Cria novas políticas que verificam tanto `leads` quanto `post_sale_leads`
3. Atualiza políticas de `lead_follow_up_step_completions` também

## 📝 Arquivo da Migration

Localização: `supabase/migrations/20251230100000_fix_lead_follow_ups_rls_for_post_sale.sql`

