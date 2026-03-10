-- Permitir excluir instância Evolution mesmo com campanhas de broadcast referenciando-a.
-- Ao excluir evolution_config, registros que usavam essa instância terão instance_id = NULL.

-- 1. broadcast_campaigns (erro: broadcast_campaigns_instance_id_fkey)
ALTER TABLE public.broadcast_campaigns
  DROP CONSTRAINT IF EXISTS broadcast_campaigns_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns
  ADD CONSTRAINT broadcast_campaigns_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES public.evolution_config(id)
  ON DELETE SET NULL;

-- 2. broadcast_campaigns_2 (evitar mesmo erro no disparador 2)
ALTER TABLE public.broadcast_campaigns_2
  DROP CONSTRAINT IF EXISTS broadcast_campaigns_2_instance_id_fkey;

ALTER TABLE public.broadcast_campaigns_2
  ADD CONSTRAINT broadcast_campaigns_2_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES public.evolution_config(id)
  ON DELETE SET NULL;

-- 3. broadcast_queue_2.instance_id
ALTER TABLE public.broadcast_queue_2
  DROP CONSTRAINT IF EXISTS broadcast_queue_2_instance_id_fkey;

ALTER TABLE public.broadcast_queue_2
  ADD CONSTRAINT broadcast_queue_2_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES public.evolution_config(id)
  ON DELETE SET NULL;
