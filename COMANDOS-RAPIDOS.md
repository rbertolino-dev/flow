# ⚡ Comandos Rápidos - Copiar e Colar

## 🎯 Passo 1: Aplicar Migração (SQL Editor do Supabase)

1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/sql/new
2. Abra o arquivo: `supabase/migrations/20251114130000_add_whatsapp_workflows.sql`
3. **Copie TODO o conteúdo** e cole no SQL Editor
4. Clique em **RUN**

---

## 🎯 Passo 2: Deploy da Função (Edge Functions)

1. Acesse: https://supabase.com/dashboard/project/orcbxgajfhgmjobsjlix/functions
2. Clique em **Create a new function**
3. Nome: `process-whatsapp-workflows`
4. Abra: `supabase/functions/process-whatsapp-workflows/index.ts`
5. **Copie TODO o conteúdo** e cole no editor
6. Clique em **Deploy**

---

## 🎯 Passo 3: Criar Cron Job (SQL Editor)

**Primeiro, pegue seu SERVICE_ROLE_KEY:**
- Dashboard → Settings → API → Role: `service_role` → Copie a key

**Depois, execute este SQL (substitua SEU_SERVICE_ROLE_KEY):**

```sql
-- Habilitar extensão pg_cron
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

---

## 🎯 Passo 4: Testar

1. **Iniciar app:**
   ```powershell
   cd C:\Users\Rubens\lovable\agilize
   npm run dev
   ```

2. **Acessar:** http://localhost:5173/whatsapp/workflows

3. **Criar lista e workflow de teste**

4. **Testar função manualmente:**
   - Dashboard → Edge Functions → `process-whatsapp-workflows` → **Invoke**

5. **Verificar:**
   - Table Editor → `scheduled_messages` → Deve ter registros com `workflow_id`

---

## ✅ Verificações Rápidas

```sql
-- Verificar se tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'whatsapp_workflow%';

-- Verificar se bucket existe
SELECT * FROM storage.buckets WHERE id = 'whatsapp-workflow-media';

-- Verificar cron job
SELECT * FROM cron.job WHERE jobname = 'process-whatsapp-workflows';
```

---

## 📚 Documentação Completa

Para mais detalhes, veja: `GUIA-DEPLOY-PASSO-A-PASSO.md`

