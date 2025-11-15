# 🚀 Deploy da Edge Function: asaas-create-boleto

## ⚠️ Supabase CLI não está instalado

Não tem problema! Você pode fazer o deploy via Dashboard do Supabase.

---

## 📋 Passo a Passo: Deploy via Dashboard

### Passo 1: Abrir Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar Nova Função

1. Clique no botão **"Create a new function"** ou **"New Function"**
2. Nome da função: `asaas-create-boleto`
   - ⚠️ **IMPORTANTE:** O nome deve ser exatamente `asaas-create-boleto` (com hífen)
3. Clique em **"Create"** ou **"Continue"**

### Passo 3: Copiar Código

1. Abra o arquivo: `supabase/functions/asaas-create-boleto/index.ts`
2. **Selecione TODO o conteúdo** (Ctrl+A)
3. **Copie** (Ctrl+C)

### Passo 4: Colar no Dashboard

1. No editor do Dashboard, **delete** qualquer código padrão que aparecer
2. **Cole** o código que você copiou (Ctrl+V)
3. Verifique se o código completo foi colado

### Passo 5: Deploy

1. Clique no botão **"Deploy"** (geralmente no canto superior direito)
2. Aguarde alguns segundos
3. Você verá: **"Function deployed successfully"** ✅

---

## ✅ Verificar se Funcionou

### Verificar Status

1. Na lista de Edge Functions, procure por `asaas-create-boleto`
2. Status deve estar: **"Deployed"** ✅
3. Última atualização deve mostrar o horário atual

### Testar a Função

1. Clique na função `asaas-create-boleto`
2. Vá na aba **"Invoke"** ou **"Test"**
3. Cole este JSON no body:

```json
{
  "organizationId": "COLE_SEU_ORG_ID_AQUI",
  "leadId": "COLE_SEU_LEAD_ID_AQUI",
  "customer": {
    "name": "João Teste",
    "cpfCnpj": "12345678901",
    "email": "teste@email.com"
  },
  "boleto": {
    "valor": 50.00,
    "dataVencimento": "2025-02-28",
    "descricao": "Teste de boleto"
  }
}
```

4. Clique em **"Invoke"** ou **"Run"**
5. **Resultado esperado:**
```json
{
  "success": true,
  "boleto": { /* dados do boleto */ },
  "download_url": "https://..."
}
```

---

## 🔍 Troubleshooting

### Erro: "Function name already exists"
- A função já existe
- Clique na função existente
- Clique em **"Edit"** ou **"Update"**
- Substitua o código antigo pelo novo
- Clique em **"Deploy"**

### Erro: "Invalid function code"
- Verifique se copiou TODO o código
- Verifique se não há caracteres estranhos
- Tente copiar novamente

### Erro: "Deployment failed"
- Verifique os logs (aba "Logs")
- Procure por erros de sintaxe
- Verifique se todos os imports estão corretos

---

## 📝 Conteúdo do Arquivo

O arquivo que você precisa copiar está em:
```
supabase/functions/asaas-create-boleto/index.ts
```

**Tamanho aproximado:** ~200 linhas

**Conteúdo inclui:**
- Imports do Deno
- Interface TypeScript
- Lógica de criação de cliente no Asaas
- Lógica de criação de boleto
- Geração de PDF
- Salvamento no banco de dados
- Tratamento de erros

---

## 🎯 Resumo Rápido

```
1. Dashboard > Edge Functions
2. Create new function > Nome: asaas-create-boleto
3. Copiar código de: supabase/functions/asaas-create-boleto/index.ts
4. Colar no editor
5. Deploy
6. Testar com JSON acima
```

---

## ✅ Checklist

- [ ] Dashboard aberto
- [ ] Edge Functions acessado
- [ ] Função `asaas-create-boleto` criada
- [ ] Código copiado do arquivo `.ts`
- [ ] Código colado no editor
- [ ] Deploy executado
- [ ] Status: "Deployed"
- [ ] Teste com JSON funcionou

---

**Pronto! A função está deployada e pronta para usar! 🚀**

