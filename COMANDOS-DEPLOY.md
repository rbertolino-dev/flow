# 🚀 Comandos para Deploy - Workflows Periódicos

## ⚠️ IMPORTANTE: Execute na ordem abaixo

### 1️⃣ Aplicar Migração no Banco de Dados

**Opção A - Via Supabase CLI (recomendado):**
```powershell
cd C:\Users\Rubens\lovable\agilize
supabase db push
```

**Opção B - Via Supabase Dashboard:**
1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix
2. Vá em **SQL Editor**
3. Abra o arquivo: `supabase/migrations/20251114130000_add_whatsapp_workflows.sql`
4. Cole todo o conteúdo e execute

**Verificar se funcionou:**
- No Dashboard, vá em **Table Editor**
- Deve aparecer as tabelas:
  - `whatsapp_workflow_lists`
  - `whatsapp_workflows`
  - `whatsapp_workflow_attachments`
- Vá em **Storage** e verifique se o bucket `whatsapp-workflow-media` existe

---

### 2️⃣ Deploy da Função Edge

```powershell
cd C:\Users\Rubens\lovable\agilize
supabase functions deploy process-whatsapp-workflows
```

**Verificar se funcionou:**
- No Dashboard, vá em **Edge Functions**
- Deve aparecer `process-whatsapp-workflows` na lista
- Clique e teste manualmente (botão "Invoke")

---

### 3️⃣ Configurar Agendamento Automático (Cron Job)

**Via Supabase Dashboard:**
1. Vá em **Database** > **Cron Jobs** (ou **Database** > **Extensions** > **pg_cron**)
2. Clique em **New Cron Job**
3. Configure:
   - **Name:** `process_whatsapp_workflows`
   - **Schedule:** `*/5 * * * *` (a cada 5 minutos)
   - **Command:** 
     ```sql
     SELECT net.http_post(
       url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb
     );
     ```
   - Substitua `SEU_SERVICE_ROLE_KEY` pela chave do seu projeto (encontre em Settings > API)

**OU via SQL direto:**
```sql
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

---

### 4️⃣ Verificar Build do Frontend

```powershell
cd C:\Users\Rubens\lovable\agilize
npm run build
```

Se der erro, corrija antes de continuar.

---

### 5️⃣ Executar Checklist de Regressão

```powershell
npm run regression
```

Isso roda `lint` + `build` automaticamente.

---

### 6️⃣ Testar Manualmente no App

1. Inicie o app:
   ```powershell
   npm run dev
   ```

2. Acesse: http://localhost:5173/whatsapp/workflows

3. **Teste criar uma lista:**
   - Clique em "Nova lista" ou "Gerenciar listas"
   - Adicione um nome e contatos
   - Salve

4. **Teste criar um workflow:**
   - Clique em "Novo workflow"
   - Preencha:
     - Nome: "Teste Mensal"
     - Tipo: Cobrança
     - Lista: Selecione a lista criada
     - Periodicidade: Mensal, dia 1
     - Horário: 09:00
     - Template: Selecione um template existente ou crie mensagem customizada
   - Salve

5. **Verificar se funcionou:**
   - No Supabase Dashboard > Table Editor > `whatsapp_workflows`
   - Deve aparecer o workflow criado
   - Verifique se `next_run_at` está preenchido corretamente

6. **Testar execução manual da função:**
   - No Dashboard > Edge Functions > `process-whatsapp-workflows`
   - Clique em "Invoke"
   - Verifique os logs
   - Vá em `scheduled_messages` e veja se foram criados registros com `workflow_id` preenchido

---

### 7️⃣ Verificar Logs e Monitoramento

**Ver logs da função:**
- Dashboard > Edge Functions > `process-whatsapp-workflows` > Logs

**Verificar scheduled_messages:**
- Dashboard > Table Editor > `scheduled_messages`
- Filtre por `workflow_id IS NOT NULL` para ver apenas os criados pelos workflows

---

## ✅ Checklist Final

- [ ] Migração aplicada (tabelas criadas)
- [ ] Bucket `whatsapp-workflow-media` existe
- [ ] Função `process-whatsapp-workflows` deployada
- [ ] Cron job configurado (ou vai rodar manualmente por enquanto)
- [ ] Build do frontend OK
- [ ] Checklist de regressão passou
- [ ] Teste manual: criar lista OK
- [ ] Teste manual: criar workflow OK
- [ ] Teste manual: função executa e cria scheduled_messages

---

## 🆘 Problemas Comuns

**Erro: "relation does not exist"**
- A migração não foi aplicada. Execute o passo 1 novamente.

**Erro: "bucket does not exist"**
- A migração não criou o bucket. Execute manualmente no SQL Editor:
  ```sql
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('whatsapp-workflow-media', 'whatsapp-workflow-media', true)
  ON CONFLICT DO NOTHING;
  ```

**Função não executa**
- Verifique se o `SERVICE_ROLE_KEY` está correto no cron job
- Verifique os logs da função no Dashboard

**Workflow não cria scheduled_messages**
- Verifique se a lista tem contatos válidos (com `lead_id` e `phone`)
- Verifique se o workflow está `is_active = true`
- Verifique se `next_run_at` está no passado ou próximo

