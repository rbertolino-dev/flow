# 🔧 Correção do Realtime - WebSocket Connection Failed

## ❌ Erro Atual

```
WebSocket connection to 'wss://ogeljmbhqxpfjbpnbwog.supabase.co/realtime/v1/websocket?apikey=...' failed
Tempo esgotado na conexão Realtime
```

## ✅ Correções Aplicadas

### 1. Configuração do Cliente Supabase

**Arquivo:** `src/integrations/supabase/client.ts`

Adicionadas configurações de Realtime com:
- Heartbeat interval: 30 segundos
- Reconnect com exponential backoff (1s, 2s, 4s, 8s, 16s, max 30s)
- Events per second: 10

### 2. Migration para Habilitar Realtime em Todas as Tabelas

**Arquivo:** `supabase/migrations/20251218010000_enable_realtime_all_tables.sql`

Migration aplicada para garantir que todas as tabelas usadas pelo Realtime estejam habilitadas:
- `whatsapp_messages`
- `evolution_config`
- `organization_limits`
- `organization_members`
- `leads` (já estava habilitada)
- `activities` (já estava habilitada)
- `call_queue` (já estava habilitada)
- `organizations` (já estava habilitada)

## 🔍 Verificações Necessárias no Supabase Dashboard

O erro pode persistir se o Realtime não estiver habilitado no projeto Supabase. Siga estes passos:

### 1. Verificar se Realtime está Habilitado

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto: `ogeljmbhqxpfjbpnbwog`
3. Vá em **Database** → **Replication**
4. Verifique se o Realtime está **habilitado**

### 2. Habilitar Realtime (se necessário)

Se o Realtime não estiver habilitado:

1. No Supabase Dashboard, vá em **Settings** → **API**
2. Verifique se a URL do Realtime está configurada:
   - Deve ser: `wss://ogeljmbhqxpfjbpnbwog.supabase.co/realtime/v1/websocket`
3. Se não estiver habilitado, ative o Realtime nas configurações do projeto

### 3. Verificar Publicação do Realtime

Execute no SQL Editor do Supabase:

```sql
-- Verificar se a publicação existe
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Verificar tabelas na publicação
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### 4. Verificar Configuração de Rede

Se o problema persistir, pode ser um problema de rede/firewall:

1. Verifique se o navegador permite conexões WebSocket
2. Verifique se há bloqueadores de anúncios bloqueando WebSockets
3. Teste em modo anônimo do navegador

## 🧪 Teste de Conexão

Após aplicar as correções, teste a conexão:

1. Abra o console do navegador (F12)
2. Procure por mensagens de status do Realtime:
   - `📡 Socket status: SUBSCRIBED` → ✅ Funcionando
   - `📡 Socket status: TIMED_OUT` → ❌ Problema de conexão
   - `📡 Socket status: CLOSED` → ❌ Conexão fechada

## 📋 Checklist de Verificação

- [x] Configuração do cliente Supabase atualizada
- [x] Migration aplicada para habilitar Realtime em todas as tabelas
- [ ] Realtime habilitado no Supabase Dashboard
- [ ] Publicação `supabase_realtime` existe e contém as tabelas
- [ ] Teste de conexão WebSocket bem-sucedido
- [ ] Status do Realtime mostra "SUBSCRIBED" no console

## 🔄 Próximos Passos

Se o problema persistir após verificar o Supabase Dashboard:

1. Verifique os logs do Supabase para erros de Realtime
2. Teste a conexão WebSocket diretamente:
   ```javascript
   const ws = new WebSocket('wss://ogeljmbhqxpfjbpnbwog.supabase.co/realtime/v1/websocket?apikey=SUA_CHAVE');
   ws.onopen = () => console.log('✅ WebSocket conectado');
   ws.onerror = (e) => console.error('❌ Erro WebSocket:', e);
   ```
3. Entre em contato com o suporte do Supabase se o problema persistir

## 📝 Notas

- O Realtime é necessário para atualizações em tempo real de:
  - Mensagens WhatsApp
  - Status de instâncias Evolution
  - Leads e atividades
  - Fila de chamadas
  - Configurações de organização

- Sem o Realtime funcionando, o sistema usa polling como fallback, mas isso aumenta o uso de recursos e pode causar atrasos nas atualizações.





