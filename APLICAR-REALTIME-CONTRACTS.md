# Aplicar Realtime na Tabela Contracts

Este documento explica como habilitar realtime na tabela `contracts` para que a contagem de contratos nas categorias seja atualizada em tempo real.

## Problema

Quando um contrato é criado com uma categoria, o contador da categoria não é atualizado automaticamente. Isso acontece porque a tabela `contracts` não está habilitada para realtime no Supabase.

## Solução

Execute o script SQL `APLICAR-REALTIME-CONTRACTS.sql` no Supabase SQL Editor para habilitar realtime na tabela `contracts`.

## Passos para Aplicar

1. **Acesse o Supabase Dashboard**
   - Vá para https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Execute o Script**
   - Copie o conteúdo do arquivo `APLICAR-REALTIME-CONTRACTS.sql`
   - Cole no SQL Editor
   - Clique em "Run" ou pressione `Ctrl+Enter` (Windows/Linux) ou `Cmd+Enter` (Mac)

4. **Verifique o Resultado**
   - O script deve retornar uma tabela com:
     - `table_name`: contracts
     - `replica_identity`: FULL
     - `realtime_status`: ENABLED

## O Que o Script Faz

1. **Configura REPLICA IDENTITY FULL**
   - Necessário para que o Supabase possa rastrear mudanças na tabela
   - Permite que o realtime funcione corretamente com UPDATE e DELETE

2. **Adiciona a Tabela à Publicação Realtime**
   - Adiciona `contracts` à publicação `supabase_realtime`
   - Isso permite que o Supabase envie eventos em tempo real quando contratos são criados, atualizados ou deletados

## Verificação

Após executar o script, você pode verificar se está funcionando:

1. **No Supabase Dashboard:**
   - Vá para "Database" > "Replication"
   - Verifique se `contracts` está listada como habilitada

2. **Testando no Aplicativo:**
   - Crie um contrato com uma categoria
   - Abra a página de Categorias
   - O contador deve ser atualizado automaticamente em tempo real

## Troubleshooting

### Se o realtime não funcionar:

1. **Verifique se a migration foi aplicada:**
   ```sql
   SELECT 
     'contracts' as table_name,
     CASE 
       WHEN relreplident = 'f' THEN 'FULL'
       ELSE 'NOT FULL'
     END as replica_identity,
     CASE 
       WHEN EXISTS (
         SELECT 1 FROM pg_publication_tables 
         WHERE pubname = 'supabase_realtime' 
         AND schemaname = 'public' 
         AND tablename = 'contracts'
       ) THEN 'ENABLED'
       ELSE 'DISABLED'
     END as realtime_status
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' 
     AND c.relname = 'contracts';
   ```

2. **Se realtime_status for DISABLED:**
   - Execute novamente o script `APLICAR-REALTIME-CONTRACTS.sql`

3. **Se replica_identity não for FULL:**
   - Execute novamente o script `APLICAR-REALTIME-CONTRACTS.sql`

## Notas Importantes

- O realtime funciona automaticamente após a configuração
- Não é necessário reiniciar o aplicativo
- A atualização acontece em tempo real (sem necessidade de recarregar a página)
- O hook `useContractCategories` já está configurado para usar realtime
- Há também um fallback que atualiza manualmente após criar um contrato

## Arquivos Relacionados

- `supabase/migrations/20260121000003_enable_realtime_contracts.sql` - Migration automática
- `APLICAR-REALTIME-CONTRACTS.sql` - Script manual para aplicar
- `src/hooks/useContractCategories.ts` - Hook que usa realtime
- `src/components/contracts/CreateContractDialog.tsx` - Atualiza categorias após criar contrato
