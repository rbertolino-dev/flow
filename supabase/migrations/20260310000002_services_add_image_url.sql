-- Adiciona coluna image_url na tabela services (PostgreSQL budget_services)
-- Para permitir imagem em serviços (criação/edição em orçamentos)

ALTER TABLE services
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN services.image_url IS 'URL da imagem do serviço (opcional)';
