# 🔍 Diagnóstico: Por Que Segunda Instância Não Cadastra Leads

## 🎯 Problema Real

A segunda instância não está cadastrando leads, mesmo com `webhook_secret` único.

## 🔍 Possíveis Causas

### 1. Evolution API Não Repassa Query Parameters

**Problema:** A Evolution API pode não repassar query parameters (`?secret=xxx`) quando chama o webhook.

**Sintoma:** Webhook recebido mas `providedSecret` é `undefined` ou vazio.

**Solução:** Usar header `x-webhook-secret` ou enviar no payload.

### 2. Webhook Não Está Configurado Corretamente

**Problema:** A segunda instância pode não ter configurado o webhook na Evolution API.

**Sintoma:** Webhook nunca é chamado para a segunda instância.

**Solução:** Verificar se webhook foi configurado na Evolution API.

### 3. Secret Não Está Sendo Enviado Corretamente

**Problema:** O `webhook_secret` pode não estar sendo enviado no formato correto.

**Sintoma:** Webhook recebido mas autenticação falha.

**Solução:** Verificar logs de autenticação.

## 🧪 Como Diagnosticar

### Passo 1: Verificar Logs do Webhook

Verifique os logs do Supabase Edge Function `evolution-webhook`:

```bash
# Ver logs recentes
supabase functions logs evolution-webhook --limit 50
```

Procure por:
- `🔍 Debug autenticação:` - Mostra como o secret está sendo recebido
- `❌ Segredo inválido para webhook:` - Indica que secret não foi encontrado
- `✅ Config encontrada via` - Indica sucesso na autenticação

### Passo 2: Verificar Configuração do Webhook

Verifique se o webhook está configurado na Evolution API:

```bash
# Verificar webhook configurado
curl -X GET "https://sua-evolution-api.com/webhook/find/INSTANCE_NAME" \
  -H "apikey: SUA_API_KEY"
```

### Passo 3: Testar Webhook Manualmente

Envie um webhook de teste:

```bash
curl -X POST "https://seu-supabase.com/functions/v1/evolution-webhook?secret=WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "INSTANCE_NAME",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste"
      },
      "pushName": "Teste"
    }
  }'
```

## 🔧 Soluções Possíveis

### Solução 1: Usar Header ao Invés de Query Parameter

A Evolution API pode não repassar query parameters. Vamos configurar para usar header:

```typescript
// Em useEvolutionConfigs.ts ou create-evolution-instance
// Ao invés de: ?secret=${webhookSecret}
// Usar header: x-webhook-secret: ${webhookSecret}
```

**Mas a Evolution API pode não permitir configurar headers customizados no webhook.**

### Solução 2: Enviar Secret no Payload

Algumas versões da Evolution API permitem enviar dados customizados no payload.

### Solução 3: Verificar se Webhook Foi Configurado

A segunda instância pode não ter configurado o webhook corretamente. Verificar:

1. Se o webhook foi configurado na Evolution API
2. Se o `webhook_secret` está correto no banco
3. Se a URL do webhook está correta

## 📋 Checklist de Diagnóstico

- [ ] Verificar logs do webhook para segunda instância
- [ ] Verificar se webhook está configurado na Evolution API
- [ ] Verificar se `webhook_secret` está correto no banco
- [ ] Testar webhook manualmente com curl
- [ ] Verificar se Evolution API repassa query parameters
- [ ] Verificar se `instance_name` no payload corresponde ao banco

## 🎯 Próximos Passos

1. **Coletar logs** do webhook quando segunda instância recebe mensagem
2. **Verificar** se webhook está sendo chamado
3. **Verificar** se autenticação está falhando
4. **Ajustar** código baseado nos logs coletados
