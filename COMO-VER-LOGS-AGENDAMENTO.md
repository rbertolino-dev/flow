# 🔍 Como Ver Logs do Agendamento de Mensagens

## 📋 Problema
Após aplicar a migration RLS, o agendamento ainda não está funcionando e não aparecem logs.

## 🔧 Como Verificar os Logs

### Opção 1: Supabase Dashboard (Recomendado)

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login

2. **Vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

3. **Abra a função `process-scheduled-messages`:**
   - Clique na função na lista

4. **Vá na aba "Logs":**
   - Você verá os logs em tempo real
   - Procure por mensagens com:
     - 🕐 Iniciando processamento
     - 📬 Encontradas X mensagens
     - 🏢 Organização da mensagem
     - 📤 Processando mensagem
     - ❌ Erros

### Opção 2: Verificar se a Função Está Sendo Chamada

A função `process-scheduled-messages` é chamada automaticamente por um cron job. Verifique:

1. **No Supabase Dashboard:**
   - Vá em **Database** → **Cron Jobs**
   - Procure por `process-scheduled-messages`
   - Verifique se está ativo e quando foi executado pela última vez

2. **Ou execute manualmente:**
   - Vá em **Edge Functions** → `process-scheduled-messages`
   - Clique em **Invoke**
   - Veja os logs em tempo real

## 🔍 O que Procurar nos Logs

### 1. Início do Processamento
```
🕐 [process-scheduled-messages] Iniciando processamento...
📬 [process-scheduled-messages] Encontradas X mensagens para processar
```

### 2. Organização da Mensagem
```
🏢 [process-scheduled-messages] Organização da mensagem: [UUID]
🔗 [process-scheduled-messages] Instance ID: [UUID]
```

### 3. Erro de RLS (se houver)
```
❌ Erro ao buscar mensagens: [detalhes do erro RLS]
```

### 4. Erro de Instância
```
⚠️ [process-scheduled-messages] Instância não encontrada
❌ Erro ao buscar instância: [detalhes]
```

### 5. Erro do Evolution API
```
❌ [process-scheduled-messages] Erro ao enviar mensagem: [detalhes]
⚠️ [process-scheduled-messages] Evolution API retornou exists: false
```

## 🐛 Possíveis Problemas

### 1. Cron Job Não Está Configurado
**Sintoma:** Nenhum log aparece
**Solução:** Verificar se o cron job está ativo

### 2. RLS Ainda Bloqueando
**Sintoma:** Log mostra "Erro ao buscar mensagens" com erro de RLS
**Solução:** Verificar se a migration foi aplicada corretamente

### 3. Mensagens Não Estão no Status "pending"
**Sintoma:** Log mostra "Encontradas 0 mensagens"
**Solução:** Verificar status das mensagens na tabela `scheduled_messages`

### 4. Instância Não Encontrada
**Sintoma:** Log mostra "Instância não encontrada"
**Solução:** Verificar se a instância existe e está na mesma organização

## 📊 Verificar Mensagens Agendadas

Execute no SQL Editor:

```sql
-- Ver mensagens agendadas pendentes
SELECT 
  id,
  organization_id,
  instance_id,
  phone,
  message,
  scheduled_for,
  status,
  error_message,
  created_at
FROM scheduled_messages
WHERE status = 'pending'
  AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC
LIMIT 10;
```

## 🔄 Testar Manualmente

1. **Criar uma mensagem de teste:**
   - Agende uma mensagem para 1 minuto no futuro
   - Aguarde 2 minutos
   - Verifique os logs

2. **Chamar a função manualmente:**
   - Dashboard → Edge Functions → `process-scheduled-messages`
   - Clique em **Invoke**
   - Veja os logs
