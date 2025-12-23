# 🚀 Deploy da Edge Function `create-evolution-instance`

## ⚠️ IMPORTANTE: Esta função foi atualizada com logs detalhados

A função `create-evolution-instance` foi atualizada com:
- ✅ Logs detalhados em cada etapa
- ✅ Tratamento de erros específicos (códigos PostgreSQL)
- ✅ Validação de variáveis de ambiente
- ✅ Retry automático em caso de conflito de UUID

---

## 📋 Como fazer o deploy:

### Método 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard
   - Faça login e selecione seu projeto

2. **Vá em Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**

3. **Encontre a função `create-evolution-instance`:**
   - Se a função já existe, clique nela para editar
   - Se não existe, clique em **Create a new function** e nomeie como `create-evolution-instance`

4. **Copiar o código atualizado:**
   - Abra o arquivo: `supabase/functions/create-evolution-instance/index.ts`
   - **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)

5. **Colar no Dashboard:**
   - No editor da função no Dashboard
   - **Selecione TODO** o conteúdo antigo (Ctrl+A)
   - **Cole** o novo código (Ctrl+V)

6. **Fazer deploy:**
   - Clique em **Deploy** ou **Save**
   - Aguarde a confirmação

7. **Verificar se funcionou:**
   - A função deve aparecer na lista com status "Active"
   - Clique na função → **Logs** para ver os logs em tempo real

---

### Método 2: Via Supabase CLI (Se tiver instalado)

```bash
# Fazer login (se necessário)
supabase login

# Linkar ao projeto (se necessário)
supabase link --project-ref seu-project-ref

# Deploy da função
supabase functions deploy create-evolution-instance
```

---

## 🔍 Como verificar se está funcionando:

### 1. Verificar logs após tentar criar instância:

1. No Dashboard, vá em **Edge Functions**
2. Clique em `create-evolution-instance`
3. Vá na aba **Logs**
4. Tente criar uma instância novamente
5. Os logs mostrarão exatamente onde está falhando:
   - `[CREATE-EVOLUTION-INSTANCE] Iniciando requisição`
   - `[CREATE-EVOLUTION-INSTANCE] Verificando limites...`
   - `[CREATE-EVOLUTION-INSTANCE] Salvando no banco...`
   - etc.

### 2. Erros comuns e soluções:

**Erro: "Erro ao verificar limites da organização"**
- Verifique se a função RPC `can_create_evolution_instance` existe
- Verifique se `organization_limits` está configurado para a organização

**Erro: "Já existe uma instância com o nome..."**
- Escolha outro nome para a instância

**Erro: "Erro ao gerar webhook secret"**
- Problema com `crypto.randomUUID()` - muito raro, mas se acontecer, verifique logs

**Erro: "Erro ao salvar configuração"**
- Verifique se a tabela `evolution_config` existe
- Verifique se as colunas estão corretas (especialmente `webhook_secret` que é UUID)

---

## 📝 Próximos passos após deploy:

1. **Testar criação de instância:**
   - Vá em Configurações → Integrações → WhatsApp
   - Clique em "Nova Instância"
   - Preencha os dados e tente criar

2. **Verificar logs:**
   - Se der erro, vá em Edge Functions → `create-evolution-instance` → Logs
   - Os logs mostrarão exatamente onde está falhando

3. **Se ainda der erro:**
   - Copie os logs completos
   - Verifique qual etapa está falhando
   - Os logs têm prefixo `[CREATE-EVOLUTION-INSTANCE]` para facilitar busca

---

## ✅ Checklist de verificação:

- [ ] Função `create-evolution-instance` existe no Supabase Dashboard
- [ ] Código foi atualizado com a versão mais recente
- [ ] Função está com status "Active"
- [ ] Logs estão aparecendo quando tenta criar instância
- [ ] Teste de criação de instância foi realizado

