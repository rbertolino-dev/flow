# 🔍 Como Funciona o Timezone no Agendamento

## ✅ O Sistema Funciona com QUALQUER Horário

**IMPORTANTE:** O horário 19:40 usado nos exemplos foi APENAS um exemplo!

O sistema funciona corretamente com **QUALQUER horário** que o usuário agendar.

---

## 🔄 Como Funciona na Prática

### Exemplo 1: Usuário agenda para 14:30 (horário do Brasil)
1. **Usuário seleciona:** 14:30 no navegador (timezone do Brasil)
2. **Frontend cria:** `new Date()` com 14:30 no timezone local (BRT)
3. **Ao salvar:** `.toISOString()` converte para UTC → **17:30 UTC** (14:30 + 3 horas)
4. **Banco armazena:** `2026-01-22 17:30:00+00` (UTC)
5. **Função processa:** Quando servidor chegar às **17:30 UTC** (14:30 BRT)

### Exemplo 2: Usuário agenda para 20:15 (horário do Brasil)
1. **Usuário seleciona:** 20:15 no navegador (timezone do Brasil)
2. **Frontend cria:** `new Date()` com 20:15 no timezone local (BRT)
3. **Ao salvar:** `.toISOString()` converte para UTC → **23:15 UTC** (20:15 + 3 horas)
4. **Banco armazena:** `2026-01-22 23:15:00+00` (UTC)
5. **Função processa:** Quando servidor chegar às **23:15 UTC** (20:15 BRT)

### Exemplo 3: Usuário agenda para 08:00 (horário do Brasil)
1. **Usuário seleciona:** 08:00 no navegador (timezone do Brasil)
2. **Frontend cria:** `new Date()` com 08:00 no timezone local (BRT)
3. **Ao salvar:** `.toISOString()` converte para UTC → **11:00 UTC** (08:00 + 3 horas)
4. **Banco armazena:** `2026-01-22 11:00:00+00` (UTC)
5. **Função processa:** Quando servidor chegar às **11:00 UTC** (08:00 BRT)

---

## ✅ O Sistema Está Correto!

**Não há "correção" de horário!** O sistema:
- ✅ Aceita QUALQUER horário que o usuário agendar
- ✅ Converte automaticamente para UTC (baseado no timezone do navegador)
- ✅ Processa no horário correto (quando servidor chegar no horário UTC equivalente)

---

## 🔍 Por Que Parece "Corrigir"?

O que acontece:
1. **Usuário no Brasil agenda:** 19:40 (horário local)
2. **Sistema salva:** 22:40 UTC (conversão automática)
3. **Usuário pode pensar:** "Por que mudou para 22:40?"

**Mas na verdade:**
- ✅ 19:40 BRT = 22:40 UTC (mesmo momento, timezones diferentes)
- ✅ Sistema processa quando chegar 22:40 UTC (que é 19:40 no Brasil)
- ✅ **Funciona corretamente!**

---

## 📋 Código que Faz a Conversão

**Frontend (linha 1664):**
```typescript
scheduled_start_at: newCampaign.scheduledStart ? newCampaign.scheduledStart.toISOString() : null,
```

**O que faz:**
- `newCampaign.scheduledStart` → Data no timezone do navegador
- `.toISOString()` → Converte para UTC automaticamente
- **Funciona para QUALQUER horário!**

**Exemplo:**
- Se `scheduledStart = 2026-01-22 14:30:00` (BRT)
- `.toISOString()` → `2026-01-22T17:30:00.000Z` (UTC)
- **Conversão automática e correta!**

---

## ✅ Conclusão

**O sistema NÃO está "corrigindo" para um horário específico!**

- ✅ Funciona com QUALQUER horário agendado
- ✅ Conversão de timezone é automática
- ✅ Baseada no timezone do navegador do usuário
- ✅ Processa no horário correto

**O horário 19:40 foi apenas um exemplo usado nos testes!**

---

## 🎯 Se Quiser Testar

1. Agende uma campanha para **qualquer horário** (ex: 15:00, 18:30, 21:45)
2. Verifique no banco: `scheduled_start_at` estará em UTC (3 horas a mais)
3. Aguarde o horário: Campanha iniciará automaticamente no horário correto!

**O sistema funciona perfeitamente para qualquer horário!** ✅
