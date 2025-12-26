# 🚀 Aplicar Migration: Media Calendar Templates

## Problema
A coluna `media_type` não existe na tabela `calendar_message_templates`, causando erro ao criar templates.

## Solução
Aplicar a migration que adiciona as colunas `media_url` e `media_type`.

## Método 1: Via Supabase SQL Editor (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql
2. Cole o seguinte SQL:

```sql
-- ============================================
-- Adicionar suporte a anexos (imagens) nos templates de calendário
-- ============================================

-- Adicionar colunas media_url e media_type se não existirem
DO $$
BEGIN
  -- Adicionar media_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_message_templates'
      AND column_name = 'media_url'
  ) THEN
    ALTER TABLE public.calendar_message_templates
    ADD COLUMN media_url text;
    
    COMMENT ON COLUMN public.calendar_message_templates.media_url IS 
      'URL da imagem/anexo para o template';
  END IF;

  -- Adicionar media_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'calendar_message_templates'
      AND column_name = 'media_type'
  ) THEN
    ALTER TABLE public.calendar_message_templates
    ADD COLUMN media_type text;
    
    COMMENT ON COLUMN public.calendar_message_templates.media_type IS 
      'Tipo de mídia: image, document, etc.';
  END IF;
END $$;
```

3. Clique em "Run" para executar

## Método 2: Via Script Automático

Execute:
```bash
./scripts/aplicar-migration-media-calendar-templates.sh
```

## Verificação

Após aplicar, verifique se as colunas foram criadas:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'calendar_message_templates'
  AND column_name IN ('media_url', 'media_type');
```

Deve retornar 2 linhas com as colunas `media_url` e `media_type`.

## Arquivo da Migration

A migration está em: `supabase/migrations/20250201000000_add_media_to_calendar_templates.sql`

