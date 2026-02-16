-- Proxy da instância Evolution API (documentação: proxyHost, proxyPort, proxyProtocol, proxyUsername, proxyPassword)
ALTER TABLE public.evolution_config
  ADD COLUMN IF NOT EXISTS proxy_host TEXT,
  ADD COLUMN IF NOT EXISTS proxy_port TEXT,
  ADD COLUMN IF NOT EXISTS proxy_protocol TEXT,
  ADD COLUMN IF NOT EXISTS proxy_username TEXT,
  ADD COLUMN IF NOT EXISTS proxy_password TEXT;
COMMENT ON COLUMN public.evolution_config.proxy_host IS 'Host do proxy para a instância (Evolution API)';
COMMENT ON COLUMN public.evolution_config.proxy_port IS 'Porta do proxy';
COMMENT ON COLUMN public.evolution_config.proxy_protocol IS 'Protocolo do proxy: HTTP, HTTPS ou SOCKS5';
COMMENT ON COLUMN public.evolution_config.proxy_username IS 'Usuário do proxy (opcional)';
COMMENT ON COLUMN public.evolution_config.proxy_password IS 'Senha do proxy (opcional)';
