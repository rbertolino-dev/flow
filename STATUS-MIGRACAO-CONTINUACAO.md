# Status da Migração - Continuação

## Progresso Atual

✅ **Migrations aplicadas com sucesso:**
- `20250101000000_create_organizations.sql` (aplicada manualmente)
- `20250101000001_create_profiles.sql` (aplicada manualmente)
- `20250101000002_create_helper_functions.sql` (aplicada manualmente)
- `20250101000003_create_base_tables.sql` (tabelas base: leads, activities, call_queue, evolution_config)
- `20250121000001_create_calendar_message_templates.sql`
- `20250122000000_add_stage_id_to_calendar_events.sql` (ajustada para ser condicional)

⚠️ **Migrations com problemas:**
- `20250122000000_create_follow_up_templates.sql` - Já aplicada, mas há conflito de timestamp (duplicado)

## Próximos Passos

1. **Resolver conflito de timestamp**: Há múltiplas migrations com timestamp `20250122000000`
2. **Continuar aplicando migrations**: Ainda há ~200 migrations pendentes
3. **Deploy das Edge Functions**: Após migrations do banco

## Comandos Úteis

```bash
# Verificar status das migrations
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
supabase migration list

# Continuar aplicando migrations
echo "y" | supabase db push

# Ver logs detalhados
tail -1000 /tmp/migration-final-v15.log
```

## Notas

- Algumas migrations foram ajustadas para serem condicionais (verificar se tabelas/colunas existem antes de criar)
- A migration `20250122000000_create_follow_up_templates.sql` foi ajustada para usar `user_id` ao invés de `organization_id` temporariamente
- A migration `20250122000000_add_stage_id_to_calendar_events.sql` foi ajustada para verificar se `pipeline_stages` existe antes de criar a foreign key
