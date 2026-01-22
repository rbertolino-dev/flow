# 🔍 Diagnóstico: Campanha Não Aparece nos Logs

## Problema Identificado

A edge function `process-scheduled-campaigns` usa esta query:

```typescript
const now = new Date().toISOString(); // Ex: "2026-01-22T20:40:00.000Z"
const { data } = await supabase
  .from("broadcast_campaigns")
  .select("...")
  .eq("status", "draft")
  .not("scheduled_start_at", "is", null)
  .lte("scheduled_start_at", now); // <= comparação
```

## Possíveis Problemas

### 1. **Timezone Confusion**
- Usuário agenda: 20:40 (horário do Brasil)
- Sistema salva: 23:40 UTC (20:40 + 3 horas)
- Função compara: `scheduled_start_at <= NOW()` em UTC
- **Se agora é 20:40 UTC, a campanha agendada para 23:40 UTC ainda não será encontrada!**

### 2. **Formato de Comparação**
- `new Date().toISOString()` retorna: `"2026-01-22T20:40:00.000Z"`
- PostgreSQL compara `TIMESTAMPTZ` com string ISO
- Pode haver problema de precisão (milissegundos)

### 3. **Cron Job Não Executando**
- Verificar se o cron job está ativo
- Verificar se está chamando a função corretamente

## Scripts de Diagnóstico Criados

1. **VERIFICAR-CAMPANHA-AGENDADA-AGORA.sql**
   - Mostra campanha e horários (UTC e BRT)
   - Verifica se já passou o horário

2. **VERIFICAR-LOGS-EDGE-FUNCTION.sql**
   - Mostra últimas execuções do cron job
   - Verifica se está executando

3. **DIAGNOSTICO-COMPLETO-CAMPANHA.sql**
   - Diagnóstico completo: campanha vs horário vs execuções

4. **TESTAR-QUERY-MANUAL.sql**
   - Testa a query exata que a função usa
   - Mostra o que deveria ser encontrado

## Como Diagnosticar

1. Execute `DIAGNOSTICO-COMPLETO-CAMPANHA.sql` no Supabase SQL Editor
2. Verifique:
   - ✅ Campanha existe e está com `status = 'draft'`?
   - ✅ `scheduled_start_at` não é NULL?
   - ✅ `scheduled_start_at <= NOW()` (em UTC)?
   - ✅ Cron job está executando?

3. Se tudo estiver OK mas não processar, pode ser problema de precisão de milissegundos na comparação.

## Possível Correção

Se o problema for precisão de milissegundos, podemos ajustar a query para usar `NOW()` diretamente ao invés de `toISOString()`:

```typescript
// Ao invés de:
const now = new Date().toISOString();
.lte("scheduled_start_at", now)

// Usar:
.lte("scheduled_start_at", new Date().toISOString().slice(0, 19) + 'Z') // Remove milissegundos
// Ou melhor ainda, usar função PostgreSQL:
.leq("scheduled_start_at", "now()") // Mas Supabase não suporta funções SQL diretas
```

Ou adicionar um buffer de alguns segundos para garantir que pegue campanhas que acabaram de passar o horário.
