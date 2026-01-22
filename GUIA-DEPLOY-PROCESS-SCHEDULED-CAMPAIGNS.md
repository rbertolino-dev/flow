# 🚀 Guia Completo - Deploy da Edge Function `process-scheduled-campaigns`

## 📋 O que esta função faz

A função `process-scheduled-campaigns` verifica automaticamente a cada minuto se há campanhas agendadas que devem iniciar e as inicia automaticamente.

**Funcionalidades:**
- ✅ Verifica campanhas com `status = 'draft'` e `scheduled_start_at` preenchido
- ✅ Inicia campanhas cujo horário agendado já passou
- ✅ Agenda mensagens na fila de broadcast
- ✅ Atualiza status da campanha para `running`
- ✅ Limpa `scheduled_start_at` após iniciar

---

## 🎯 Passo 1: Verificar Arquivo Local

**Antes de fazer deploy, verifique se o arquivo existe:**

```bash
cd /root/kanban-buzz-95241
ls -lh supabase/functions/process-scheduled-campaigns/index.ts
```

**Resultado esperado:**
```
-rw-r--r-- 1 root root 7.9K Jan 22 17:36 supabase/functions/process-scheduled-campaigns/index.ts
```

✅ Se o arquivo existe, continue para o próximo passo.

---

## 🚀 Passo 2: Fazer Deploy da Edge Function

### **Método 1: Via Supabase Dashboard (Recomendado - Mais Fácil)**

#### 2.1 Acessar o Dashboard

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login com suas credenciais

2. **Navegar para Edge Functions:**
   - Menu lateral esquerdo → **Edge Functions**
   - Ou clique em **Functions** na lista de opções

#### 2.2 Criar ou Encontrar a Função

**Se a função NÃO existe ainda:**
1. Clique em **"Create a new function"** ou **"New Function"**
2. Nome da função: `process-scheduled-campaigns`
   - ⚠️ **IMPORTANTE:** O nome deve ser exatamente `process-scheduled-campaigns` (com hífens)
3. Clique em **Create** ou **Next**

**Se a função JÁ existe:**
1. Procure por `process-scheduled-campaigns` na lista
2. Clique na função para editar

#### 2.3 Copiar o Código

1. **Abrir o arquivo local:**
   ```bash
   cat supabase/functions/process-scheduled-campaigns/index.ts
   ```
   Ou abra no editor: `supabase/functions/process-scheduled-campaigns/index.ts`

2. **Copiar TODO o conteúdo:**
   - Selecione tudo: `Ctrl+A` (Windows/Linux) ou `Cmd+A` (Mac)
   - Copie: `Ctrl+C` (Windows/Linux) ou `Cmd+C` (Mac)

#### 2.4 Colar no Dashboard

1. **No editor da função no Dashboard:**
   - Selecione TODO o conteúdo antigo (se houver): `Ctrl+A` ou `Cmd+A`
   - Cole o novo código: `Ctrl+V` ou `Cmd+V`
   - ⚠️ **IMPORTANTE:** Substitua TODO o conteúdo antigo

2. **Verificar o código:**
   - Deve começar com: `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";`
   - Deve ter a função `serve(async (req) => { ... })`
   - Deve ter logs com `📅 [process-scheduled-campaigns]`

#### 2.5 Fazer Deploy

1. **Clique em "Deploy" ou "Save":**
   - Botão geralmente fica no canto superior direito
   - Ou no final da página

2. **Aguardar confirmação:**
   - O deploy leva de 30 segundos a 2 minutos
   - Você verá uma mensagem de sucesso: "Function deployed successfully"
   - Status mudará para **"Active"** (verde)

---

### **Método 2: Via Supabase CLI (Alternativa)**

#### 2.1 Verificar se CLI está instalado

```bash
supabase --version
```

**Se não estiver instalado:**

**Linux/Mac:**
```bash
# Via Homebrew
brew install supabase/tap/supabase

# Ou via npm
npm install -g supabase
```

**Windows:**
```powershell
# Via Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Ou via npm
npm install -g supabase
```

#### 2.2 Fazer Login

```bash
supabase login
```

Siga as instruções para autenticar (abrirá navegador).

#### 2.3 Linkar ao Projeto

```bash
cd /root/kanban-buzz-95241
supabase link --project-ref ogeljmbhqxpfjbpnbwog
```

#### 2.4 Fazer Deploy

```bash
supabase functions deploy process-scheduled-campaigns
```

**Resultado esperado:**
```
Deploying function process-scheduled-campaigns...
Function process-scheduled-campaigns deployed successfully
```

---

## ✅ Passo 3: Verificar Deploy Bem-Sucedido

### 3.1 Verificar no Dashboard

1. **Vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

2. **Verificar a função:**
   - ✅ `process-scheduled-campaigns` deve aparecer na lista
   - ✅ Status deve ser **"Active"** (verde)
   - ✅ Última atualização deve ser a data/hora atual

3. **Verificar configuração:**
   - Clique na função
   - Vá em **Settings** ou **Details**
   - Verifique que **verify_jwt** está como **false** (correto para cron jobs)

### 3.2 Testar a Função

1. **No Dashboard, clique na função `process-scheduled-campaigns`**
2. **Vá na aba "Invoke" ou "Test"**
3. **Clique em "Invoke Function" ou "Test"**
4. **Verifique os logs:**
   - Deve aparecer: `📅 [process-scheduled-campaigns] Iniciando verificação...`
   - Se não houver campanhas: `Nenhuma campanha agendada para iniciar`
   - Se houver erro, verifique os logs detalhados

### 3.3 Verificar Acesso HTTP

```bash
curl -X POST \
  "https://ogeljmbhqxpfjbpnbwog.supabase.co/functions/v1/process-scheduled-campaigns" \
  -H "Authorization: Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Resultado esperado:**
- ✅ Status `200 OK` (não mais 404)
- ✅ Resposta JSON: `{"processed": 0, "message": "Nenhuma campanha agendada para iniciar"}`

---

## 🔧 Passo 4: Executar SQL Script (Criar Cron Job)

**⚠️ IMPORTANTE:** A função sozinha não funciona! É necessário criar o cron job que a chama automaticamente.

### 4.1 Executar SQL Script

1. **Acesse o Supabase SQL Editor:**
   - Dashboard → **SQL Editor** (menu lateral)

2. **Abrir o arquivo SQL:**
   ```bash
   cat DEPLOY-CAMPANHAS-AGENDADAS-FINAL.sql
   ```

3. **Copiar TODO o conteúdo do arquivo**

4. **Colar no SQL Editor:**
   - Cole o SQL no editor
   - Clique em **Run** ou **Execute**

5. **Verificar resultado:**
   - Deve aparecer: `Success. No rows returned`
   - Ou mensagem de sucesso

### 4.2 Verificar Cron Job Criado

**No SQL Editor, execute:**

```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'process-scheduled-campaigns';
```

**Resultado esperado:**
```
jobname                      | schedule    | active
-----------------------------|-------------|-------
process-scheduled-campaigns  | */1 * * * * | true
```

✅ Se aparecer essa linha, o cron job foi criado com sucesso!

---

## 🔍 Passo 5: Verificar Logs (Após Primeira Execução)

### 5.1 Aguardar Primeira Execução

O cron job executa **a cada minuto**. Aguarde 1-2 minutos após criar o cron job.

### 5.2 Verificar Logs no Dashboard

1. **Vá em Edge Functions:**
   - Dashboard → **Edge Functions** → `process-scheduled-campaigns`

2. **Vá na aba "Logs":**
   - Clique na aba **Logs** ou **Invocation Logs**

3. **Verificar logs recentes:**
   - Deve aparecer logs a cada minuto
   - Procure por: `📅 [process-scheduled-campaigns] Iniciando verificação...`
   - Se houver campanhas: `📋 Encontradas X campanha(s) para iniciar`
   - Se não houver: `Nenhuma campanha agendada para iniciar`

### 5.3 Logs Esperados

**Logs normais (sem campanhas):**
```
📅 [process-scheduled-campaigns] Iniciando verificação de campanhas agendadas...
📋 Encontradas 0 campanha(s) para iniciar
```

**Logs quando encontra campanha:**
```
📅 [process-scheduled-campaigns] Iniciando verificação de campanhas agendadas...
📋 Encontradas 1 campanha(s) para iniciar
🚀 Iniciando campanha agendada: Nome da Campanha
✅ Campanha iniciada com sucesso
```

**Logs de erro:**
```
❌ Erro ao processar campanha: [detalhes do erro]
```

---

## 🧪 Passo 6: Testar Funcionalidade Completa

### 6.1 Criar Campanha de Teste

1. **No sistema, vá em "Disparador em Massa" ou "Campanhas"**
2. **Crie uma nova campanha:**
   - Preencha os dados básicos
   - **IMPORTANTE:** Marque "Agendar início" e defina um horário **2-3 minutos no futuro**
   - Salve a campanha

### 6.2 Verificar no Banco de Dados

**No SQL Editor, execute:**

```sql
SELECT id, name, status, scheduled_start_at, created_at
FROM broadcast_campaigns
WHERE scheduled_start_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Verifique:**
- ✅ `status` deve ser `'draft'`
- ✅ `scheduled_start_at` deve ter o horário agendado
- ✅ Horário deve ser no futuro (mas próximo)

### 6.3 Aguardar Execução

Aguarde até o horário agendado passar (2-3 minutos).

### 6.4 Verificar Início Automático

**Após o horário agendado, verifique:**

```sql
SELECT id, name, status, scheduled_start_at, started_at
FROM broadcast_campaigns
WHERE id = 'ID_DA_CAMPANHA_DE_TESTE';
```

**Resultado esperado:**
- ✅ `status` mudou de `'draft'` para `'running'`
- ✅ `started_at` foi preenchido (horário de início)
- ✅ `scheduled_start_at` foi limpo (NULL)

### 6.5 Verificar Logs da Função

No Dashboard, verifique os logs da função:
- Deve aparecer: `🚀 Iniciando campanha agendada: [nome]`
- Deve aparecer: `✅ Campanha iniciada com sucesso`

---

## ❌ Troubleshooting (Solução de Problemas)

### Problema 1: Função retorna 404

**Sintoma:** `curl` retorna 404 ou função não aparece no Dashboard

**Solução:**
- ✅ Verifique se o deploy foi concluído com sucesso
- ✅ Aguarde 1-2 minutos após deploy
- ✅ Verifique se o nome da função está correto: `process-scheduled-campaigns`

### Problema 2: Cron job não executa

**Sintoma:** Logs não aparecem a cada minuto

**Solução:**
1. **Verificar se cron job existe:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-scheduled-campaigns';
   ```

2. **Verificar se está ativo:**
   ```sql
   SELECT jobname, active FROM cron.job WHERE jobname = 'process-scheduled-campaigns';
   ```
   - Se `active = false`, execute:
   ```sql
   UPDATE cron.job SET active = true WHERE jobname = 'process-scheduled-campaigns';
   ```

3. **Verificar extensões:**
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'http');
   ```
   - Se não aparecer, execute o SQL script novamente

### Problema 3: Função não inicia campanhas

**Sintoma:** Logs aparecem mas campanhas não iniciam

**Solução:**
1. **Verificar logs detalhados:**
   - No Dashboard, veja os logs completos
   - Procure por erros: `❌ Erro ao processar campanha`

2. **Verificar variáveis de ambiente:**
   - A função precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
   - Essas são configuradas automaticamente pelo Supabase
   - Se houver erro de autenticação, verifique as secrets

3. **Verificar estrutura da campanha:**
   ```sql
   SELECT id, name, status, scheduled_start_at, instance_id, sending_method
   FROM broadcast_campaigns
   WHERE scheduled_start_at IS NOT NULL AND status = 'draft';
   ```
   - Verifique se `instance_id` e `sending_method` estão preenchidos

### Problema 4: Erro de autenticação

**Sintoma:** Logs mostram `401 Unauthorized` ou `403 Forbidden`

**Solução:**
1. **Verificar SERVICE_ROLE_KEY:**
   - No Dashboard, vá em **Settings** → **API**
   - Copie o **service_role key** (não o anon key)
   - Verifique se está sendo usado no cron job

2. **Verificar configuração do cron job:**
   ```sql
   SELECT jobname, command 
   FROM cron.job 
   WHERE jobname = 'process-scheduled-campaigns';
   ```
   - Verifique se o header `Authorization` está correto
   - Deve usar `Bearer sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm` (ou service_role key)

---

## 📋 Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] ✅ Edge function `process-scheduled-campaigns` aparece no Dashboard
- [ ] ✅ Status da função é **"Active"**
- [ ] ✅ Teste HTTP retorna 200 (não mais 404)
- [ ] ✅ Cron job `process-scheduled-campaigns` existe e está ativo
- [ ] ✅ Logs aparecem a cada minuto no Dashboard
- [ ] ✅ Teste com campanha agendada funcionou (campanha iniciou automaticamente)
- [ ] ✅ Logs mostram mensagens de sucesso

---

## 🎉 Conclusão

Se todos os itens do checklist estão marcados, o deploy foi bem-sucedido! 

A funcionalidade de **início automático de campanhas agendadas** está funcionando e as campanhas serão iniciadas automaticamente no horário determinado.

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs detalhados no Dashboard
2. Execute os comandos SQL de verificação
3. Consulte a seção de Troubleshooting acima

---

**Data de criação:** 22/01/2026  
**Última atualização:** 22/01/2026
