# 🧪 Guia de Teste Local - Status do WhatsApp

## ✅ Pré-requisitos

Antes de testar localmente, você precisa:

1. ✅ **Aplicar a migration** no Supabase (tabela `whatsapp_status_posts`)
2. ✅ **Deploy das edge functions** (`publish-whatsapp-status` e `process-status-schedule`)
3. ✅ **Instância do WhatsApp conectada** na Evolution API
4. ✅ **Node.js instalado** (para rodar o frontend)

---

## 🚀 Passo 1: Aplicar Migration (Se ainda não fez)

### Via Supabase Dashboard:

1. Acesse: https://supabase.com/dashboard
2. Vá em **SQL Editor**
3. Abra o arquivo: `supabase/migrations/20250128000000_create_whatsapp_status_posts.sql`
4. **Copie TODO o conteúdo** e cole no SQL Editor
5. Clique em **RUN**

### Verificar se funcionou:

```sql
-- Execute no SQL Editor:
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'whatsapp_status_posts';
-- Deve retornar a tabela
```

---

## 🚀 Passo 2: Deploy das Edge Functions (Se ainda não fez)

### Função `publish-whatsapp-status`:

1. Dashboard → **Edge Functions**
2. Clique em **Create a new function**
3. Nome: `publish-whatsapp-status`
4. Abra: `supabase/functions/publish-whatsapp-status/index.ts`
5. **Copie TODO o conteúdo** e cole no editor
6. Clique em **Deploy**

### Função `process-status-schedule`:

1. Dashboard → **Edge Functions**
2. Clique em **Create a new function**
3. Nome: `process-status-schedule`
4. Abra: `supabase/functions/process-status-schedule/index.ts`
5. **Copie TODO o conteúdo** e cole no editor
6. Clique em **Deploy**

---

## 🚀 Passo 3: Rodar o Frontend Localmente

### No PowerShell:

```powershell
# Navegar para a pasta do projeto
cd C:\Users\Rubens\lovable\agilize

# Instalar dependências (se ainda não instalou)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### Acessar:

O app estará disponível em: **http://localhost:5173**

---

## 🧪 Passo 4: Testar a Funcionalidade

### 4.1. Acessar a Aba Status

1. No navegador, acesse: http://localhost:5173
2. Faça login (se necessário)
3. Vá para a página de **Disparo em Massa**
4. Clique na aba **"Status"** (ícone de imagem)

### 4.2. Criar um Status (Publicação Imediata)

1. Clique em **"Novo Status"**
2. **Selecione uma instância** conectada
3. **Faça upload de uma imagem**:
   - Clique ou arraste uma imagem (JPG, PNG, WEBP)
   - Aguarde o upload completar
4. **Adicione uma legenda** (opcional)
5. Selecione **"Publicar Agora"**
6. Clique em **"Publicar"**

### 4.3. Verificar se Funcionou

**No app:**
- O status deve aparecer na lista com status "Publicado"
- Deve mostrar a data/hora de publicação

**No WhatsApp:**
- Abra o WhatsApp da instância selecionada
- Verifique se o status foi publicado

**Nos logs (Supabase Dashboard):**
1. Vá em **Edge Functions** → `publish-whatsapp-status`
2. Clique em **Logs**
3. Procure por:
   - `📤 Publicando status via Evolution API`
   - `✅ Status publicado com sucesso`
   - OU `⚠️ Endpoint sendStatus retornou 406, tentando sendMedia...`

### 4.4. Testar Agendamento

1. Clique em **"Novo Status"**
2. Selecione instância
3. Faça upload de mídia
4. Adicione legenda (opcional)
5. Selecione **"Agendar"**
6. Escolha **data e hora** (futuro)
7. Clique em **"Agendar"**

**Verificar:**
- Status deve aparecer na lista com status "Pendente"
- Deve mostrar a data/hora agendada

**Processar agendamento manualmente:**
1. Dashboard → **Edge Functions** → `process-status-schedule`
2. Clique em **Invoke**
3. Verifique os logs
4. O status deve mudar para "Publicado" após processamento

---

## 🔍 Troubleshooting

### Erro: "Instância não encontrada"
- Verifique se a instância existe em `evolution_config`
- Verifique se `is_connected = true`

### Erro: "Instância não está conectada"
- Conecte a instância no WhatsApp primeiro
- Verifique o QR Code se necessário

### Erro: 406 (Not Acceptable)
- Isso é normal! A função detecta e tenta `sendMedia` automaticamente
- Verifique os logs para ver qual método funcionou

### Status não aparece na lista
- Verifique se você está logado na organização correta
- Verifique as políticas RLS no Supabase

### Upload de mídia falha
- Verifique se o bucket `whatsapp-workflow-media` existe
- Verifique se você tem permissão para upload
- Verifique o tamanho do arquivo (máx. 16MB)

### Status não é publicado no WhatsApp
- Verifique os logs da edge function
- Verifique se a Evolution API suporta status na sua versão
- Verifique se a instância tem número de telefone configurado

---

## 📊 Verificar no Banco de Dados

### Ver status criados:

```sql
-- Execute no SQL Editor:
SELECT 
  id,
  instance_id,
  media_type,
  status,
  scheduled_for,
  published_at,
  error_message,
  created_at
FROM whatsapp_status_posts
ORDER BY created_at DESC
LIMIT 10;
```

### Ver detalhes de um status específico:

```sql
-- Substitua 'ID_DO_STATUS' pelo ID real
SELECT * 
FROM whatsapp_status_posts 
WHERE id = 'ID_DO_STATUS';
```

---

## 🎯 Checklist de Teste

- [ ] Migration aplicada (tabela `whatsapp_status_posts` existe)
- [ ] Edge functions deployadas
- [ ] Frontend rodando localmente (`npm run dev`)
- [ ] Aba "Status" visível na página de Disparo em Massa
- [ ] Consegue criar status com publicação imediata
- [ ] Status aparece publicado no WhatsApp
- [ ] Consegue agendar status
- [ ] Status agendado aparece na lista como "Pendente"
- [ ] Processamento manual funciona (via Invoke da função)
- [ ] Logs mostram qual método funcionou (sendStatus ou sendMedia)

---

## 💡 Dicas

1. **Teste primeiro com publicação imediata** para verificar se está funcionando
2. **Verifique os logs** sempre que algo não funcionar
3. **Use imagens pequenas** para teste (menos de 1MB)
4. **Verifique o console do navegador** (F12) para erros do frontend
5. **Teste com diferentes instâncias** se tiver múltiplas

---

## 🆘 Precisa de Ajuda?

Se encontrar problemas:

1. Verifique os logs da edge function no Supabase Dashboard
2. Verifique o console do navegador (F12)
3. Verifique se a migration foi aplicada corretamente
4. Verifique se as funções foram deployadas
5. Me avise qual erro específico está aparecendo!

