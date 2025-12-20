# 📋 Instruções: Atualizar Bucket para Aceitar PDFs

## ⚠️ Problema

A migração SQL pode falhar com erro de permissão se você não for super admin do Supabase.

## ✅ Solução: Atualizar Manualmente no Dashboard

### Passo a Passo:

1. **Acesse o Supabase Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Navegue até Storage**
   - No menu lateral, clique em **Storage**
   - Clique em **Settings** (ou vá direto para o bucket)

3. **Selecione o Bucket**
   - Encontre o bucket: `whatsapp-workflow-media`
   - Clique nele para abrir as configurações

4. **Adicione PDF aos Tipos MIME Permitidos**
   - Procure por **"Allowed MIME types"** ou **"Tipos MIME permitidos"**
   - Clique em **"Add MIME type"** ou **"Adicionar"**
   - Digite: `application/pdf`
   - Clique em **Save** ou **Salvar**

5. **Verificar**
   - Confirme que `application/pdf` aparece na lista de tipos permitidos

## 🔄 Alternativa: Via SQL (Super Admin)

Se você tem acesso de super admin, execute no SQL Editor:

```sql
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['application/pdf']
)
WHERE id = 'whatsapp-workflow-media'
AND NOT ('application/pdf' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
```

## ✅ Verificação

Após atualizar, teste criando um contrato:
1. Crie um novo contrato
2. O PDF deve ser gerado automaticamente
3. O upload deve funcionar sem erros

## 📝 Nota

As políticas RLS já foram criadas pela migração para permitir uploads de PDFs na pasta `contracts/`, mas o bucket ainda precisa ter `application/pdf` na lista de tipos MIME permitidos para funcionar completamente.


