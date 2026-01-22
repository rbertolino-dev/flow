# 🔍 Investigação Profunda: Timezone e Agendamento de Campanhas

## ⚠️ PROBLEMA IDENTIFICADO

### 1. Timezone do Servidor
- **Servidor:** UTC (Etc/UTC, +0000)
- **Horário atual do servidor:** UTC

### 2. Timezone do Frontend
- **Frontend usa:** `new Date()` → Timezone do navegador (provavelmente horário do Brasil, UTC-3)
- **Ao salvar:** `.toISOString()` → Converte para UTC

### 3. Timezone da Função Edge
- **Função usa:** `new Date().toISOString()` → UTC
- **Comparação:** `scheduled_start_at <= now` → Compara ambos em UTC

---

## 🔍 ANÁLISE DO CÓDIGO

### Frontend (BroadcastCampaigns.tsx)

**Linha 3586-3591:** Criação da data agendada
```typescript
const [hours, minutes] = e.target.value.split(":");
const newDate = new Date(newCampaign.scheduledStart!);
newDate.setHours(hoursNum, minutesNum);
```

**Problema:** 
- `new Date()` usa timezone do navegador
- Se usuário está no Brasil (UTC-3), `setHours(19, 40)` cria `19:40 BRT`
- Mas `.toISOString()` converte para UTC: `19:40 BRT = 22:40 UTC`

**Linha 1664:** Salvando no banco
```typescript
scheduled_start_at: newCampaign.scheduledStart ? newCampaign.scheduledStart.toISOString() : null,
```

**Resultado:** Data salva em UTC (3 horas a mais que o horário do Brasil)

### Edge Function (process-scheduled-campaigns/index.ts)

**Linha 32:** Comparação
```typescript
const now = new Date().toISOString();
// ...
.lte("scheduled_start_at", now)
```

**Problema:**
- `now` está em UTC
- `scheduled_start_at` está em UTC (mas foi criado a partir de horário do Brasil)
- Se usuário agenda para 19:40 BRT, salva como 22:40 UTC
- Função compara corretamente, mas usuário vê horário diferente!

---

## 🚨 PROBLEMA PRINCIPAL

**Cenário:**
1. Usuário no Brasil agenda campanha para **19:40 (horário do Brasil)**
2. Frontend converte para UTC: **22:40 UTC**
3. Salva no banco: `2026-01-22 22:40:00+00`
4. Função compara às **20:00 UTC** (17:00 BRT)
5. `22:40 UTC > 20:00 UTC` → **Campanha não inicia!**
6. Só inicia quando servidor chegar às **22:40 UTC** (19:40 BRT)

**Resultado:** Campanha inicia no horário correto do Brasil, mas há confusão porque:
- Usuário vê horário do Brasil
- Sistema salva em UTC
- Logs aparecem em UTC

---

## 🔍 POR QUE LOGS NÃO APARECEM IMEDIATAMENTE?

### 1. Cron Job Executa a Cada Minuto
- Função só executa no minuto seguinte ao agendamento
- Se agendar para 19:40:00, função executa às 19:41:00 (próximo minuto)

### 2. Função Só Processa Campanhas que Devem Iniciar
- Se `scheduled_start_at > now`, função não processa
- Retorna: `"Nenhuma campanha agendada para iniciar"`
- **Não gera log de processamento!**

### 3. Logs Só Aparecem Quando:
- Cron job executa (a cada minuto)
- E encontra campanha para processar
- E processa com sucesso

**Se agendar para futuro, logs só aparecem quando chegar o horário!**

---

## ✅ SOLUÇÕES

### Solução 1: Corrigir Timezone no Frontend (RECOMENDADO)

Converter horário do Brasil para UTC antes de salvar:

```typescript
// Criar função helper
const convertBRTToUTC = (date: Date): Date => {
  // BRT = UTC-3
  const utcDate = new Date(date);
  utcDate.setHours(utcDate.getHours() + 3); // Adicionar 3 horas
  return utcDate;
};

// Ao salvar
scheduled_start_at: newCampaign.scheduledStart 
  ? convertBRTToUTC(newCampaign.scheduledStart).toISOString() 
  : null,
```

**Problema:** Isso assume que usuário sempre está no Brasil. Não é ideal.

### Solução 2: Usar Timezone do Navegador (MELHOR)

Detectar timezone do navegador e converter corretamente:

```typescript
// Função para converter data local para UTC mantendo horário visual
const convertLocalToUTC = (localDate: Date): string => {
  // Criar string no formato que o usuário vê
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');
  
  // Criar como se fosse UTC mas com horário local
  // Exemplo: Se usuário agenda 19:40 BRT, salvar como 19:40 UTC
  // (Supabase vai tratar como UTC, mas horário visual será correto)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
};
```

**Problema:** Isso ainda não resolve completamente porque Supabase armazena como UTC.

### Solução 3: Armazenar Timezone e Converter na Função (IDEAL)

1. Salvar `scheduled_start_at` com timezone do usuário
2. Função converte para UTC antes de comparar

**Implementação:**
- Adicionar coluna `scheduled_start_timezone` (opcional)
- Função converte baseado no timezone antes de comparar

---

## 📋 VERIFICAÇÕES NECESSÁRIAS

### 1. Verificar Timezone do Banco de Dados

```sql
-- Verificar timezone do banco
SHOW timezone;

-- Verificar como data está armazenada
SELECT 
  id,
  name,
  scheduled_start_at,
  scheduled_start_at AT TIME ZONE 'UTC' as utc,
  scheduled_start_at AT TIME ZONE 'America/Sao_Paulo' as brt
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

### 2. Verificar Timezone do Navegador

Adicionar log no frontend:
```typescript
console.log('Timezone do navegador:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Data agendada (local):', newCampaign.scheduledStart);
console.log('Data agendada (UTC):', newCampaign.scheduledStart?.toISOString());
```

### 3. Verificar Logs da Função

Acessar logs da edge function e verificar:
- Se função está executando
- Se encontra campanhas agendadas
- Horário UTC vs horário esperado

---

## 🎯 RECOMENDAÇÃO FINAL

**Solução Imediata:**
1. Documentar que sistema usa UTC
2. Mostrar horário UTC na interface quando agendar
3. Ou converter horário do Brasil para UTC antes de salvar

**Solução Ideal (Futuro):**
1. Detectar timezone do navegador
2. Armazenar timezone junto com data
3. Converter na função antes de comparar

---

## 📄 Próximos Passos

1. ✅ Verificar timezone do banco de dados
2. ✅ Adicionar logs no frontend para debug
3. ✅ Corrigir conversão de timezone
4. ✅ Testar com horário do Brasil
