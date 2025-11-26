# 📊 Sistema de Monitoramento de Saúde de Instâncias WhatsApp

## ✅ Implementação Completa

Sistema otimizado de monitoramento de saúde das instâncias Evolution API para detectar riscos de banimento do WhatsApp, com **redução de ~99% nos custos** comparado a abordagens não otimizadas.

## 🎯 Funcionalidades

### 1. Coleta Passiva de Métricas (Zero Custo Adicional)
- Métricas coletadas durante o processamento normal de mensagens
- Nenhum polling adicional necessário
- Acumulação em memória e salvamento em batch

### 2. Agregação por Hora
- 1 registro por instância por hora (em vez de 1 por mensagem)
- Reduz writes no banco em ~99%
- Tabela: `instance_health_metrics_hourly`

### 3. Cálculo de Score de Risco
- Função SQL otimizada: `get_instance_risk_score()`
- Retorna tudo em 1 query (em vez de múltiplas)
- Score de 0-100 baseado em múltiplos fatores

### 4. Dashboard Visual
- Componente React com cache de 5 minutos
- Exibe métricas em tempo real
- Alertas automáticos para riscos

## 📁 Arquivos Criados

### Migrações SQL
- `supabase/migrations/20250115000000_create_instance_health_metrics.sql`
  - Tabela `instance_health_metrics_hourly` com agregação por hora
  - Índices otimizados
  - RLS policies configuradas

- `supabase/migrations/20250115000001_create_instance_risk_score_function.sql`
  - Função `get_instance_risk_score()` para cálculo otimizado

### Código Frontend
- `src/hooks/useInstanceHealthMetrics.ts`
  - Hook React com cache de 5 minutos
  - Funções auxiliares para análise de risco

- `src/components/crm/InstanceHealthDashboard.tsx`
  - Componente visual completo
  - Alertas e badges de risco
  - Métricas detalhadas

### Código Backend
- `supabase/functions/process-broadcast-queue/index.ts` (modificado)
  - Coleta de métricas durante processamento
  - Salvamento em batch ao final

## 🔍 Métricas Monitoradas

1. **Taxa de Erro**: `(falhas / total) * 100`
2. **Taxa de Sucesso**: `(sucessos / total) * 100`
3. **Rate Limits**: Contador de HTTP 429
4. **Falhas Consecutivas**: Máximo de falhas seguidas
5. **Códigos HTTP**: 200, 401, 404, 429, 500
6. **Tempo de Resposta**: Média em milissegundos

## 📊 Score de Risco

### Fatores Considerados
- **Taxa de erro** (0-30 pontos)
  - >20% = 30 pontos
  - >15% = 20 pontos
  - >10% = 10 pontos

- **Falhas consecutivas** (0-25 pontos)
  - ≥10 = 25 pontos
  - ≥5 = 15 pontos

- **Desconexões frequentes** (0-20 pontos)
  - >5 mudanças = 20 pontos
  - >3 mudanças = 10 pontos

- **Rate limits** (0-15 pontos)
  - Qualquer ocorrência = 15 pontos

- **Volume alto + erro alto** (0-10 pontos)
  - >100 msg/hora + >10% erro = 10 pontos

### Níveis de Risco
- **0-30**: 🟢 Saudável
- **31-60**: 🟡 Atenção
- **61-80**: 🟠 Risco Alto
- **81-100**: 🔴 Crítico

## 💰 Otimizações de Custo

### Antes (Não Otimizado)
```
- Polling a cada 30s: 2.880 chamadas/dia
- 1 write por mensagem: 1.000 writes/dia
- 10 queries por métrica: 10.000 reads/dia
Total: ~$0.50-1.00/dia por instância
```

### Depois (Otimizado)
```
- Coleta passiva: 0 chamadas adicionais
- 1 write por hora: 24 writes/dia
- 1 query agregada: ~10 reads/dia (com cache)
Total: ~$0.001-0.01/dia por instância
```

**Redução: ~99% de custos** ✅

## 🚀 Como Usar

### 1. Aplicar Migrações
Execute as migrações SQL no Supabase:
```sql
-- Aplicar migração 1
-- Aplicar migração 2
```

### 2. Acessar Dashboard
1. Vá para a página de Campanhas de Disparo
2. Clique na aba **"Saúde"**
3. Visualize métricas de todas as instâncias

### 3. Monitoramento Automático
- Métricas são coletadas automaticamente durante envios
- Dashboard atualiza a cada 5 minutos (cache)
- Clique em "Refresh" para atualizar manualmente

## 📈 Próximos Passos (Opcional)

1. **Alertas por Email**: Notificar quando risco crítico
2. **Bloqueio Automático**: Pausar campanhas quando risco >80
3. **Gráficos Históricos**: Visualizar tendências ao longo do tempo
4. **Exportação de Relatórios**: PDF/CSV com métricas

## 🔧 Manutenção

### Limpar Dados Antigos
```sql
-- Manter apenas últimos 30 dias
DELETE FROM instance_health_metrics_hourly
WHERE hour_bucket < NOW() - INTERVAL '30 days';
```

### Verificar Métricas
```sql
-- Ver métricas de uma instância
SELECT * FROM get_instance_risk_score(
  'uuid-da-instancia'::UUID,
  24 -- últimas 24 horas
);
```

## 📝 Notas Técnicas

- **Cache**: Frontend cacheia por 5 minutos para reduzir chamadas
- **Batch**: Métricas salvas em batch ao final de cada processamento
- **Upsert**: Usa `ON CONFLICT` para evitar duplicatas
- **RLS**: Políticas de segurança configuradas corretamente

## ⚠️ Importante

- Métricas só são coletadas quando há atividade (envio de mensagens)
- Instâncias sem atividade não terão métricas
- Score de risco é calculado em tempo real quando solicitado
- Cache pode ser ajustado no hook (`cacheMinutes`)

