# ✅ Cleanup Agressivo - Remove TUDO

## ❌ Problema

O usuário está perdendo tempo com erros recorrentes:
- Policies duplicadas
- Triggers duplicados
- Functions duplicadas

## ✅ Solução: Cleanup Agressivo

**Agora o cleanup remove TUDO que pode causar conflito:**

### Triggers:
- ✅ `trigger_google_calendar_configs_updated_at`
- ✅ `trigger_calendar_events_updated_at`

### Functions:
- ✅ `update_google_calendar_configs_updated_at()`
- ✅ `update_calendar_events_updated_at()`

### Policies (16 do Google Calendar + 3 outras):
- ✅ Todas as 8 policies de `google_calendar_configs` (PT + EN)
- ✅ Todas as 8 policies de `calendar_events` (PT + EN)
- ✅ Service role, Lead follow-ups

## 🚀 Estratégia Alternativa

Se ainda houver problemas, podemos:

1. **Aplicar migrations uma por uma** (mais lento, mas mais seguro)
2. **Criar script SQL único** que limpa TUDO antes de aplicar
3. **Usar Supabase CLI** com `--include-all` (já tem tratamento de erros)

## 📋 Status

✅ **Cleanup agressivo adicionado em todos os 11 lotes**  
✅ **Remove triggers, functions E policies**  
✅ **Pronto para aplicar**

## 💡 Próximo Passo

**Aplique o `lote-01.sql` no SQL Editor agora!**

O cleanup agora remove TUDO antes de aplicar. Se ainda houver erro, avise qual objeto está duplicado e adiciono ao cleanup.




