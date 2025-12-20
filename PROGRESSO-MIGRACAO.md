# Progresso da Migração - Atualizado

## ✅ Migrations Aplicadas com Sucesso

1. `20250101000000_create_organizations.sql` ✅
2. `20250101000001_create_profiles.sql` ✅
3. `20250101000002_create_helper_functions.sql` ✅
4. `20250101000003_create_base_tables.sql` ✅ (leads, activities, call_queue, evolution_config)
5. `20250121000001_create_calendar_message_templates.sql` ✅
6. `20250122000000_add_stage_id_to_calendar_events.sql` ✅ (ajustada para ser condicional)
7. `20250122000001_create_follow_up_templates.sql` ✅ (ajustada para usar user_id temporariamente)

## ⚠️ Migrations em Progresso

- `20250122000002_create_instance_disconnection_notifications.sql` - Falta tipo `app_role`

## 🔧 Ajustes Realizados

1. **Migrations condicionais**: Algumas migrations foram ajustadas para verificar se tabelas/colunas existem antes de criar
2. **Resolução de dependências**: Tabelas base (leads, organizations, profiles) foram criadas primeiro
3. **Renomeação de timestamps**: Migrations com timestamps duplicados foram renomeadas

## 📊 Estatísticas

- **Total de migrations**: ~215
- **Aplicadas**: ~7
- **Pendentes**: ~208
- **Com erros**: 1 (app_role)

## Próximos Passos

1. Criar/encontrar migration que cria o tipo `app_role`
2. Continuar aplicando as migrations restantes
3. Deploy das Edge Functions após conclusão das migrations

## Comando para Continuar

```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
echo "y" | supabase db push
```
