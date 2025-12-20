-- Reverter migration anterior
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_source_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns
DROP CONSTRAINT IF EXISTS broadcast_campaigns_instance_id_fkey;

ALTER TABLE public.scheduled_messages
DROP CONSTRAINT IF EXISTS scheduled_messages_instance_id_fkey CASCADE;

-- Adicionar campos para preservar histórico do nome da instância
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS source_instance_name TEXT;

ALTER TABLE public.broadcast_campaigns
ADD COLUMN IF NOT EXISTS instance_name TEXT;

-- Criar função para preservar nome da instância antes de deletar
CREATE OR REPLACE FUNCTION preserve_instance_name_before_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar leads que usam esta instância
  UPDATE public.leads
  SET source_instance_name = OLD.instance_name
  WHERE source_instance_id = OLD.id AND source_instance_name IS NULL;
  
  -- Atualizar campanhas que usam esta instância
  UPDATE public.broadcast_campaigns
  SET instance_name = OLD.instance_name
  WHERE instance_id = OLD.id AND instance_name IS NULL;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para executar antes de deletar evolution_config
DROP TRIGGER IF EXISTS preserve_instance_name_trigger ON public.evolution_config;
CREATE TRIGGER preserve_instance_name_trigger
BEFORE DELETE ON public.evolution_config
FOR EACH ROW
EXECUTE FUNCTION preserve_instance_name_before_delete();

-- Recriar constraints com SET NULL (agora com histórico preservado)
ALTER TABLE public.leads
ADD CONSTRAINT leads_source_instance_id_fkey 
FOREIGN KEY (source_instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

ALTER TABLE public.broadcast_campaigns
ADD CONSTRAINT broadcast_campaigns_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE SET NULL;

-- Scheduled messages: CASCADE pois dependem da instância existir para enviar
ALTER TABLE public.scheduled_messages
ADD CONSTRAINT scheduled_messages_instance_id_fkey 
FOREIGN KEY (instance_id) 
REFERENCES public.evolution_config(id) 
ON DELETE CASCADE;