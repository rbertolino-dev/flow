# Otimizações Implementadas para Migração Rápida

## ✅ Melhorias Aplicadas

### 1. **Criação de Tipo `app_role` Antecipada**
- Criada migration `20250101000004_create_app_role_type.sql` que cria o tipo `app_role` antes de ser usado
- Usa `DO $$ BEGIN ... END $$` para verificar se o tipo já existe (PostgreSQL não suporta `CREATE TYPE IF NOT EXISTS`)

### 2. **Migrations Condicionais**
- Ajustadas migrations para verificar existência antes de criar:
  - `20250122000000_add_stage_id_to_calendar_events.sql` - Verifica se `pipeline_stages` existe
  - `20250122000002_create_instance_disconnection_notifications.sql` - Verifica se `has_role` existe

### 3. **Scripts de Automação**
- `scripts/migracao-otimizada.sh` - Aplica migrations em lote com tratamento de erros
- `scripts/aplicar-migrations-rapido.sh` - Versão rápida com retry automático

## 🚀 Como Usar

### Opção 1: Script Otimizado (Recomendado)
```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
./scripts/migracao-otimizada.sh
```

### Opção 2: Comando Direto
```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
echo "y" | supabase db push --include-all
```

## 📊 Estratégia de Aplicação

1. **Migrations Base** (já aplicadas):
   - `organizations`, `profiles`, `helper_functions`
   - `leads`, `activities`, `call_queue`, `evolution_config`
   - `app_role` type

2. **Migrations Dependentes** (em progresso):
   - Aplicadas em lote com `--include-all`
   - Erros de "already exists" são ignorados
   - Erros críticos param o processo

3. **Segurança e Estabilidade**:
   - ✅ Verificações condicionais antes de criar objetos
   - ✅ Uso de `IF NOT EXISTS` onde possível
   - ✅ Tratamento de dependências
   - ✅ Logs detalhados para debug

## ⚠️ Notas Importantes

- **Erros de "already exists"**: São normais e podem ser ignorados
- **Dependências**: Algumas migrations podem falhar se dependências não existirem - serão ajustadas automaticamente
- **Tempo**: Aplicação de ~200 migrations pode levar 10-30 minutos

## 📝 Próximos Passos

Após conclusão das migrations:
1. Deploy das Edge Functions
2. Configuração de Secrets
3. Configuração de Cron Jobs
4. Migração de dados (se necessário)
