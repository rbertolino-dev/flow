# 🧪 Modo de Teste para WhatsApp

Este documento explica como usar o modo de teste para testar funções do banco de dados normalmente, mas controlar o envio de mensagens WhatsApp.

## 📋 Como Funciona

O modo de teste permite:
- ✅ **Executar todas as funções do banco normalmente** (inserções, atualizações, etc.)
- ✅ **Registrar atividades e logs normalmente**
- 🧪 **Controlar o envio de WhatsApp** (redirecionar ou apenas logar)

## 🚀 Configuração

### Opção 1: Redirecionar para Número de Teste

Configure uma variável de ambiente para redirecionar todas as mensagens para um número de teste:

```bash
# No Supabase Dashboard > Edge Functions > Settings > Secrets
WHATSAPP_TEST_PHONE=5511999999999  # Número de teste (com código do país)
```

**O que acontece:**
- Todas as mensagens serão enviadas para o número de teste
- As funções do banco são executadas normalmente
- Atividades são registradas normalmente
- Útil para testar o fluxo completo com um WhatsApp real de teste

### Opção 2: Modo LOG ONLY (Não Envia Nada)

Configure para apenas logar sem enviar:

```bash
# No Supabase Dashboard > Edge Functions > Settings > Secrets
TEST_MODE=true
WHATSAPP_LOG_ONLY=true
```

**O que acontece:**
- Mensagens são processadas e logadas
- **Nenhuma mensagem é enviada realmente**
- Funções do banco são executadas normalmente
- Atividades são registradas com prefixo `[TEST MODE]`
- Útil para testar sem enviar mensagens reais

### Opção 3: Combinar Ambos

```bash
TEST_MODE=true
WHATSAPP_TEST_PHONE=5511999999999
WHATSAPP_LOG_ONLY=false  # ou omitir
```

**O que acontece:**
- Mensagens são redirecionadas para o número de teste
- Funções do banco executam normalmente

## 📝 Como Configurar no Supabase

### Via Dashboard (Recomendado)

1. Acesse o **Supabase Dashboard**
2. Vá em **Edge Functions** > **Settings** (ou **Secrets**)
3. Adicione as variáveis de ambiente:
   - `TEST_MODE` = `true` (opcional)
   - `WHATSAPP_TEST_PHONE` = `5511999999999` (opcional)
   - `WHATSAPP_LOG_ONLY` = `true` (opcional)

### Via CLI

```bash
# Configurar modo de teste com redirecionamento
supabase secrets set WHATSAPP_TEST_PHONE=5511999999999

# Ou configurar modo LOG ONLY
supabase secrets set TEST_MODE=true
supabase secrets set WHATSAPP_LOG_ONLY=true
```

## 🎯 Casos de Uso

### 1. Testar Workflows Periódicos

```bash
# Configurar
WHATSAPP_TEST_PHONE=5511999999999

# Executar workflow
# As mensagens serão enviadas para o número de teste
# Mas todas as funções do banco funcionam normalmente
```

### 2. Testar sem Enviar Nada

```bash
# Configurar
TEST_MODE=true
WHATSAPP_LOG_ONLY=true

# Executar qualquer função
# Nada será enviado, mas tudo será logado e registrado no banco
```

### 3. Testar com Número Real de Teste

```bash
# Configurar
WHATSAPP_TEST_PHONE=5511999999999

# Todas as mensagens vão para este número
# Útil para validar templates, formatação, etc.
```

## 📊 O que é Executado Normalmente

Mesmo em modo de teste, estas ações **sempre são executadas**:

- ✅ Inserções no banco (`scheduled_messages`, `activities`, etc.)
- ✅ Atualizações no banco (`leads.last_contact`, etc.)
- ✅ Processamento de workflows
- ✅ Cálculos e lógica de negócio
- ✅ Registro de atividades

## 🧪 O que é Controlado

Apenas o **envio real de WhatsApp** é afetado:

- 🧪 Se `WHATSAPP_LOG_ONLY=true`: Nada é enviado
- 🧪 Se `WHATSAPP_TEST_PHONE` definido: Envia para número de teste
- 🧪 Se nenhum configurado: Funciona normalmente (produção)

## 🔍 Verificar Logs

Os logs mostram claramente quando está em modo de teste:

```
🧪 [TEST MODE] Redirecionando mensagem de 5511988888888 para 5511999999999
🧪 [TEST MODE - LOG ONLY] Mensagem seria enviada para: 5511988888888
```

## ⚠️ Importante

- **Em produção**, não configure essas variáveis
- **Em ambiente de teste**, configure conforme necessário
- As funções do banco **sempre executam**, apenas o envio é controlado
- Atividades são registradas com prefixo `[TEST MODE]` quando em LOG ONLY

## 🎬 Exemplo Completo

### Cenário: Testar Workflow de Cobrança

1. **Configurar modo de teste:**
   ```bash
   WHATSAPP_TEST_PHONE=5511999999999
   ```

2. **Criar workflow normalmente** (via interface)

3. **Workflow executa:**
   - ✅ Busca leads no banco
   - ✅ Processa anexos
   - ✅ Cria mensagens agendadas
   - ✅ Calcula próximas execuções
   - 🧪 Envia mensagens para `5511999999999` (não para os leads reais)

4. **Verificar resultados:**
   - Mensagens aparecem no WhatsApp de teste
   - Atividades registradas no banco
   - Workflow continua funcionando normalmente

## 🔄 Desativar Modo de Teste

Para voltar ao modo normal (produção):

1. Remova as variáveis de ambiente no Supabase Dashboard
2. Ou defina:
   ```bash
   TEST_MODE=false
   # Remova WHATSAPP_TEST_PHONE e WHATSAPP_LOG_ONLY
   ```

## 📞 Suporte

Se tiver dúvidas sobre o modo de teste, verifique:
- Logs das Edge Functions no Supabase Dashboard
- Variáveis de ambiente configuradas
- Status das mensagens na tabela `scheduled_messages`

