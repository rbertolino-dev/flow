# 🚀 Aplicar Migrações do Sistema de Contratos

## ✅ Migrações a Aplicar

Duas novas migrações foram criadas para melhorar o sistema de contratos:

1. **20251216114438_add_auth_data_to_signatures.sql** - Adiciona campos de autenticação
2. **20251216114614_add_message_template_to_contracts.sql** - Adiciona campo de mensagem personalizada

## 📋 Como Aplicar

### Opção 1: Via SQL Editor (Recomendado)

1. **Acesse o SQL Editor do Supabase:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
   - Ou: Dashboard → SQL Editor → New Query

2. **Copie e cole o conteúdo do arquivo:**
   ```bash
   cat supabase/migrations/apply_new_migrations.sql
   ```

3. **Execute no SQL Editor** (Ctrl+Enter ou botão Run)

### Opção 2: Via Arquivo SQL Combinado

O arquivo `supabase/migrations/apply_new_migrations.sql` contém ambas as migrações combinadas e pode ser executado diretamente.

## 📝 O que as Migrações Fazem

### Migração 1: Dados de Autenticação
- Adiciona `user_agent` - Navegador/dispositivo usado
- Adiciona `device_info` - Informações do dispositivo (JSONB)
- Adiciona `geolocation` - Localização aproximada (opcional)
- Adiciona `validation_hash` - Hash SHA-256 para validação
- Adiciona `signed_ip_country` - País do IP
- Cria índice para `validation_hash`

### Migração 2: Mensagem Personalizada
- Adiciona `whatsapp_message_template` - Template personalizado da mensagem

## ⚠️ Importante

- As migrações usam `IF NOT EXISTS`, então são seguras para executar múltiplas vezes
- Não afetam dados existentes
- Podem ser aplicadas mesmo se algumas colunas já existirem

## ✅ Verificação

Após aplicar, verifique se as colunas foram criadas:

```sql
-- Verificar colunas em contract_signatures
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contract_signatures' 
AND column_name IN ('user_agent', 'device_info', 'geolocation', 'validation_hash', 'signed_ip_country');

-- Verificar coluna em contracts
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'contracts' 
AND column_name = 'whatsapp_message_template';
```

