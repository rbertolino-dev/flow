# 🔐 Credenciais Visualizador PostgreSQL - RESUMO RÁPIDO

## 📊 Credenciais

```
Host: db.ogeljmbhqxpfjbpnbwog.supabase.co
Porta: 5432
Database: postgres
Usuário: viewer_user
Senha: viewer_2025_secure_pass_kanban_buzz
```

## 🔗 Link de Acesso

**Supabase SQL Editor:**
https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

## 🚀 Como Aplicar a Migration

### Opção 1: Via Supabase Dashboard (Mais Fácil)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Abra o arquivo: `supabase/migrations/20251222024655_create_viewer_user.sql`
3. Cole o conteúdo no SQL Editor
4. Clique em **Run** para executar

### Opção 2: Via Terminal

```bash
cd /root/kanban-buzz-95241
bash scripts/aplicar-migration-visualizador.sh
```

## ✅ Após Aplicar

As credenciais acima estarão funcionando e você poderá conectar usando qualquer cliente PostgreSQL.

**Documentação completa:** Veja `CREDENCIAIS-VISUALIZADOR-POSTGRESQL.md`

