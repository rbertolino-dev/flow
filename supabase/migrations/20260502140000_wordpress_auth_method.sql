-- WordPress: escolher entre senha de aplicação (recomendado) ou palavra-passe da conta (Basic Auth).

ALTER TABLE public.wordpress_configs
ADD COLUMN IF NOT EXISTS auth_method text;

UPDATE public.wordpress_configs
SET auth_method = 'application_password'
WHERE auth_method IS NULL;

ALTER TABLE public.wordpress_configs
ALTER COLUMN auth_method SET DEFAULT 'application_password';

ALTER TABLE public.wordpress_configs
ALTER COLUMN auth_method SET NOT NULL;

ALTER TABLE public.wordpress_configs
DROP CONSTRAINT IF EXISTS wordpress_configs_auth_method_check;

ALTER TABLE public.wordpress_configs
ADD CONSTRAINT wordpress_configs_auth_method_check
CHECK (auth_method IN ('application_password', 'account_password'));

COMMENT ON COLUMN public.wordpress_configs.application_password IS
  'Segredo em Basic Auth: senha de aplicação ou palavra-passe da conta, conforme auth_method.';

COMMENT ON COLUMN public.wordpress_configs.auth_method IS
  'application_password = recomendado; account_password = palavra-passe de login wp-admin (avançado).';

COMMENT ON TABLE public.wordpress_configs IS
  'Credenciais WordPress (REST API Basic Auth) por organização.';
