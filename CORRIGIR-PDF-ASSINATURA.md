# 🔧 Corrigir PDF na Página de Assinatura

## ⚠️ Problema
O PDF não aparece quando o cliente clica no link de assinatura.

## ✅ Soluções Aplicadas

### 1. Erro do `.catch()` Corrigido
- **Erro:** `TypeError: supabase.from(...).insert(...).catch is not a function`
- **Correção:** Substituído `.catch()` por `try/catch`
- **Status:** ✅ Deployado

### 2. Melhorias na Página de Assinatura
- Adicionado botão "Abrir PDF em Nova Aba"
- Adicionado botão "Baixar PDF"
- Adicionado tratamento de erro no iframe
- Adicionado alerta se PDF não existir

## 🔍 Verificar Permissões do Storage

O PDF precisa estar acessível publicamente. Execute este SQL no Supabase:

```sql
-- Verificar se o bucket está público
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'whatsapp-workflow-media';

-- Se não estiver público, tornar público:
UPDATE storage.buckets
SET public = true
WHERE id = 'whatsapp-workflow-media';

-- Verificar políticas RLS para leitura pública
SELECT * FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%contract%' OR policyname LIKE '%public%';
```

## 📋 Checklist

- [ ] Bucket `whatsapp-workflow-media` está público
- [ ] Política RLS permite leitura pública de PDFs em `/contracts/`
- [ ] PDF foi gerado e tem `pdf_url` no banco
- [ ] URL do PDF é acessível (testar em nova aba)

## 🧪 Como Testar

1. **Acesse o link de assinatura:**
   - Exemplo: `https://agilizeflow.com.br/sign-contract/{contractId}/{token}`

2. **Verifique se o PDF aparece:**
   - Se não aparecer no iframe, clique em "Abrir PDF em Nova Aba"
   - Se abrir em nova aba, o problema é CORS no iframe (normal)

3. **Se não abrir nem em nova aba:**
   - Verifique se o bucket está público
   - Verifique as políticas RLS
   - Verifique se o PDF existe no storage

## 🔧 Se Ainda Não Funcionar

Execute este SQL para garantir permissões:

```sql
-- Garantir bucket público
UPDATE storage.buckets
SET public = true
WHERE id = 'whatsapp-workflow-media';

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Allow public read access to contract PDFs" ON storage.objects;

-- Criar política de leitura pública
CREATE POLICY "Allow public read access to contract PDFs"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'whatsapp-workflow-media'
  AND (
    name LIKE '%/contracts/%'
    OR name LIKE '%contracts/%'
    OR name LIKE 'contracts/%'
  )
);
```

---

**Última atualização:** Correções aplicadas e deployadas

