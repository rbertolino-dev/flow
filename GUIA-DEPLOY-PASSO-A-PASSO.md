# 🚀 Guia Completo de Deploy - Workflows Periódicos

## ✅ Status Atual
- ✅ Build do frontend: **OK** (passou)
- ✅ Script de deploy: **Funcionando**
- ⚠️ Lint: Erros pré-existentes (podem ser ignorados por enquanto)
- ⏳ **Próximo**: Aplicar migração e deploy da função

---

## 📋 OPÇÃO 1: Via Supabase Dashboard (RECOMENDADO - Mais Fácil)

### Passo 1: Aplicar Migração no Banco

1. **Acesse o Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix
   - Faça login se necessário

2. **Vá em SQL Editor:**
   - Menu lateral esquerdo → **SQL Editor**

3. **Cole o conteúdo da migração:**
   - Abra o arquivo: `supabase/migrations/20251114130000_add_whatsapp_workflows.sql`
   - **Copie TODO o conteúdo** do arquivo
   - Cole no SQL Editor do Supabase
   - Clique em **RUN** (ou pressione Ctrl+Enter)

4. **Verificar se funcionou:**
   - Vá em **Table Editor** (menu lateral)
   - Deve aparecer as novas tabelas:
     - ✅ `whatsapp_workflow_lists`
     - ✅ `whatsapp_workflows`
     - ✅ `whatsapp_workflow_attachments`
   - Vá em **Storage** → Deve aparecer o bucket `whatsapp-workflow-media`

---

### Passo 2: Deploy da Função Edge

1. **No Dashboard, vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

2. **Criar/Atualizar função:**
   - Se já existe `process-whatsapp-workflows`, clique nela
   - Se não existe, clique em **Create a new function**
   - Nome: `process-whatsapp-workflows`

3. **Copiar código da função:**
   - Abra o arquivo: `supabase/functions/process-whatsapp-workflows/index.ts`
   - **Copie TODO o conteúdo**
   - Cole no editor da função no Dashboard
   - Clique em **Deploy**

4. **Verificar se funcionou:**
   - A função deve aparecer na lista com status "Active"
   - Clique na função → **Invoke** → Deve retornar `{"success": true, "processed": 0}`

---

### Passo 3: Configurar Cron Job (Agendamento Automático)

**IMPORTANTE:** Você precisa do SERVICE_ROLE_KEY primeiro!

1. **Pegar SERVICE_ROLE_KEY:**
   - Dashboard → **Settings** (ícone de engrenagem)
   - **API** → Role: `service_role`
   - Copie a **`service_role` key** (não a `anon` key!)

2. **Criar Cron Job via SQL:**
   - Vá em **SQL Editor** novamente
   - Cole o código abaixo (substitua `SEU_SERVICE_ROLE_KEY`):

```sql
-- Verificar se a extensão pg_cron está habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar o cron job (executa a cada 5 minutos)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *', -- A cada 5 minutos
  $$
  SELECT net.http_post(
    url := 'https://orcbxgajfhgmjobsjlix.supabase.co/functions/v1/process-whatsapp-workflows',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    )
  );
  $$
);
```

3. **Verificar se funcionou:**
   - Execute no SQL Editor:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'process-whatsapp-workflows';
   ```
   - Deve retornar 1 linha com os detalhes do job

---

## 📋 OPÇÃO 2: Via Supabase CLI (Se Preferir)

### Instalar Supabase CLI (se ainda não tem):

```powershell
# Via Scoop (recomendado no Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# OU via npm
npm install -g supabase
```

### Configurar projeto:

```powershell
cd C:\Users\Rubens\lovable\agilize
supabase login
supabase link --project-ref orcbxgajfhgmjobsjlix
```

### Aplicar migração:

```powershell
supabase db push
```

### Deploy da função:

```powershell
supabase functions deploy process-whatsapp-workflows
```

### Testar função:

```powershell
supabase functions invoke process-whatsapp-workflows
```

---

## 🧪 Testar no App

1. **Iniciar o app localmente:**
   ```powershell
   cd C:\Users\Rubens\lovable\agilize
   npm run dev
   ```

2. **Acessar a nova página:**
   - Abra: http://localhost:5173/whatsapp/workflows
   - Deve aparecer a página de workflows periódicos

3. **Criar uma lista de teste:**
   - Clique em "Gerenciar listas" ou "Nova lista"
   - Nome: "Lista Teste"
   - Adicione pelo menos 1 contato (com `lead_id` e `phone`)
   - Salve

4. **Criar um workflow de teste:**
   - Clique em "Novo workflow"
   - Preencha:
     - Nome: "Teste Mensal"
     - Tipo: Cobrança
     - Lista: Selecione "Lista Teste"
     - Periodicidade: Mensal, dia 1
     - Horário: 09:00
     - Data início: Hoje
     - Template: Selecione um template existente ou escreva uma mensagem
   - Salve

5. **Verificar no banco:**
   - Dashboard → Table Editor → `whatsapp_workflows`
   - Deve aparecer o workflow criado
   - Verifique se `next_run_at` está preenchido

6. **Testar execução manual:**
   - Dashboard → Edge Functions → `process-whatsapp-workflows`
   - Clique em **Invoke**
   - Verifique os logs
   - Vá em `scheduled_messages` → Deve aparecer registros com `workflow_id` preenchido

---

## ✅ Checklist Final

- [ ] Migração aplicada (tabelas criadas)
- [ ] Bucket `whatsapp-workflow-media` existe
- [ ] Função `process-whatsapp-workflows` deployada
- [ ] Cron job configurado (ou vai rodar manualmente)
- [ ] Teste: Criar lista OK
- [ ] Teste: Criar workflow OK
- [ ] Teste: Função executa e cria scheduled_messages

---

## 🆘 Problemas Comuns

**Erro: "relation does not exist"**
- A migração não foi aplicada. Execute o Passo 1 novamente.

**Erro: "bucket does not exist"**
- Execute manualmente no SQL Editor:
  ```sql
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('whatsapp-workflow-media', 'whatsapp-workflow-media', true)
  ON CONFLICT DO NOTHING;
  ```

**Função não executa**
- Verifique se o SERVICE_ROLE_KEY está correto no cron job
- Verifique os logs da função no Dashboard

**Workflow não cria scheduled_messages**
- Verifique se a lista tem contatos válidos (com `lead_id` e `phone`)
- Verifique se o workflow está `is_active = true`
- Verifique se `next_run_at` está no passado ou próximo

---

## 📞 Próximos Passos Após Deploy

1. Monitorar logs da função periodicamente
2. Ajustar frequência do cron se necessário
3. Criar workflows reais conforme necessidade
4. Documentar processos específicos da sua empresa

