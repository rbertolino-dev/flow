-- Tornar instance_id nullable em broadcast_campaigns para permitir exclusão com histórico
ALTER TABLE public.broadcast_campaigns
ALTER COLUMN instance_id DROP NOT NULL;

-- Verificar se há campanhas sem instance_id e preencher com o nome preservado
UPDATE public.broadcast_campaigns
SET instance_name = (
  SELECT instance_name 
  FROM public.evolution_config 
  WHERE id = broadcast_campaigns.instance_id
)
WHERE instance_name IS NULL AND instance_id IS NOT NULL;