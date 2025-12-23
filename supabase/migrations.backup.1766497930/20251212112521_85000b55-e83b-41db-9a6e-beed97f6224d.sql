-- Habilitar Realtime para a tabela organizations
ALTER TABLE public.organizations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;