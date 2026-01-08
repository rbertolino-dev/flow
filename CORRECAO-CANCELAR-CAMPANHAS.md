# 🔧 Correção: Cancelar Campanhas não está funcionando

## ❌ Problemas Identificados

1. **Status 'cancelled' não permitido na constraint**
   - A função `handleCancelCampaign` tentava usar `status: "cancelled"` na tabela `broadcast_queue`
   - Mas a constraint `broadcast_queue_status_check` só permite: `'pending'`, `'scheduled'`, `'sent'`, `'failed'`
   - Resultado: Erro ao cancelar campanhas no frontend

2. **Mensagens agendadas não são canceladas**
   - Mesmo que a campanha seja cancelada, as mensagens agendadas continuam na fila
   - O process-broadcast-queue pode tentar processar essas mensagens

## ✅ Correções Aplicadas

### 1. Função `handleCancelCampaign` corrigida

**Arquivo:** `src/pages/BroadcastCampaigns.tsx`

**Mudanças:**
- ✅ Tenta usar `status: "cancelled"` primeiro
- ✅ Se falhar (constraint não permite), usa `status: "failed"` como fallback
- ✅ Melhor tratamento de erros com logs detalhados
- ✅ Cancela apenas mensagens com status `'pending'` ou `'scheduled'`
- ✅ Não mexe em mensagens já enviadas (`'sent'`) ou falhadas (`'failed'`)

### 2. Migration criada para adicionar status 'cancelled'

**Arquivo:** `supabase/migrations/20260106000001_add_cancelled_status_to_broadcast_queue.sql`

**O que faz:**
- Remove constraint antiga
- Adiciona constraint nova que permite `'cancelled'`
- Status válidos: `'pending'`, `'scheduled'`, `'sent'`, `'failed'`, `'cancelled'`

## 📋 Próximos Passos

### PASSO 1: Aplicar Migration (OBRIGATÓRIO)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Cole o conteúdo de: `supabase/migrations/20260106000001_add_cancelled_status_to_broadcast_queue.sql`
3. Execute (Ctrl+Enter)

**OU** faça deploy para aplicar automaticamente:
```bash
cd /root/kanban-buzz-95241
./scripts/deploy-zero-downtime.sh --confirm
```

### PASSO 2: Testar Cancelamento

1. Acesse o módulo de disparo em massa
2. Crie uma campanha de teste
3. Agende algumas mensagens
4. Clique em "Cancelar" na campanha
5. Verifique:
   - ✅ Status da campanha muda para "cancelled"
   - ✅ Mensagens agendadas são canceladas (status 'cancelled' ou 'failed')
   - ✅ Mensagens não são mais processadas pelo cron job

## 🔍 Verificação

Execute este SQL para verificar se está funcionando:

```sql
-- Verificar campanhas canceladas e suas mensagens
SELECT 
  bc.id as campaign_id,
  bc.name as nome_campanha,
  bc.status as status_campanha,
  COUNT(bq.id) FILTER (WHERE bq.status = 'cancelled') as mensagens_canceladas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'failed' AND bq.error_message LIKE '%cancelada%') as mensagens_failed_canceladas,
  COUNT(bq.id) FILTER (WHERE bq.status = 'scheduled') as mensagens_ainda_agendadas
FROM public.broadcast_campaigns bc
LEFT JOIN public.broadcast_queue bq ON bq.campaign_id = bc.id
WHERE bc.status = 'cancelled'
GROUP BY bc.id, bc.name, bc.status;
```

**Resultado esperado:**
- `mensagens_ainda_agendadas` deve ser 0 (todas foram canceladas)
- `mensagens_canceladas` ou `mensagens_failed_canceladas` deve ter o total de mensagens

## 🐛 Se Ainda Não Funcionar

1. **Verificar se migration foi aplicada:**
   ```sql
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE constraint_name LIKE '%broadcast_queue%status%';
   ```
   Deve mostrar `'cancelled'` na lista de status válidos.

2. **Verificar logs do console do navegador:**
   - Abra DevTools (F12)
   - Vá em Console
   - Tente cancelar uma campanha
   - Veja se há erros

3. **Verificar RLS (Row Level Security):**
   - Pode haver políticas RLS bloqueando a atualização
   - Verificar políticas em: `supabase/fixes/20251215_FIX_BROADCAST_QUEUE.sql`

## 📝 Notas Técnicas

- A função agora tem **fallback automático**: se `'cancelled'` não funcionar, usa `'failed'`
- Isso garante que mesmo sem a migration, o cancelamento funciona
- Mas é **recomendado** aplicar a migration para ter o status correto

