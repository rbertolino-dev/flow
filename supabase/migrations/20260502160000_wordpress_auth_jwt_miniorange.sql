-- miniOrange REST API Authentication: JWT via /wp-json/api/v1/token

ALTER TABLE public.wordpress_configs
DROP CONSTRAINT IF EXISTS wordpress_configs_auth_method_check;

ALTER TABLE public.wordpress_configs
ADD CONSTRAINT wordpress_configs_auth_method_check
CHECK (
  auth_method IN (
    'application_password',
    'account_password',
    'jwt',
    'jwt_miniorange'
  )
);

COMMENT ON COLUMN public.wordpress_configs.auth_method IS
  'application_password | account_password | jwt (jwt-auth/v1/token) | jwt_miniorange (api/v1/token).';
