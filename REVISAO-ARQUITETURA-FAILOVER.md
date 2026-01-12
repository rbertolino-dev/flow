# 🔍 Revisão Crítica da Arquitetura de Failover

## ✅ PONTOS FORTES DA ARQUITETURA

### 1. **Estrutura de Dados Bem Definida**
- ✅ Campos claros e bem documentados
- ✅ Tabela de auditoria completa (`broadcast_failover_logs`)
- ✅ Índices otimizados para performance
- ✅ Funções SQL auxiliares para lógica de negócio

### 2. **Detecção de Falhas Robusta**
- ✅ Múltiplos critérios (health check, taxa de erro, timeout, conexão)
- ✅ Evita falsos positivos com múltiplas verificações
- ✅ Cooldown progressivo previne flapping

### 3. **Casos de Borda Cobertos**
- ✅ Mensagens em andamento (SENDING)
- ✅ Ambas instâncias caem
- ✅ Multi-worker concorrente
- ✅ Retomada após reinício

### 4. **Auditoria Completa**
- ✅ Logs detalhados de todas as trocas
- ✅ Rastreamento de usuário (manual) vs sistema (automático)
- ✅ Estado da campanha no momento da troca

---

## ⚠️ PONTOS QUE PRECISAM DE ATENÇÃO

### 1. **Integração com Sistema Atual de Instâncias**

**PROBLEMA IDENTIFICADO:**
- O sistema atual usa `instance_id` diretamente na `broadcast_queue`
- No modo "separate", múltiplas instâncias podem estar na mesma campanha
- A arquitetura assume PRIMARY/BACKUP simples (1:1)

**SOLUÇÃO NECESSÁRIA:**
```typescript
// A arquitetura precisa considerar:
// 1. Campanhas com múltiplas instâncias (modo "separate")
// 2. Cada instância pode ter seu próprio BACKUP
// 3. Failover deve ser por instância, não por campanha inteira

// Proposta: Failover por instância na fila
// - Cada item da fila tem instance_id
// - Se instance_id falhar, trocar para backup_instance_id daquela instância
// - Não trocar toda a campanha, apenas os itens daquela instância
```

**ALTERNATIVA (Mais Simples):**
- Manter failover apenas para campanhas com `sending_method = "single"`
- Para campanhas "separate" ou "rotate", failover seria mais complexo

### 2. **Como Determinar Instância Ativa na Fila**

**PROBLEMA:**
- A `broadcast_queue` já tem `instance_id` definido na criação
- Após failover, precisamos usar `current_active_instance_id` da campanha
- Mas a fila já foi criada com `instance_id` original

**SOLUÇÃO PROPOSTA:**
```typescript
// Na edge function process-broadcast-queue:
// 1. Buscar campanha com current_active_instance_id
// 2. Se current_active_instance_id != instance_id do item:
//    - Atualizar instance_id do item para current_active_instance_id
//    - OU usar current_active_instance_id diretamente na query
// 3. Buscar instância usando current_active_instance_id (não instance_id do item)
```

**ALTERNATIVA:**
- Adicionar campo `effective_instance_id` na fila que é atualizado no failover
- OU sempre usar `current_active_instance_id` da campanha ao processar

### 3. **Health Check Contínuo - Onde Executar?**

**PROBLEMA:**
- Health check a cada 30s para campanhas RUNNING
- Onde executar? Edge function? Cron job? Frontend?

**SOLUÇÃO RECOMENDADA:**
```typescript
// Opção 1: Cron Job Dedicado (RECOMENDADO)
// - Cron job a cada 30s verifica campanhas RUNNING com failover_enabled
// - Executa health check e failover se necessário
// - Vantagem: Não depende de processamento de fila

// Opção 2: Na Edge Function process-broadcast-queue
// - Verifica health antes de processar cada batch
// - Vantagem: Já está no contexto
// - Desvantagem: Só verifica quando há itens para processar

// Opção 3: Frontend (NÃO RECOMENDADO)
// - Usuário precisa estar na página
// - Não funciona se usuário fechar navegador
```

**RECOMENDAÇÃO:** Criar edge function `check-campaign-health` chamada por cron job

### 4. **Deduplicação - Quando Calcular Hash?**

**PROBLEMA:**
- Hash precisa ser calculado antes de enviar
- Mas mensagem pode ser personalizada (`{nome}` substituído)
- Hash deve ser do conteúdo final ou do template?

**SOLUÇÃO:**
```typescript
// Hash deve ser do conteúdo FINAL (após personalização)
// Mas verificar ANTES de enviar (não depois)
// Se já existe hash igual com status SENT, não enviar novamente

const messageContent = personalizedMessage; // Já com {nome} substituído
const hash = sha256(`${campaign_id}-${phone}-${messageContent}`);
```

### 5. **Retomada de Mensagens SENDING**

**PROBLEMA:**
- Mensagens com status `SENDING` podem estar "travadas"
- Como saber se realmente foram enviadas ou não?

**SOLUÇÃO PROPOSTA:**
```typescript
// Adicionar campo "sending_started_at" na broadcast_queue
// Se sending_started_at > 30s atrás e status ainda é SENDING:
//   - Assumir que falhou
//   - Voltar para PENDING
//   - Incrementar send_attempts
//   - Tentar com nova instância
```

**ALTERNATIVA:**
- Usar `processing_lock_until` para detectar travamentos
- Se `processing_lock_until < now()` e status é SENDING, assumir falha

### 6. **Cooldown Progressivo - Resetar Contador?**

**PROBLEMA:**
- `failover_count` incrementa a cada troca
- Quando resetar? Após sucesso? Após período sem trocas?

**SOLUÇÃO:**
```typescript
// Resetar failover_count quando:
// 1. Campanha é pausada/completada (reset para 0)
// 2. Após 24h sem trocas (reset para 0)
// 3. Após 3 verificações consecutivas de PRIMARY saudável (reduzir em 1)
```

### 7. **Campanhas com Múltiplas Instâncias (Modo "separate")**

**PROBLEMA:**
- No modo "separate", cada instância tem sua própria fila
- Failover deveria ser por instância ou por campanha?

**SOLUÇÃO PROPOSTA:**
```typescript
// Failover por INSTÂNCIA (não por campanha)
// - Cada instância pode ter seu próprio backup_instance_id
// - Se instância A falha, apenas itens de A trocam para backup de A
// - Instância B continua normalmente
// - Isso requer backup_instance_id em evolution_config (não em broadcast_campaigns)
```

**ALTERNATIVA (Mais Simples):**
- Limitar failover apenas para campanhas "single"
- Para "separate" ou "rotate", não habilitar failover

---

## 🔧 AJUSTES RECOMENDADOS NA ARQUITETURA

### 1. **Adicionar Campo em `evolution_config`**

```sql
-- Cada instância pode ter seu próprio backup
ALTER TABLE public.evolution_config
  ADD COLUMN backup_instance_id UUID REFERENCES public.evolution_config(id) ON DELETE SET NULL;
```

**Motivo:** Permite failover por instância, não apenas por campanha

### 2. **Adicionar Campo `sending_started_at` em `broadcast_queue`**

```sql
ALTER TABLE public.broadcast_queue
  ADD COLUMN sending_started_at TIMESTAMPTZ;
```

**Motivo:** Detectar mensagens travadas em SENDING

### 3. **Criar Edge Function Dedicada para Health Check**

**Arquivo:** `supabase/functions/check-campaign-health/index.ts`

**Função:**
- Verifica saúde de instâncias de campanhas RUNNING
- Executa failover automático se necessário
- Chamada por cron job a cada 30s

### 4. **Ajustar Lógica de Failover para Modo "separate"**

```typescript
// Se sending_method = "separate":
//   - Failover por instância (usar backup_instance_id de evolution_config)
//   - Atualizar apenas itens daquela instância específica
// Se sending_method = "single":
//   - Failover por campanha (usar backup_instance_id de broadcast_campaigns)
//   - Atualizar todos os itens da campanha
```

---

## 📊 FLUXO REVISADO DE FAILOVER

### Para Campanhas "single" (1 instância):

```
1. Campanha RUNNING com failover_enabled = true
2. Health check detecta falha na PRIMARY
3. Verifica backup_instance_id da campanha
4. Se BACKUP OK:
   - Atualiza current_active_instance_id = backup_instance_id
   - Atualiza instance_id de TODOS os itens PENDING/FAILED da campanha
   - Registra log
   - Continua processamento
```

### Para Campanhas "separate" (múltiplas instâncias):

```
1. Campanha RUNNING com múltiplas instâncias
2. Health check detecta falha na Instância A
3. Verifica backup_instance_id da Instância A (em evolution_config)
4. Se BACKUP OK:
   - Atualiza instance_id apenas dos itens da Instância A
   - Registra log (especificando qual instância falhou)
   - Continua processamento (outras instâncias não afetadas)
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

### Estrutura de Dados
- [x] Campos de failover em `broadcast_campaigns`
- [x] Tabela de logs `broadcast_failover_logs`
- [x] Campos de rastreamento em `broadcast_queue`
- [ ] Campo `backup_instance_id` em `evolution_config` (RECOMENDADO)
- [ ] Campo `sending_started_at` em `broadcast_queue` (RECOMENDADO)

### Lógica de Failover
- [x] Detecção de falhas (múltiplos critérios)
- [x] Cooldown progressivo
- [x] Retomada da fila
- [ ] Health check contínuo (definir onde executar)
- [ ] Failover para modo "separate" (definir estratégia)

### UI e Controles
- [x] Toggle failover automático
- [x] Botão trocar manualmente
- [x] Indicador visual
- [x] Histórico de trocas

### Casos de Borda
- [x] Mensagens SENDING travadas
- [x] Ambas instâncias caem
- [x] Multi-worker concorrente
- [x] Retomada após reinício
- [x] Deduplicação

---

## 🎯 DECISÕES NECESSÁRIAS

### 1. **Failover para Campanhas "separate"**
- [ ] Opção A: Failover por instância (cada instância tem seu backup)
- [ ] Opção B: Limitar failover apenas para campanhas "single"
- [ ] Opção C: Failover global (toda campanha troca, mesmo em "separate")

**RECOMENDAÇÃO:** Opção A (mais flexível, mas mais complexo)

### 2. **Onde Executar Health Check**
- [ ] Opção A: Cron job dedicado (edge function `check-campaign-health`)
- [ ] Opção B: Na edge function `process-broadcast-queue`
- [ ] Opção C: Frontend (não recomendado)

**RECOMENDAÇÃO:** Opção A (mais confiável)

### 3. **Resetar `failover_count`**
- [ ] Opção A: Resetar após 24h sem trocas
- [ ] Opção B: Resetar quando campanha pausa/completa
- [ ] Opção C: Nunca resetar (cooldown sempre progressivo)

**RECOMENDAÇÃO:** Opção B (mais simples)

---

## 📝 PRÓXIMOS PASSOS

1. **Decidir estratégia para modo "separate"**
2. **Adicionar campos recomendados** (`backup_instance_id` em `evolution_config`, `sending_started_at`)
3. **Criar edge function de health check** (`check-campaign-health`)
4. **Ajustar migration** com campos adicionais
5. **Implementar lógica de failover** na edge function
6. **Criar componente UI**
7. **Testar casos de borda**

---

## 💡 CONCLUSÃO

A arquitetura está **bem estruturada e completa**, mas precisa de **ajustes** para:

1. **Suportar modo "separate"** (failover por instância)
2. **Definir onde executar health check** (recomendado: cron job)
3. **Adicionar campos auxiliares** (`sending_started_at`, `backup_instance_id` em `evolution_config`)

Após esses ajustes, a arquitetura estará **pronta para implementação**.


