# 📧 Como Desabilitar Confirmação de Email no Supabase

## 🎯 Objetivo
Permitir que usuários sejam criados e façam login automaticamente sem precisar confirmar email.

## 📝 Passos no Dashboard

### Opção 1: Via Dashboard (Recomendado)

1. **Acesse o Dashboard do Supabase:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/providers

2. **Vá em "Email" provider:**
   - Clique em "Email" na lista de providers

3. **Desabilite "Confirm email":**
   - Encontre o toggle "Confirm email"
   - **Desligue** (OFF)
   - Clique em "Save"

4. **Verifique outras configurações:**
   - "Enable email signup" deve estar **ON**
   - "Confirm email" deve estar **OFF**

### Opção 2: Via Authentication Settings

1. **Acesse:**
   - https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/auth/settings

2. **Na seção "Email Auth":**
   - Desabilite "Enable email confirmations"
   - Salve as alterações

## ✅ Verificação

Após desabilitar, teste:

1. Acesse: https://agilizeflow.com.br/CADASTRO
2. Preencha os dados:
   - Nome completo
   - Email
   - Senha (mínimo 6 caracteres)
3. Clique em "Criar Conta"
4. **Resultado esperado:**
   - ✅ Conta criada
   - ✅ Login automático
   - ✅ Redirecionamento para /onboarding
   - ❌ **NÃO** deve pedir confirmação de email

## 🔍 Troubleshooting

### Se ainda pedir confirmação:

1. Verifique se realmente desabilitou no Dashboard
2. Limpe cache do navegador
3. Verifique logs no Supabase Dashboard > Logs > Auth Logs
4. Verifique se há políticas RLS bloqueando

### Se der erro ao criar conta:

1. Verifique console do navegador (F12)
2. Verifique se "Enable email signup" está ON
3. Verifique rate limits (muitas tentativas)

## 📋 Checklist

- [ ] Acessei o Dashboard do Supabase
- [ ] Desabilitei "Confirm email"
- [ ] Salvei as alterações
- [ ] Testei criar uma conta
- [ ] Login automático funcionou
- [ ] Redirecionamento para /onboarding funcionou

