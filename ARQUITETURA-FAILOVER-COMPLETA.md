# 🏗️ Arquitetura Completa: Sistema de Failover para Disparo em Massa

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Estrutura de Dados](#estrutura-de-dados)
3. [Regras de Saúde e Detecção de Falha](#regras-de-saúde-e-detecção-de-falha)
4. [Lógica de Failover](#lógica-de-failover)
5. [UI e Controles Manuais](#ui-e-controles-manuais)
6. [Casos de Borda](#casos-de-borda)
7. [Critérios de Aceite](#critérios-de-aceite)

---

## 🎯 VISÃO GERAL

### Objetivo
Sistema de failover que permite troca automática ou manual entre instância PRIMARY e BACKUP durante campanhas de disparo em massa, garantindo continuidade sem duplicação de mensagens.

### Componentes Principais
1. **Health Check System**: Monitora saúde das instâncias
2. **Failure Detection**: Detecta quando PRIMARY cai
3. **Failover Engine**: Executa troca automática/manual
4. **Queue Manager**: Gerencia retomada da fila
5. **Deduplication System**: Previne mensagens duplicadas
6. **Audit System**: Registra todas as trocas

---

## 🗄️ ESTRUTURA DE DADOS

### 1. Campos Adicionados em `broadcast_campaigns`

```sql
-- Instância de backup
backup_instance_id UUID REFERENCES evolution_config(id),
-- Failover habilitado (global ou por campanha)
failover_enabled BOOLEAN DEFAULT false,
-- Modo: 'auto' ou 'manual'
failover_mode TEXT DEFAULT 'auto' CHECK (failover_mode IN ('auto', 'manual')),
-- Instância atualmente ativa (pode ser diferente de instance_id após failover)
current_active_instance_id UUID REFERENCES evolution_config(id),
-- Timestamp da última troca
last_failover_at TIMESTAMPTZ,
-- Cooldown: não voltar para PRIMARY antes deste timestamp
failover_cooldown_until TIMESTAMPTZ,
-- Contador de falhas consecutivas da PRIMARY
primary_failure_count INTEGER DEFAULT 0,
-- Última verificação de saúde
last_health_check_at TIMESTAMPTZ
```

### 2. Nova Tabela: `broadcast_failover_logs`

```sql
CREATE TABLE public.broadcast_failover_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Detalhes da troca
  from_instance_id UUID NOT NULL REFERENCES evolution_config(id),
  to_instance_id UUID NOT NULL REFERENCES evolution_config(id),
  failover_type TEXT NOT NULL CHECK (failover_type IN ('auto', 'manual')),
  triggered_by_user_id UUID REFERENCES auth.users(id), -- NULL se automático
  
  -- Motivo da troca
  reason TEXT NOT NULL, -- 'health_check_failed', 'manual_switch', 'timeout', 'error_rate', etc.
  failure_details JSONB, -- Detalhes técnicos (códigos HTTP, mensagens de erro, etc.)
  
  -- Estado da campanha no momento da troca
  queue_items_pending INTEGER,
  queue_items_sending INTEGER,
  queue_items_sent INTEGER,
  queue_items_failed INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadados
  metadata JSONB -- Informações adicionais (IP, user agent, etc.)
);
```

### 3. Campos Adicionados em `broadcast_queue`

```sql
-- Instância que tentou enviar (para rastreamento)
attempted_instance_id UUID REFERENCES evolution_config(id),
-- Número de tentativas de envio
send_attempts INTEGER DEFAULT 0,
-- Timestamp da última tentativa
last_attempt_at TIMESTAMPTZ,
-- Hash para deduplicação (campaign_id + phone + message_hash)
deduplication_hash TEXT,
-- Lock para evitar processamento concorrente
processing_lock_until TIMESTAMPTZ
```

---

## 🏥 REGRAS DE SAÚDE E DETECÇÃO DE FALHA

### Health Check System

#### 1. Verificações Contínuas
- **Intervalo**: A cada 30 segundos para campanhas RUNNING
- **Timeout**: 8 segundos por verificação
- **Endpoint**: `/instance/connectionState/{instance_name}`

#### 2. Critérios de Falha da PRIMARY

**Falha é detectada quando QUALQUER um destes critérios é atendido:**

##### A) Health Check Falhou (3 consecutivas)
- 3 verificações consecutivas retornam `is_connected = false`
- OU 3 timeouts consecutivos (> 8s)
- OU 3 erros HTTP (401, 404, 500, 503)

##### B) Taxa de Erro Alta (5 minutos)
- Taxa de erro > 30% nos últimos 5 minutos
- Cálculo: `(failed_count / total_attempts) > 0.30`
- Mínimo de 10 tentativas para considerar

##### C) Timeout Crítico
- Timeout > 15 segundos em 2 tentativas consecutivas
- OU timeout > 30 segundos em 1 tentativa

##### D) Erro de Conexão
- Erro "Connection Closed" em 2 tentativas consecutivas
- OU erro 401/403 (autenticação) em 1 tentativa

#### 3. Histerese e Cooldown

**Para evitar "flapping" (troca indo e voltando):**

- **Cooldown Inicial**: 5 minutos após failover automático
- **Cooldown Progressivo**: 
  - 1ª troca: 5 minutos
  - 2ª troca: 10 minutos
  - 3ª+ trocas: 15 minutos
- **Volta para PRIMARY apenas se:**
  1. Cooldown expirou (`failover_cooldown_until < now()`)
  2. PRIMARY está saudável há 3 verificações consecutivas (90s)
  3. Taxa de erro da PRIMARY < 5% nos últimos 5 minutos
  4. BACKUP não está com problemas (opcional, mas recomendado)

#### 4. Prioridade

- **PRIMARY é sempre preferida** quando saudável
- **BACKUP assume apenas quando necessário**
- **Após cooldown, sistema tenta voltar para PRIMARY automaticamente**

---

## 🔄 LÓGICA DE FAILOVER

### Fluxo Automático

```
1. Campanha RUNNING com failover_enabled = true
   ↓
2. Health Check detecta falha na PRIMARY
   ↓
3. Incrementa primary_failure_count
   ↓
4. Se primary_failure_count >= 3 OU critério de falha atendido:
   ↓
5. Verifica se BACKUP está disponível e saudável
   ↓
6. Se BACKUP OK:
   - Atualiza current_active_instance_id = backup_instance_id
   - Reseta primary_failure_count = 0
   - Define failover_cooldown_until = now() + 5min
   - Registra log em broadcast_failover_logs
   - Continua processamento com BACKUP
   ↓
7. Se BACKUP também caiu:
   - Pausa campanha (status = 'paused')
   - Registra log de erro crítico
   - Notifica administrador (opcional)
```

### Fluxo Manual

```
1. Usuário clica "Trocar Agora (PRIMARY ↔ BACKUP)"
   ↓
2. Sistema verifica:
   - Campanha está RUNNING?
   - BACKUP está disponível?
   ↓
3. Se OK, exibe confirmação:
   "Tem certeza? A campanha continuará com a instância alternativa."
   ↓
4. Usuário confirma
   ↓
5. Sistema executa troca:
   - Atualiza current_active_instance_id
   - Define failover_cooldown_until = now() + 5min
   - Registra log (failover_type = 'manual', triggered_by_user_id)
   - Continua processamento
```

### Retomada da Fila

**Quando ocorre failover, o sistema:**

1. **Mensagens PENDING**: Continuam normalmente (não foram tentadas)
2. **Mensagens SENDING**: 
   - Aguarda 30 segundos
   - Se não mudarem para SENT, volta para PENDING
   - Tenta novamente com nova instância
3. **Mensagens SENT**: Ignoradas (já enviadas)
4. **Mensagens FAILED**: 
   - Se falha foi por instância, volta para PENDING
   - Tenta novamente com nova instância
   - Máximo 3 tentativas por mensagem

---

## 🎨 UI E CONTROLES MANUAIS

### Componente: `CampaignFailoverControl`

**Localização**: Dentro de cada card de campanha em `BroadcastCampaigns.tsx`

**Elementos:**

1. **Toggle "Failover Automático"**
   - ON/OFF
   - Por campanha (sobrescreve configuração global)
   - Tooltip: "Quando ativado, troca automaticamente para instância de backup se a principal falhar"

2. **Botão "Trocar Agora (PRIMARY ↔ BACKUP)"**
   - Visível apenas quando:
     - Campanha tem `backup_instance_id` configurado
     - Campanha está RUNNING ou PAUSED
   - Ação: Troca imediata entre PRIMARY e BACKUP
   - Confirmação obrigatória

3. **Botão "Voltar para PRIMARY"** (opcional)
   - Visível apenas quando:
     - `current_active_instance_id != instance_id` (usando BACKUP)
     - Cooldown expirou OU usuário força
   - Ação: Volta para PRIMARY se estiver saudável

4. **Indicador Visual**
   - Badge mostrando instância ativa: "PRIMARY" ou "BACKUP"
   - Cor: Verde (PRIMARY) ou Amarelo (BACKUP)
   - Se BACKUP ativo, mostrar: "⚠️ Usando BACKUP (volta para PRIMARY em X min)"

5. **Histórico de Trocas**
   - Modal com últimos 10 logs de failover
   - Mostra: data, tipo (auto/manual), motivo, instâncias

---

## 🚨 CASOS DE BORDA

### 1. PRIMARY Cai no Meio do Envio

**Problema**: Mensagens com status `SENDING` podem estar "travadas"

**Solução**:
```typescript
// Após detectar falha da PRIMARY:
1. Marcar todas mensagens SENDING como PENDING (após 30s de timeout)
2. Atualizar attempted_instance_id = NULL
3. Incrementar send_attempts
4. Retomar processamento com BACKUP
```

### 2. BACKUP Também Cai

**Problema**: Ambas instâncias indisponíveis

**Solução**:
```typescript
1. Pausar campanha automaticamente (status = 'paused')
2. Registrar log crítico
3. Notificar administrador (email/webhook)
4. Aguardar até que pelo menos uma instância volte
5. Quando voltar, usuário pode retomar manualmente
```

### 3. Troca Manual Durante Envio

**Problema**: Garantir consistência durante troca ativa

**Solução**:
```typescript
1. Adquirir lock da campanha (campaign_lock)
2. Aguardar processamento atual terminar (máx 10s)
3. Executar troca
4. Liberar lock
5. Continuar processamento
```

### 4. Duplicidade por Retry

**Problema**: Mensagem pode ser enviada duas vezes

**Solução**:
```typescript
// Usar deduplication_hash
const hash = sha256(`${campaign_id}-${phone}-${message_content}`);
// Verificar antes de enviar:
const existing = await supabase
  .from('broadcast_queue')
  .select('id, status')
  .eq('deduplication_hash', hash)
  .eq('status', 'sent')
  .maybeSingle();

if (existing) {
  // Já foi enviada, marcar como SENT sem enviar novamente
  return { status: 'sent', duplicate: true };
}
```

### 5. Multi-Worker Concorrente

**Problema**: Múltiplos workers processando mesma mensagem

**Solução**:
```typescript
// Usar processing_lock_until
const lockUntil = new Date(Date.now() + 60000); // 1 minuto

// Adquirir lock
const { data } = await supabase
  .from('broadcast_queue')
  .update({ processing_lock_until: lockUntil.toISOString() })
  .eq('id', itemId)
  .eq('processing_lock_until', null) // Apenas se não estiver lockado
  .select()
  .maybeSingle();

if (!data) {
  // Já está sendo processado por outro worker
  return { skipped: true, reason: 'locked' };
}

// Processar...
// Ao final, liberar lock
await supabase
  .from('broadcast_queue')
  .update({ processing_lock_until: null })
  .eq('id', itemId);
```

### 6. Retomada Após Reinício

**Problema**: Sistema reiniciou, como continuar?

**Solução**:
```typescript
// Ao iniciar processamento:
1. Buscar campanhas RUNNING
2. Verificar current_active_instance_id
3. Se NULL, usar instance_id (PRIMARY)
4. Verificar saúde da instância ativa
5. Se instância ativa caiu, executar failover automático
6. Continuar processamento normalmente
```

### 7. Flapping (Instância Volta e Cai)

**Problema**: Troca constante entre PRIMARY e BACKUP

**Solução**:
```typescript
// Implementar cooldown progressivo
let cooldownMinutes = 5;
if (failoverCount >= 3) cooldownMinutes = 15;
if (failoverCount >= 5) cooldownMinutes = 30;

// Só voltar para PRIMARY se:
1. Cooldown expirou
2. PRIMARY estável há 3 verificações (90s)
3. Taxa de erro < 5% nos últimos 5 min
4. BACKUP não está com problemas
```

---

## ✅ CRITÉRIOS DE ACEITE

### Funcionalidade

1. ✅ **Failover Automático**
   - Se PRIMARY ficar DOWN, em até 90 segundos a campanha troca para BACKUP e continua
   - Nenhum destinatário recebe a mesma mensagem duas vezes
   - Logs registram todas as trocas automáticas

2. ✅ **Failover Manual**
   - Botão "Trocar Agora" funciona mesmo com campanha ativa
   - Confirmação obrigatória antes de trocar
   - Logs registram usuário que executou troca manual

3. ✅ **Toggle Failover**
   - Toggle OFF impede troca automática
   - Toggle ON permite troca automática
   - Configuração é salva por campanha

4. ✅ **Retomada da Fila**
   - Mensagens PENDING continuam normalmente
   - Mensagens SENDING são retentadas após timeout
   - Mensagens SENT são ignoradas
   - Mensagens FAILED são retentadas (máx 3x)

5. ✅ **Deduplicação**
   - Hash único por (campaign_id + phone + message)
   - Verificação antes de cada envio
   - Mensagens duplicadas são marcadas como SENT sem enviar

6. ✅ **Cooldown e Histerese**
   - Cooldown de 5-15 minutos após failover
   - Sistema não volta para PRIMARY imediatamente
   - Volta apenas quando PRIMARY estável há 90s

7. ✅ **Casos de Borda**
   - PRIMARY cai no meio: mensagens SENDING são retentadas
   - BACKUP também cai: campanha pausa automaticamente
   - Troca manual: lock previne inconsistências
   - Multi-worker: lock previne processamento duplicado
   - Retomada: sistema continua de onde parou

### Performance

- Health check não impacta performance (< 100ms overhead)
- Failover automático em < 90 segundos
- Troca manual em < 5 segundos
- Zero downtime durante troca

### Auditoria

- Todos os logs incluem: timestamp, usuário, motivo, instâncias
- Histórico completo disponível na UI
- Logs persistem por 90 dias

---

## 🔧 IMPLEMENTAÇÃO TÉCNICA

### 1. Migration SQL

Ver arquivo: `supabase/migrations/20260110000004_add_failover_system.sql`

### 2. Edge Function: Failover Logic

Ver arquivo: `supabase/functions/process-broadcast-queue/index.ts` (atualizado)

### 3. Componente React: UI Controls

Ver arquivo: `src/components/crm/CampaignFailoverControl.tsx` (novo)

### 4. Hooks: Failover Management

Ver arquivo: `src/hooks/useCampaignFailover.ts` (novo)

---

## 📊 MÉTRICAS E MONITORAMENTO

### Métricas a Coletar

1. **Taxa de Failover**: Quantas trocas por campanha
2. **Tempo de Detecção**: Quanto tempo leva para detectar falha
3. **Tempo de Recuperação**: Quanto tempo leva para trocar
4. **Taxa de Sucesso**: % de mensagens enviadas com sucesso após failover
5. **Flapping Rate**: Quantas trocas desnecessárias (PRIMARY ↔ BACKUP)

### Alertas

- Failover automático executado (notificar admin)
- BACKUP também caiu (alerta crítico)
- Taxa de failover > 3 por hora (investigar)
- Cooldown expirou e PRIMARY ainda não estável (aviso)

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Criar migration SQL
2. ✅ Atualizar edge function process-broadcast-queue
3. ✅ Criar componente UI
4. ✅ Implementar hooks
5. ✅ Testes end-to-end
6. ✅ Documentação de uso


