-- ============================================
-- Criar função SQL para aplicar migration de broadcast campaigns
-- ============================================

-- Função que aplica a migration automaticamente
CREATE OR REPLACE FUNCTION public.apply_broadcast_migration()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_text TEXT := '';
BEGIN
  -- Permitir instance_id NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'instance_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ALTER COLUMN instance_id DROP NOT NULL;
    
    result_text := result_text || '✅ instance_id agora permite NULL. ';
  ELSE
    result_text := result_text || 'ℹ️  instance_id já permite NULL. ';
  END IF;

  -- Adicionar coluna sending_method se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'broadcast_campaigns'
      AND column_name = 'sending_method'
  ) THEN
    ALTER TABLE public.broadcast_campaigns
    ADD COLUMN sending_method TEXT DEFAULT 'single';
    
    COMMENT ON COLUMN public.broadcast_campaigns.sending_method IS 
      'Método de envio: single (uma instância), rotate (rotacionar entre instâncias), separate (disparar separadamente)';
    
    result_text := result_text || '✅ Coluna sending_method adicionada. ';
  ELSE
    result_text := result_text || 'ℹ️  Coluna sending_method já existe. ';
  END IF;

  -- Adicionar comentário em instance_id se ainda não tiver
  COMMENT ON COLUMN public.broadcast_campaigns.instance_id IS 
    'ID da instância (NULL quando campanha usa múltiplas instâncias - rotate ou separate)';

  RETURN result_text || 'Migration concluída!';
EXCEPTION
  WHEN OTHERS THEN
    RETURN '❌ Erro: ' || SQLERRM;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION public.apply_broadcast_migration() IS 
  'Aplica migration para permitir instance_id NULL e adicionar coluna sending_method na tabela broadcast_campaigns';

