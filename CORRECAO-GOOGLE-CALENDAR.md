# ✅ Correção: Policies do Google Calendar

## ❌ Erro Encontrado

```
ERROR: 42710: policy "Configuração do Google Agenda: membros podem selecionar" 
for table "google_calendar_configs" already exists
```

## ✅ Correção Aplicada

**Arquivo:** `supabase/migrations/20250120000000_create_google_calendar_tables.sql`

**Todas as 8 policies corrigidas:**
- ✅ Google Calendar config: members can select
- ✅ Google Calendar config: members can insert
- ✅ Google Calendar config: members can update
- ✅ Google Calendar config: members can delete
- ✅ Calendar events: members can select
- ✅ Calendar events: members can insert
- ✅ Calendar events: members can update
- ✅ Calendar events: members can delete

**Também adicionado DROP para versão em português:**
- "Configuração do Google Agenda: membros podem selecionar"
- "Configuração do Google Agenda: membros podem inserir"
- "Configuração do Google Agenda: membros podem atualizar"
- "Configuração do Google Agenda: membros podem deletar"

## 🔄 Lotes Regenerados

✅ Todos os lotes foram regenerados com as correções aplicadas.

## 🚀 Próximo Passo

Continue aplicando o `lote-01.sql` no SQL Editor. O erro foi corrigido!




