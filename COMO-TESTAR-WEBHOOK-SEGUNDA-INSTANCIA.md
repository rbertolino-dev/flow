# 🧪 Como Testar Webhook da Segunda Instância

## 📋 Pré-requisitos

1. Ter duas instâncias configuradas no Evolution
2. Ter acesso ao `webhook_secret` de cada instância
3. Ter `curl` instalado
4. Ter variável `SUPABASE_URL` configurada

## 🚀 Método 1: Script Automatizado

Execute o script de teste:

```bash
# Configurar URL do Supabase
export SUPABASE_URL=https://seu-projeto.supabase.co

# Executar teste
./test-webhook-segunda-instancia.sh
```

O script vai:
1. ✅ Testar primeira instância com secret
2. ✅ Testar segunda instância com secret
3. ✅ Testar segunda instância SEM secret (fallback)

## 🔧 Método 2: Teste Manual com cURL

### Teste 1: Primeira Instância

```bash
curl -X POST "https://seu-projeto.supabase.co/functions/v1/evolution-webhook?secret=WEBHOOK_SECRET_1" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: WEBHOOK_SECRET_1" \
  -d '{
    "event": "messages.upsert",
    "instance": "instancia1",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste primeira instância"
      },
      "pushName": "Teste 1"
    }
  }'
```

### Teste 2: Segunda Instância (com secret)

```bash
curl -X POST "https://seu-projeto.supabase.co/functions/v1/evolution-webhook?secret=WEBHOOK_SECRET_2" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: WEBHOOK_SECRET_2" \
  -d '{
    "event": "messages.upsert",
    "instance": "instancia2",
    "data": {
      "key": {
        "remoteJid": "5511888888888@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste segunda instância"
      },
      "pushName": "Teste 2"
    }
  }'
```

### Teste 3: Segunda Instância (SEM secret - testa fallback)

```bash
curl -X POST "https://seu-projeto.supabase.co/functions/v1/evolution-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "instancia2",
    "data": {
      "key": {
        "remoteJid": "5511888888888@s.whatsapp.net",
        "fromMe": false
      },
      "message": {
        "conversation": "Teste segunda instância sem secret"
      },
      "pushName": "Teste 2"
    }
  }'
```

## 📊 Verificar Resultados

### 1. Verificar Logs do Webhook

```bash
supabase functions logs evolution-webhook --limit 50
```

Procure por:
- `✅ Config encontrada por instance_name + webhook_secret: instancia2`
- `✅ Config encontrada APENAS por instance_name (sem secret): instancia2`
- `❌ Não foi possível encontrar configuração`

### 2. Verificar Leads Criados

Acesse o banco de dados e verifique:

```sql
SELECT 
  id, 
  name, 
  phone, 
  source_instance_name,
  created_at
FROM leads
WHERE phone IN ('5511999999999', '5511888888888')
ORDER BY created_at DESC;
```

### 3. Verificar Logs no Banco

```sql
SELECT 
  instance,
  event,
  level,
  message,
  payload,
  created_at
FROM evolution_logs
WHERE instance IN ('instancia1', 'instancia2')
ORDER BY created_at DESC
LIMIT 20;
```

## ✅ Resultados Esperados

### ✅ Sucesso

- **Primeira instância**: HTTP 200, lead criado
- **Segunda instância (com secret)**: HTTP 200, lead criado
- **Segunda instância (sem secret)**: HTTP 200, lead criado (fallback funcionou)

### ❌ Problemas

- **HTTP 403**: Secret inválido ou instância não encontrada
- **HTTP 400**: Instance mismatch ou payload inválido
- **HTTP 500**: Erro interno (verificar logs)

## 🔍 Diagnóstico de Problemas

### Problema: HTTP 403 - Invalid webhook secret

**Causa:** Secret não está sendo enviado ou está incorreto.

**Solução:**
1. Verificar se `webhook_secret` está correto no banco
2. Verificar se Evolution API está enviando o secret
3. Verificar logs: `🔍 Debug autenticação:`

### Problema: HTTP 400 - Instance mismatch

**Causa:** `instance_name` no payload não corresponde ao banco.

**Solução:**
1. Verificar `instance_name` no banco: `SELECT instance_name FROM evolution_config`
2. Verificar `instance_name` no payload do webhook
3. Garantir que são idênticos (case-sensitive)

### Problema: Lead não é criado mesmo com HTTP 200

**Causa:** Pode ser problema na lógica de criação de leads.

**Solução:**
1. Verificar logs: `🆕 Criando novo lead...`
2. Verificar se há estágio do funil configurado
3. Verificar se número é brasileiro válido

## 📝 Checklist de Teste

- [ ] Primeira instância cria lead com secret
- [ ] Segunda instância cria lead com secret
- [ ] Segunda instância cria lead sem secret (fallback)
- [ ] Logs mostram autenticação correta
- [ ] Leads aparecem no banco de dados
- [ ] Cada instância cria lead independente

## 🎯 Próximos Passos

Após testar, compartilhe:
1. Resultados dos testes (HTTP codes)
2. Logs do webhook
3. Se leads foram criados
4. Qualquer erro encontrado

Isso vai ajudar a identificar o problema real!
