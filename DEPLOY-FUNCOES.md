# 🚀 Deploy das Funções Edge

## ⚠️ IMPORTANTE: Faça o deploy das funções após aplicar as migrações

### 📋 Funções que precisam ser deployadas:

1. **asaas-create-charge** (Nova - Integração Asaas)
2. **process-whatsapp-workflows** (Atualizada - Suporte a grupos e anexos por mês)

---

## 🔧 Método 1: Via Supabase Dashboard (Recomendado)

### Para a função `asaas-create-charge`:

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Edge Functions** (menu lateral)
4. Clique em **Create a new function**
5. Nome da função: `asaas-create-charge`
6. Abra o arquivo: `supabase/functions/asaas-create-charge/index.ts`
7. Copie TODO o conteúdo do arquivo
8. Cole no editor do Dashboard
9. Clique em **Deploy**

### Para a função `process-whatsapp-workflows`:

1. No Dashboard, vá em **Edge Functions**
2. Encontre a função `process-whatsapp-workflows`
3. Clique nela para editar
4. Abra o arquivo: `supabase/functions/process-whatsapp-workflows/index.ts`
5. Copie TODO o conteúdo do arquivo atualizado
6. Substitua o conteúdo antigo no Dashboard
7. Clique em **Deploy**

---

## 🔧 Método 2: Via Supabase CLI (Se tiver instalado)

### Instalar Supabase CLI (se necessário):

**Windows (via Scoop):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Ou via npm:**
```bash
npm install -g supabase
```

### Fazer login:
```bash
supabase login
```

### Linkar ao projeto:
```bash
supabase link --project-ref seu-project-ref
```

### Deploy das funções:
```bash
cd C:\Users\Rubens\lovable\agilize

# Deploy da função Asaas
supabase functions deploy asaas-create-charge

# Deploy da função de workflows (atualizada)
supabase functions deploy process-whatsapp-workflows
```

---

## ✅ Verificação após deploy

### No Dashboard:

1. Vá em **Edge Functions**
2. Verifique se ambas as funções aparecem na lista:
   - ✅ `asaas-create-charge`
   - ✅ `process-whatsapp-workflows`

### Testar manualmente:

1. Clique em uma das funções
2. Vá na aba **Invoke**
3. Clique em **Invoke** para testar
4. Verifique os logs para ver se funcionou

---

## 📝 Arquivos das funções:

- **Asaas:** `supabase/functions/asaas-create-charge/index.ts`
- **Workflows:** `supabase/functions/process-whatsapp-workflows/index.ts`

---

## 🆘 Problemas comuns

**Erro: "Function not found"**
- A função ainda não foi criada. Use o Método 1 para criar.

**Erro: "Permission denied"**
- Verifique se você está logado no Supabase CLI
- Verifique se tem permissões no projeto

**Erro: "Module not found"**
- Verifique se todos os imports estão corretos
- Verifique se as dependências estão no código

---

**Última atualização:** Janeiro 2025

