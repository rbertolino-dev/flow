# 🔧 Configurar Storage RLS via Dashboard do Supabase

**Projeto**: `ogeljmbhqxpfjbpnbwog`  
**Bucket**: `whatsapp-workflow-media`

---

## 📋 Passo 1: Configurar o Bucket

1. **Acesse Storage:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/storage/buckets
   - Ou: Dashboard > Storage > Buckets

2. **Criar ou Editar o Bucket:**
   - Se não existir, clique em **"New bucket"**
   - Se existir, clique no bucket `whatsapp-workflow-media`

3. **Configurações do Bucket:**
   - **Name**: `whatsapp-workflow-media`
   - **Public bucket**: ✅ **SIM** (marcado)
   - **File size limit**: `16777216` (16 MB)
   - **Allowed MIME types**: Adicione um por um:
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/webp`
     - `video/mp4`
     - `video/quicktime`
     - `video/x-msvideo`
     - `application/pdf`

4. **Salvar** o bucket

---

## 📋 Passo 2: Remover Políticas Antigas

1. **Acessar Policies:**
   - Vá em: Storage > Policies
   - Ou: Storage > whatsapp-workflow-media > Policies

2. **Remover TODAS as políticas antigas:**
   - Procure por políticas relacionadas a `whatsapp-workflow-media`
   - Clique em cada uma e depois em **"Delete"**
   - Remova todas que encontrar (mesmo que pareçam corretas)

---

## 📋 Passo 3: Criar Nova Política 1 - Leitura Pública

1. **Criar Nova Política:**
   - Clique em **"New Policy"** ou **"Create Policy"**

2. **Configurações:**
   - **Policy name**: `Public read access to workflow media`
   - **Allowed operation**: Selecione **`SELECT`**
   - **Target roles**: Selecione **`public`**
   - **USING expression**: Cole este código:
   ```sql
   bucket_id = 'whatsapp-workflow-media'
   ```
   - **WITH CHECK expression**: Deixe vazio (não se aplica a SELECT)

3. **Salvar** a política

---

## 📋 Passo 4: Criar Nova Política 2 - Upload Autenticado

1. **Criar Nova Política:**
   - Clique em **"New Policy"** novamente

2. **Configurações:**
   - **Policy name**: `Authenticated users can upload workflow media`
   - **Allowed operation**: Selecione **`INSERT`**
   - **Target roles**: Selecione **`authenticated`**
   - **USING expression**: Deixe vazio (não se aplica a INSERT)
   - **WITH CHECK expression**: Cole este código:
   ```sql
   bucket_id = 'whatsapp-workflow-media'
   ```

3. **Salvar** a política

---

## 📋 Passo 5: Criar Nova Política 3 - Update Autenticado

1. **Criar Nova Política:**
   - Clique em **"New Policy"** novamente

2. **Configurações:**
   - **Policy name**: `Authenticated users can update their workflow media`
   - **Allowed operation**: Selecione **`UPDATE`**
   - **Target roles**: Selecione **`authenticated`**
   - **USING expression**: Cole este código:
   ```sql
   bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
   ```
   - **WITH CHECK expression**: Cole este código:
   ```sql
   bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
   ```

3. **Salvar** a política

---

## 📋 Passo 6: Criar Nova Política 4 - Delete Autenticado

1. **Criar Nova Política:**
   - Clique em **"New Policy"** novamente

2. **Configurações:**
   - **Policy name**: `Authenticated users can delete their workflow media`
   - **Allowed operation**: Selecione **`DELETE`**
   - **Target roles**: Selecione **`authenticated`**
   - **USING expression**: Cole este código:
   ```sql
   bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
   ```
   - **WITH CHECK expression**: Deixe vazio (não se aplica a DELETE)

3. **Salvar** a política

---

## ✅ Verificação Final

Após criar todas as políticas, você deve ter **4 políticas** no total:

1. ✅ `Public read access to workflow media` (SELECT, public)
2. ✅ `Authenticated users can upload workflow media` (INSERT, authenticated)
3. ✅ `Authenticated users can update their workflow media` (UPDATE, authenticated)
4. ✅ `Authenticated users can delete their workflow media` (DELETE, authenticated)

---

## 🧪 Testar

1. **Recarregue o app**: `agilizeflow.com.br` ou `http://95.217.2.116:3000`
2. **Faça login**
3. **Tente fazer upload de um arquivo**
4. **Verifique se funcionou**

---

## ⚠️ Se Ainda Der Erro

Se ainda aparecer erro de RLS após configurar as políticas:

1. **Verifique se RLS está habilitado:**
   - Storage > Settings > Row Level Security deve estar **habilitado**

2. **Verifique se as políticas estão ativas:**
   - Todas as políticas devem estar com status **"Active"**

3. **Me envie:**
   - Screenshot das políticas criadas
   - Erro completo do console do navegador

---

**Arquivo criado em**: `/root/kanban-buzz-95241/INSTRUCOES-STORAGE-RLS-DASHBOARD.md`


