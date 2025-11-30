# 🚀 Guia de Deploy - Status do WhatsApp

## ✅ Checklist de Deploy

### 1. Aplicar Migration no Banco de Dados

**Via Supabase Dashboard (Recomendado):**

1. Acesse o Supabase Dashboard:
   - URL: https://supabase.com/dashboard
   - Faça login se necessário

2. Vá em **SQL Editor**:
   - Menu lateral esquerdo → **SQL Editor**

3. Cole o conteúdo da migration:
   - Abra o arquivo: `supabase/migrations/20250128000000_create_whatsapp_status_posts.sql`
   - **Copie TODO o conteúdo** do arquivo
   - Cole no SQL Editor do Supabase
   - Clique em **RUN** (ou pressione Ctrl+Enter)

4. Verificar se funcionou:
   - Vá em **Table Editor** (menu lateral)
   - Deve aparecer a nova tabela: `whatsapp_status_posts`
   - Verifique se as políticas RLS foram criadas em **Authentication** → **Policies**

---

### 2. Deploy das Edge Functions

#### 2.1. Função `publish-whatsapp-status`

1. **No Dashboard, vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

2. **Criar nova função:**
   - Clique em **Create a new function**
   - Nome: `publish-whatsapp-status`

3. **Copiar código da função:**
   - Abra o arquivo: `supabase/functions/publish-whatsapp-status/index.ts`
   - **Copie TODO o conteúdo**
   - Cole no editor da função no Dashboard
   - Clique em **Deploy**

4. **Verificar se funcionou:**
   - A função deve aparecer na lista com status "Active"
   - Clique na função → **Invoke** → Teste com:
   ```json
   {
     "instanceId": "seu-instance-id",
     "mediaUrl": "https://exemplo.com/imagem.jpg",
     "mediaType": "image",
     "caption": "Teste"
   }
   ```

#### 2.2. Função `process-status-schedule`

1. **Criar nova função:**
   - Clique em **Create a new function**
   - Nome: `process-status-schedule`

2. **Copiar código da função:**
   - Abra o arquivo: `supabase/functions/process-status-schedule/index.ts`
   - **Copie TODO o conteúdo**
   - Cole no editor da função no Dashboard
   - Clique em **Deploy**

3. **Verificar se funcionou:**
   - A função deve aparecer na lista com status "Active"
   - Clique na função → **Invoke** → Deve retornar `{"success": true, "processed": 0}`

---

### 3. Configurar Cron Job (Opcional - Para Processar Agendamentos Automaticamente)

**Opção A: Via Supabase Dashboard (Cron Jobs)**

1. Vá em **Database** → **Cron Jobs**
2. Clique em **Create a new cron job**
3. Configure:
   - **Name**: `process-status-schedule`
   - **Schedule**: `*/5 * * * *` (a cada 5 minutos)
   - **SQL Command**:
   ```sql
   SELECT net.http_post(
     url := 'https://SEU_PROJECT_ID.supabase.co/functions/v1/process-status-schedule',
     headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_SERVICE_ROLE_KEY"}'::jsonb,
     body := '{}'::jsonb
   );
   ```
   - Substitua `SEU_PROJECT_ID` e `SEU_SERVICE_ROLE_KEY` pelos valores corretos

**Opção B: Via n8n ou Outro Agendador Externo**

- Configure um webhook que chame a função `process-status-schedule` a cada 5 minutos

---

### 4. Verificar Frontend

1. **Verificar se o código foi compilado:**
   ```bash
   cd agilize
   npm run build
   ```

2. **Verificar se não há erros:**
   - O build deve completar sem erros
   - Verifique se todos os imports estão corretos

3. **Testar localmente (opcional):**
   ```bash
   npm run dev
   ```
   - Acesse a página de Disparo em Massa
   - Verifique se a aba "Status" aparece
   - Teste criar um novo status

---

## 📋 Verificação Final

Após o deploy, verifique:

- [ ] Tabela `whatsapp_status_posts` criada no banco
- [ ] Políticas RLS aplicadas corretamente
- [ ] Função `publish-whatsapp-status` deployada e funcionando
- [ ] Função `process-status-schedule` deployada e funcionando
- [ ] Cron job configurado (se aplicável)
- [ ] Frontend compilando sem erros
- [ ] Aba "Status" visível na página de Disparo em Massa

---

## 🐛 Troubleshooting

### Erro: "Instância não encontrada"
- Verifique se a instância existe em `evolution_config`
- Verifique se o `instanceId` está correto

### Erro: "Instância não está conectada"
- Verifique se `is_connected = true` na tabela `evolution_config`
- Teste a conexão da instância antes de publicar

### Erro: "Falha ao publicar status"
- Verifique os logs da Evolution API
- Verifique se a URL da mídia é acessível publicamente
- Verifique se o formato da mídia é suportado (JPG, PNG, MP4)

### Status não aparece na lista
- Verifique se o `organization_id` está correto
- Verifique as políticas RLS
- Verifique se o usuário está autenticado

---

## 📝 Notas Importantes

1. **Bucket de Storage**: A funcionalidade usa o bucket `whatsapp-workflow-media` que já deve existir. Se não existir, crie-o no Supabase Storage.

2. **Limites de Upload**: 
   - Imagens: JPG, PNG, WEBP (máx. 16MB)
   - Vídeos: MP4 (máx. 16MB)

3. **Evolution API**: Certifique-se de que a Evolution API suporta publicação de status. Algumas versões podem precisar de endpoints específicos.

4. **Agendamento**: O processamento de agendamentos é feito pela função `process-status-schedule`. Configure um cron job para executá-la periodicamente.

---

## ✅ Deploy Concluído!

Após seguir todos os passos, a funcionalidade de Status do WhatsApp estará disponível na aba "Status" da página de Disparo em Massa.

