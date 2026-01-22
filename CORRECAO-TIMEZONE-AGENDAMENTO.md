# 🔧 Correção: Timezone no Agendamento de Campanhas

## 🚨 PROBLEMA IDENTIFICADO

### Situação Atual:
1. **Usuário no Brasil agenda:** 19:40 (horário local)
2. **Frontend cria:** `new Date().setHours(19, 40)` → 19:40 no timezone do navegador (BRT)
3. **Ao salvar:** `.toISOString()` → Converte para UTC: **22:40 UTC**
4. **Função compara:** `scheduled_start_at <= now` (ambos em UTC)
5. **Resultado:** Campanha só inicia quando servidor chegar às **22:40 UTC** (19:40 BRT)

**Problema:** Sistema funciona, mas há confusão porque:
- Usuário vê horário do Brasil
- Sistema salva em UTC
- Logs aparecem em UTC

---

## ✅ SOLUÇÃO: Corrigir Conversão de Timezone

### Opção 1: Interpretar Horário como Horário Local e Converter para UTC

**Modificar frontend para:**
1. Quando usuário agenda para 19:40, interpretar como 19:40 no timezone local
2. Converter para UTC antes de salvar
3. Garantir que horário visual seja mantido

### Opção 2: Armazenar Timezone e Converter na Função

**Mais complexo, mas mais correto:**
1. Salvar timezone do usuário junto com data
2. Função converte para UTC antes de comparar

---

## 🔍 POR QUE LOGS NÃO APARECEM IMEDIATAMENTE?

### Resposta:
1. **Cron job executa a cada minuto** - Não executa imediatamente
2. **Função só processa campanhas que devem iniciar** - Se `scheduled_start_at > now`, não processa
3. **Logs só aparecem quando:**
   - Cron executa (a cada minuto)
   - E encontra campanha para processar
   - E processa com sucesso

**Se agendar para futuro, logs só aparecem quando chegar o horário!**

---

## 📋 PRÓXIMOS PASSOS

1. ✅ Executar `VERIFICAR-TIMEZONE-BANCO.sql` para confirmar timezone
2. ✅ Corrigir frontend para converter timezone corretamente
3. ✅ Adicionar logs no frontend para debug
4. ✅ Testar com horário do Brasil
