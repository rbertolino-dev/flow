# 📸 Como Subir a Logo do AgilizeFLOW no Supabase Storage

## Opção 1: Via Dashboard do Supabase (Mais Fácil)

### Passo a Passo:

1. **Acesse o Dashboard do Supabase:**
   - Vá para: https://supabase.com/dashboard
   - Faça login na sua conta
   - Selecione o projeto do CRM

2. **Acesse Storage:**
   - No menu lateral, clique em **"Storage"**
   - Procure pelo bucket **`whatsapp-workflow-media`**
   - Se não existir, crie um novo bucket com esse nome

3. **Crie uma pasta para logos (opcional):**
   - Dentro do bucket, crie uma pasta chamada **`logos`** ou **`branding`**
   - Isso ajuda a organizar os arquivos

4. **Faça Upload da Logo:**
   - Clique em **"Upload file"** ou **"New file"**
   - Selecione o arquivo da logo do AgilizeFLOW (PNG, SVG ou JPG)
   - Nomeie como: `agilizeflow-logo.png` (ou `.svg`, `.jpg`)
   - Aguarde o upload concluir

5. **Torne o Arquivo Público:**
   - Clique no arquivo que você acabou de fazer upload
   - Clique em **"Make public"** ou configure as políticas RLS para permitir acesso público
   - Copie a URL pública do arquivo

6. **URL Pública:**
   - A URL será algo como: `https://[PROJECT_ID].supabase.co/storage/v1/object/public/whatsapp-workflow-media/logos/agilizeflow-logo.png`

---

## Opção 2: Via SQL Editor (Configurar Políticas RLS)

Se você quiser garantir que a logo seja sempre pública, execute este SQL no SQL Editor:

```sql
-- Criar política para permitir leitura pública de logos
CREATE POLICY "Public read access for logos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'whatsapp-workflow-media' 
  AND (storage.foldername(name))[1] = 'logos'
);
```

---

## Opção 3: Via Código (Upload Programático)

Use o componente que criamos ou faça upload via código:

```typescript
import { supabase } from "@/integrations/supabase/client";

const uploadLogo = async (file: File) => {
  const BUCKET_ID = "whatsapp-workflow-media";
  const fileExt = file.name.split('.').pop();
  const fileName = `agilizeflow-logo.${fileExt}`;
  const filePath = `logos/${fileName}`;

  // Upload
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_ID)
    .upload(filePath, file, {
      upsert: true, // Substitui se já existir
      cacheControl: '3600',
    });

  if (uploadError) {
    throw uploadError;
  }

  // Obter URL pública
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_ID)
    .getPublicUrl(filePath);

  return publicUrl;
};
```

---

## Após Fazer Upload:

1. **Copie a URL pública da logo**
2. **Atualize o código** para usar a URL do Supabase ao invés do arquivo local

### Exemplo de atualização:

**Antes:**
```typescript
import agilizeLogo from "@/assets/agilizeflow-logo.svg";
```

**Depois:**
```typescript
const agilizeLogo = "https://[PROJECT_ID].supabase.co/storage/v1/object/public/whatsapp-workflow-media/logos/agilizeflow-logo.png";
```

Ou crie uma constante:

```typescript
const LOGO_URL = import.meta.env.VITE_LOGO_URL || "https://[PROJECT_ID].supabase.co/storage/v1/object/public/whatsapp-workflow-media/logos/agilizeflow-logo.png";
```

---

## 📝 Notas Importantes:

- ✅ O bucket `whatsapp-workflow-media` já existe e está configurado
- ✅ Formatos suportados: PNG, SVG, JPG, WEBP
- ✅ Recomendado: PNG ou SVG para melhor qualidade
- ✅ Tamanho recomendado: até 500KB para carregamento rápido
- ✅ Lembre-se de tornar o arquivo público para que apareça no site

---

## 🔗 Links Úteis:

- Dashboard Supabase: https://supabase.com/dashboard
- Documentação Storage: https://supabase.com/docs/guides/storage


