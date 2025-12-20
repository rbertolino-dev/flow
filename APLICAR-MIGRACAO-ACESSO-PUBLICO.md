# 🔓 Aplicar Migração: Acesso Público a Contratos

## 🎯 Objetivo

Permitir que usuários **não autenticados** possam acessar e assinar contratos usando o link com `signature_token`.

## ⚠️ IMPORTANTE: Aplicar Migração SQL

### Passo 1: Acessar SQL Editor

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. Ou: Dashboard → SQL Editor → New Query

### Passo 2: Executar Migração

**Copie e cole TODO o conteúdo do arquivo:**
```
supabase/migrations/20251216190000_public_contract_signature_access.sql
```

**Execute** (Ctrl+Enter ou botão Run)

### Passo 3: Verificar

Execute esta query para confirmar que as políticas foram criadas:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('contracts', 'contract_signatures', 'contract_templates', 'leads')
  AND policyname LIKE '%Public%' OR policyname LIKE '%public%'
ORDER BY tablename, policyname;
```

**Resultado esperado:** 6 políticas públicas (uma para cada tabela/operação)

## 📋 O que a Migração Faz

### 1. **Políticas Públicas para `contracts`:**
   - ✅ Leitura pública quando há `signature_token` válido
   - ✅ Atualização pública quando há `signature_token` válido (para marcar como assinado)

### 2. **Políticas Públicas para `contract_signatures`:**
   - ✅ Inserção pública de assinaturas quando contrato tem token válido
   - ✅ Leitura pública de assinaturas quando contrato tem token válido

### 3. **Políticas Públicas para `contract_templates`:**
   - ✅ Leitura pública de templates relacionados a contratos com token válido

### 4. **Políticas Públicas para `leads`:**
   - ✅ Leitura pública de leads relacionados a contratos com token válido

## 🔒 Segurança

As políticas públicas **só funcionam** quando:
- ✅ O contrato tem um `signature_token` válido
- ✅ O contrato não está cancelado
- ✅ O contrato não está expirado (se tiver `expires_at`)

**Sem o token correto, o acesso é negado!**

## ✅ Após Aplicar

1. **Teste o link de assinatura** em um navegador anônimo/privado
2. **Verifique se o contrato carrega** sem precisar fazer login
3. **Teste assinar o contrato** sem estar autenticado
4. **Verifique se os dados são salvos** corretamente

## 🐛 Troubleshooting

### Problema: "Contrato não encontrado"
- Verifique se o `signature_token` está correto na URL
- Verifique se o contrato tem um `signature_token` no banco
- Verifique se as políticas foram aplicadas corretamente

### Problema: "Acesso negado"
- Verifique se o contrato não está cancelado
- Verifique se o contrato não está expirado
- Verifique se o token na URL corresponde ao token no banco

### Problema: "Erro ao salvar assinatura"
- Verifique se a política de INSERT em `contract_signatures` foi criada
- Verifique se o contrato tem `signature_token` válido

## 📝 Notas

- As políticas públicas **não substituem** as políticas existentes para usuários autenticados
- Usuários autenticados continuam tendo acesso normal via suas políticas
- A segurança é garantida pelo `signature_token` único por contrato


