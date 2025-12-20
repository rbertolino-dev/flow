# 🔧 Instruções para Corrigir Problema de Migrations

**Problema**: A migration `20250120000000_create_google_calendar_tables.sql` referencia a tabela `organizations` que só é criada na migration `20251107144206_72ef33ad-9da6-4e60-8f60-f5f11c5857a8.sql`.

---

## 🎯 Solução: Aplicar Migration de Organizations Primeiro

### Opção 1: Via SQL Editor (Recomendado)

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Execute o conteúdo** da migration que cria organizations:
   - Arquivo: `supabase/migrations/20251107144206_72ef33ad-9da6-4e60-8f60-f5f11c5857a8.sql`
   - Copie TODO o conteúdo do arquivo
   - Cole no SQL Editor
   - Clique em **"Run"**

3. **Depois**, execute as outras migrations:
   ```bash
   export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
   echo "y" | supabase db push
   ```

### Opção 2: Renomear Migration (Alternativa)

Renomear a migration de organizations para ter timestamp anterior:

```bash
cd supabase/migrations
mv 20251107144206_72ef33ad-9da6-4e60-8f60-f5f11c5857a8.sql 20250101000000_create_organizations.sql
```

Depois aplicar:
```bash
supabase db push
```

---

## 📋 Conteúdo da Migration de Organizations

A migration cria:
- Tabela `organizations`
- Tabela `organization_members`
- Funções relacionadas
- RLS policies

**Arquivo completo**: `supabase/migrations/20251107144206_72ef33ad-9da6-4e60-8f60-f5f11c5857a8.sql`

---

## ✅ Após Aplicar

Depois de aplicar a migration de organizations, todas as outras migrations devem funcionar normalmente.

**Verificar sucesso:**
```bash
supabase db diff
# Deve mostrar apenas migrations pendentes (não erros)
```

---

**Execute a migration de organizations primeiro e depois continue!** 🚀
