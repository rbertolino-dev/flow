-- WordPress: cabeçalho opcional para Bearer JWT (miniOrange Advanced Settings > Custom Header).

ALTER TABLE public.wordpress_configs
ADD COLUMN IF NOT EXISTS jwt_header_name text;

COMMENT ON COLUMN public.wordpress_configs.jwt_header_name IS
  'Opcional: nome do cabeçalho HTTP para Bearer JWT (ex. miniOrange). Vazio = Authorization.';
