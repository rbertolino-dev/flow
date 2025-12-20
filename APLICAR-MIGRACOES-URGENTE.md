# ⚠️ URGENTE: Aplicar Migrações SQL

## 🚨 Problema

Os dados de autenticação (IP, navegador, etc.) não estão aparecendo porque as **migrações SQL não foram aplicadas**.

## ✅ Deploy Frontend

✅ **Frontend deployado com sucesso!**
- Container rodando na porta 3000
- Build concluído sem erros
- Aplicação respondendo

## 🔴 AÇÃO NECESSÁRIA: Aplicar Migrações SQL

### Passo 1: Acessar SQL Editor

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Ou: Dashboard → SQL Editor → New Query

### Passo 2: Executar Migrações

**Copie e cole TODO o conteúdo do arquivo:**
```
supabase/migrations/apply_new_migrations.sql
```

**Execute** (Ctrl+Enter ou botão Run)

### Passo 3: Verificar

Execute esta query para confirmar:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contract_signatures' 
AND column_name IN ('user_agent', 'device_info', 'validation_hash', 'signed_ip_country');
```

**Resultado esperado:** 4 linhas (uma para cada coluna)

## 📋 O que as Migrações Fazem

1. **Adiciona colunas em `contract_signatures`:**
   - `user_agent` - Navegador/dispositivo
   - `device_info` - Informações do dispositivo (JSON)
   - `geolocation` - Localização (opcional)
   - `validation_hash` - Hash de validação
   - `signed_ip_country` - País do IP

2. **Adiciona coluna em `contracts`:**
   - `whatsapp_message_template` - Template de mensagem personalizada

3. **Cria índice:**
   - `idx_contract_signatures_validation_hash` - Para buscas rápidas

## ⚠️ IMPORTANTE

- As migrações usam `IF NOT EXISTS`, então são seguras
- Podem ser executadas múltiplas vezes sem problemas
- Não afetam dados existentes

## ✅ Após Aplicar

1. **Teste assinando um contrato**
2. **Verifique o console** (F12) - deve mostrar logs de salvamento
3. **Verifique o PDF** - deve ter página de assinaturas com dados
4. **Verifique o painel** - deve mostrar dados de autenticação

## 🎯 Resumo

- ✅ Frontend deployado
- ⚠️ **Migrações SQL precisam ser aplicadas manualmente no SQL Editor**


