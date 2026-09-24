ALTER TABLE public.chatwoot_configs
  ADD COLUMN IF NOT EXISTS chatwoot_account_name text;

COMMENT ON COLUMN public.chatwoot_configs.chatwoot_account_name IS
  'Nome da conta no Chatwoot, mostrado para confirmar o número da conta.';
