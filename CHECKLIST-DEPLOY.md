# ✅ Checklist de Deploy - Workflows Periódicos

## Status Atual

- [x] Build do frontend concluído
- [x] Código commitado e sincronizado no GitHub
- [ ] **Migrações aplicadas no banco de dados**
- [ ] **Função Edge deployada**
- [ ] Cron Job configurado (opcional)

---

## 📋 Passos para Finalizar o Deploy

### 1️⃣ Aplicar Migrações (OBRIGATÓRIO)

**Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

**Execute na ordem:**

#### a) Primeira migração:
- Arquivo: `supabase/migrations/20251114130000_add_whatsapp_workflows.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor
- Clique em **RUN**

#### b) Segunda migração:
- Arquivo: `supabase/migrations/20251114140000_add_workflow_approval_and_contact_files.sql`
- Copie TODO o conteúdo
- Cole no SQL Editor
- Clique em **RUN**

**✅ Verificar:**
- Vá em **Table Editor** → Deve aparecer:
  - `whatsapp_workflow_lists`
  - `whatsapp_workflows`
  - `whatsapp_workflow_attachments`
  - `whatsapp_workflow_contact_attachments`
  - `whatsapp_workflow_approvals`
- Vá em **Storage** → Deve aparecer o bucket `whatsapp-workflow-media`

---

### 2️⃣ Deploy da Função Edge (OBRIGATÓRIO)

**Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions

**Passos:**
1. Clique em **Create a new function**
2. Nome: `process-whatsapp-workflows`
3. Abra o arquivo: `supabase/functions/process-whatsapp-workflows/index.ts`
4. Copie TODO o conteúdo
5. Cole no editor da função
6. Clique em **Deploy**

**✅ Verificar:**
- A função deve aparecer na lista com status "Active"
- Clique na função → **Invoke** → Deve retornar `{"success": true, "processed": 0}`

---

### 3️⃣ Configurar Cron Job (OPCIONAL)

**Acesse:** https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new

**Execute o SQL abaixo** (substitua `SEU_SERVICE_ROLE_KEY_AQUI`):

```sql
-- Habilitar extensao pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criar cron job (executa a cada 5 minutos)
SELECT cron.schedule(
  'process-whatsapp-workflows',
  '*/5 * * * *',
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

**Para pegar o SERVICE_ROLE_KEY:**
- Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/settings/api
- Role: **service_role** → Copie a key
- Substitua `SEU_SERVICE_ROLE_KEY_AQUI` no SQL acima

---

### 4️⃣ Testar no App

```powershell
cd C:\Users\Rubens\lovable\agilize
npm run dev
```

**Acesse:** http://localhost:5174/workflows

**Teste:**
1. Criar uma lista de contatos
2. Criar um workflow de teste
3. Verificar se aparece na listagem

---

## 🎯 Resumo

**O que já está pronto:**
- ✅ Código desenvolvido e testado
- ✅ Build funcionando
- ✅ Tudo commitado no GitHub

**O que você precisa fazer AGORA:**
1. ⏳ Aplicar as 2 migrações no Supabase Dashboard
2. ⏳ Deploy da função Edge no Supabase Dashboard
3. ⏳ (Opcional) Configurar Cron Job

**Tempo estimado:** 10-15 minutos

---

## 🆘 Precisa de Ajuda?

Se tiver dúvidas ou erros durante o deploy, me avise que eu ajudo a resolver!

