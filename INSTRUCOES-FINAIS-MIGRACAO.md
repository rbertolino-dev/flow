# 📋 Instruções Finais - Completar Migração

**Status**: ⏳ **MIGRAÇÕES PARCIALMENTE APLICADAS**

---

## ✅ O Que Já Foi Feito

1. ✅ Tabelas base criadas (organizations, profiles) via SQL Editor
2. ✅ Funções auxiliares criadas (user_is_org_admin, is_pubdigital_user)
3. ✅ Algumas migrations aplicadas com sucesso
4. ✅ Token configurado e autenticação funcionando

---

## ⚠️ Problema Atual

Algumas migrations falham porque tentam criar policies/tabelas que já existem. Isso é **NORMAL** e pode ser ignorado.

---

## 🚀 Solução: Continuar Aplicando

### Opção 1: Aplicar Restantes Manualmente (Recomendado)

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Para cada migration que falhou**, modifique o SQL:
   - Adicione `DROP POLICY IF EXISTS "nome_da_policy" ON tabela;` antes de criar
   - Ou use `CREATE POLICY IF NOT EXISTS` (se suportado)

3. **Execute** o SQL modificado

### Opção 2: Marcar Migrations como Aplicadas

Para migrations que falham por "already exists", marque como aplicadas:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

# Marcar migration como aplicada (se necessário)
supabase migration repair --status applied [VERSION]
```

### Opção 3: Continuar e Ignorar Erros

As migrations que falham por "already exists" indicam que já foram aplicadas. Continue aplicando as restantes:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
supabase db push
```

O Supabase CLI tentará aplicar todas as migrations pendentes. As que falharem por "already exists" podem ser ignoradas.

---

## 📊 Próximos Passos Após Migrations

### 1. Deploy das Edge Functions
```bash
./scripts/deploy-todas-funcoes.sh
```

### 2. Configurar Secrets
- Dashboard → Settings → Edge Functions → Secrets
- Adicionar variáveis de `VARIAVEIS-AMBIENTE-COMPLETAS.md`

### 3. Configurar Cron Jobs
- Dashboard → SQL Editor
- Executar `scripts/configurar-cron-jobs.sql`

---

## 💡 Dica

**As migrations que falham por "already exists" são OK!** Isso significa que já foram aplicadas. Continue aplicando as restantes e depois prossiga com o deploy das funções.

---

**Continue aplicando as migrations!** 🚀
