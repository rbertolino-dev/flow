-- Permitir auth_method = jwt (plugin JWT Authentication for WP REST API).

ALTER TABLE public.wordpress_configs
DROP CONSTRAINT IF EXISTS wordpress_configs_auth_method_check;

ALTER TABLE public.wordpress_configs
ADD CONSTRAINT wordpress_configs_auth_method_check
CHECK (auth_method IN ('application_password', 'account_password', 'jwt'));

COMMENT ON COLUMN public.wordpress_configs.auth_method IS
  'application_password | account_password (Basic Auth) | jwt (Bearer via plugin jwt-auth/v1/token).';

COMMENT ON COLUMN public.wordpress_configs.application_password IS
  'Basic Auth: senha de app ou conta. Modo JWT: palavra-passe usada só no endpoint /jwt-auth/v1/token (recom. senha de aplicação).';
