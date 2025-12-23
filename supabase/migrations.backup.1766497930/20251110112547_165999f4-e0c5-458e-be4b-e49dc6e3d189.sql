-- Remover trigger que cria pipeline stages automaticamente na criação de perfil
-- A edge function create-user já cuida disso após adicionar à organização
DROP TRIGGER IF EXISTS create_default_pipeline_stages_trigger ON profiles;