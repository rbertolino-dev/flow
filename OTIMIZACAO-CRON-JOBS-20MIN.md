# Otimização de Cron Jobs - Intervalo de 20 Minutos

## Mudança Aplicada

Os cron jobs foram otimizados para rodar a cada **20 minutos** (antes: 5 minutos).

## Cron Jobs Afetados

1. `process-whatsapp-workflows` - Processa workflows agendados
2. `process-status-schedule` - Processa status do WhatsApp agendados

## Como Configurar no Supabase

### Opção 1: Via Dashboard do Supabase

1. Acesse: **Database** → **Cron Jobs**
2. Para cada cron job, edite o schedule:
   - **Antes**: `*/5 * * * *` (a cada 5 minutos)
   - **Depois**: `*/20 * * * *` (a cada 20 minutos)

### Opção 2: Via SQL

```sql
-- Remover cron jobs antigos (se existirem)
SELECT cron.unschedule('process-whatsapp-workflows');
SELECT cron.unschedule('process-status-schedule');

-- Criar cron jobs com intervalo de 20 minutos
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'process-status-schedule',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-status-schedule',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Para pegar SERVICE_ROLE_KEY:**
- Dashboard → **Settings** → **API** → Role: `service_role`

## Impacto

- **Antes**: 288 execuções/dia por cron job (a cada 5min)
- **Depois**: 72 execuções/dia por cron job (a cada 20min)
- **Redução**: 75% de redução
- **Economia estimada**: ~$6.92/mês (2 cron jobs)

## Nota Importante

As funções já têm verificação automática: se não houver itens pendentes, retornam imediatamente sem processar nada (economia adicional).

