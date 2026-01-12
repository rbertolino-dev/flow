# 🚀 Implementação Passo a Passo: Sistema de Failover

## 📋 Checklist de Implementação

### ✅ FASE 1: Estrutura de Dados (CONCLUÍDA)
- [x] Migration SQL criada (`20260110000004_add_failover_system.sql`)
- [x] Campos adicionados em `broadcast_campaigns`
- [x] Tabela `broadcast_failover_logs` criada
- [x] Campos adicionados em `broadcast_queue`
- [x] Índices criados
- [x] Funções SQL auxiliares criadas

### 🔄 FASE 2: Lógica de Failover (EM PROGRESSO)
- [ ] Criar funções auxiliares de failover (TypeScript)
- [ ] Integrar failover na edge function `process-broadcast-queue`
- [ ] Implementar health check contínuo
- [ ] Implementar detecção de falhas
- [ ] Implementar troca automática
- [ ] Implementar deduplicação

### ⏳ FASE 3: UI e Controles (PENDENTE)
- [ ] Criar componente `CampaignFailoverControl`
- [ ] Criar hook `useCampaignFailover`
- [ ] Integrar na página `BroadcastCampaigns.tsx`
- [ ] Criar modal de histórico de failover

### ⏳ FASE 4: Testes e Validação (PENDENTE)
- [ ] Testes unitários das funções de failover
- [ ] Testes de integração
- [ ] Testes end-to-end
- [ ] Validação de casos de borda

---

## 📝 PRÓXIMOS ARQUIVOS A CRIAR

### 1. `supabase/functions/_shared/failover-utils.ts`
Funções auxiliares para failover:
- `checkInstanceHealth()`
- `detectPrimaryFailure()`
- `executeFailover()`
- `canReturnToPrimary()`
- `logFailover()`

### 2. Atualizar `supabase/functions/process-broadcast-queue/index.ts`
Integrar lógica de failover no processamento

### 3. `src/hooks/useCampaignFailover.ts`
Hook React para gerenciar failover

### 4. `src/components/crm/CampaignFailoverControl.tsx`
Componente UI para controles de failover

---

## 🔧 DETALHES DE IMPLEMENTAÇÃO

### Health Check System

**Intervalo**: A cada 30 segundos para campanhas RUNNING
**Timeout**: 8 segundos
**Endpoint**: `/instance/connectionState/{instance_name}`

### Critérios de Falha

1. **3 Health Checks Consecutivos Falharam**
2. **Taxa de Erro > 30%** (últimos 5 minutos, mínimo 10 tentativas)
3. **Timeout > 15s** em 2 tentativas consecutivas
4. **Erro de Conexão** (Connection Closed) em 2 tentativas consecutivas

### Cooldown Progressivo

- 1ª troca: 5 minutos
- 2ª troca: 10 minutos
- 3ª+ trocas: 15 minutos
- 5+ trocas: 30 minutos

### Deduplicação

Hash: `SHA256(campaign_id + phone + message_content)`
Verificar antes de cada envio para prevenir duplicatas.

---

## 📊 ORDEM DE EXECUÇÃO

1. **Aplicar Migration** (já criada)
2. **Criar Funções Auxiliares** (failover-utils.ts)
3. **Atualizar Edge Function** (process-broadcast-queue)
4. **Criar Hook React** (useCampaignFailover)
5. **Criar Componente UI** (CampaignFailoverControl)
6. **Integrar na Página** (BroadcastCampaigns.tsx)
7. **Testar e Validar**


