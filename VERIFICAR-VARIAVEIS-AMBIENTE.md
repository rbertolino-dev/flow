# 🔧 Verificar Variáveis de Ambiente - Edge Function

## ⚠️ Problema
Erro relacionado a `SUPABASE_SERVICE_ROLE_KEY` não encontrado ou inválido.

## ✅ Solução: Verificar e Configurar Variáveis

### 1. Acessar Configurações do Supabase

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login

2. **Vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

3. **Vá em Settings/Configurações:**
   - Procure por **"Secrets"** ou **"Environment Variables"**
   - Ou clique na função `send-contract-whatsapp` → **Settings**

### 2. Verificar Variáveis Necessárias

A função precisa das seguintes variáveis:

#### ✅ Obrigatórias (já devem existir automaticamente):
- `SUPABASE_URL` - URL do projeto Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço (bypass RLS)

#### ⚙️ Opcionais:
- `FRONTEND_URL` - URL do frontend (para links de assinatura)
  - Se não configurado, tenta detectar automaticamente

### 3. Como Adicionar/Verificar Variáveis

#### Via Dashboard:

1. **No Dashboard do Supabase:**
   - Vá em **Settings** → **Edge Functions** → **Secrets**
   - Ou: **Edge Functions** → `send-contract-whatsapp` → **Settings** → **Secrets**

2. **Verificar se existem:**
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. **Se não existirem, adicionar:**
   - Clique em **"Add Secret"** ou **"New Secret"**
   - Nome: `SUPABASE_URL`
   - Valor: `https://ogeljmbhqxpfjbpnbwog.supabase.co`
   - Salvar
   
   - Nome: `SUPABASE_SERVICE_ROLE_KEY`
   - Valor: (obter em **Settings** → **API** → **service_role key**)
   - Salvar

#### Via CLI:

```bash
# Verificar secrets existentes
supabase secrets list

# Adicionar/atualizar secrets
supabase secrets set SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui
supabase secrets set FRONTEND_URL=https://agilizeflow.com.br
```

### 4. Onde Obter o SERVICE_ROLE_KEY

1. **No Dashboard do Supabase:**
   - Vá em **Settings** → **API**
   - Procure por **"service_role"** key
   - Copie o valor (é uma chave longa)
   - ⚠️ **NUNCA** compartilhe esta chave publicamente

### 5. Verificar se Funcionou

Após configurar as variáveis:

1. **Tente enviar o contrato novamente**
2. **Verifique os logs da função:**
   - Edge Functions → `send-contract-whatsapp` → **Logs**
   - Se aparecer "Variáveis de ambiente não configuradas", as variáveis não foram encontradas

### 6. Troubleshooting

#### Erro: "Variáveis de ambiente não configuradas"
- **Causa:** `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` não estão definidas
- **Solução:** Adicionar as variáveis conforme instruções acima

#### Erro: "Invalid API key"
- **Causa:** `SUPABASE_SERVICE_ROLE_KEY` está incorreta
- **Solução:** Verificar se copiou a chave correta do Dashboard

#### Erro: "Failed to fetch"
- **Causa:** Pode ser problema de rede ou CORS (já corrigido)
- **Solução:** Verificar logs da função para mais detalhes

---

## 📋 Checklist

- [ ] `SUPABASE_URL` configurada
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada
- [ ] `FRONTEND_URL` configurada (opcional, mas recomendado)
- [ ] Variáveis testadas (tentar enviar contrato)
- [ ] Logs verificados (sem erros de variáveis)

---

**Última atualização:** Edge function atualizada com validação de variáveis
**Versão:** 129.4kB

