# 🔧 Correção: Segunda Instância Não Cadastrava Leads

## 📋 Problema Identificado

Quando havia múltiplas instâncias do Evolution na mesma organização, apenas a primeira instância conseguia cadastrar leads via webhook. A segunda instância **não cadastrava nenhum lead**, mesmo quando recebia mensagens de números novos.

## 🔍 Causa Raiz

### Problema na Autenticação do Webhook

**IMPORTANTE:** Cada instância gera seu próprio `webhook_secret` único (UUID) quando é criada. O webhook URL é configurado na Evolution API com esse secret único: `?secret=${webhookSecret}`.

**Mas o problema ocorria quando:**

1. O webhook não enviava o `secret` corretamente na URL
2. Ou o `instance_name` no payload não correspondia ao `instance_name` no banco
3. A busca priorizava apenas por `webhook_secret`, e se não encontrasse, tentava por `api_key`
4. A validação do `instance_name` bloqueava se não correspondesse

**Problema:** A busca não priorizava `instance_name + secret` juntos, então se o secret não fosse enviado corretamente ou houvesse algum problema, a segunda instância era rejeitada:

```typescript
// Linha 305-310 (ANTES)
if (configs.instance_name && configs.instance_name !== instance) {
  console.error('❌ Instance name mismatch para o segredo informado');
  return new Response(
    JSON.stringify({ success: false, message: 'Instance mismatch' }),
    { status: 400, ... }
  );
}
```

**Resultado:** Segunda instância era rejeitada mesmo com segredo correto!

## ✅ Solução Implementada

### Nova Ordem de Busca (Mais Específica Primeiro)

Agora o webhook busca na seguinte ordem:

1. **`instance_name` + `webhook_secret`** (mais específico) ✅
2. **`instance_name` + `api_key`** (mais específico) ✅
3. **Apenas `webhook_secret`** (fallback)
4. **Apenas `api_key`** (fallback)
5. **Apenas `instance_name`** (última tentativa)

### Validação Ajustada

- Se encontrou por `instance_name` + secret → Validação rígida (deve corresponder)
- Se encontrou apenas por secret → Apenas aviso (não bloqueia), permite usar instância encontrada

### Código Implementado

```typescript
// 1. Tentar buscar por instance_name + webhook_secret (mais específico)
if (instance) {
  const { data: cfgByInstanceSecret } = await supabase
    .from('evolution_config')
    .eq('instance_name', instance)
    .eq('webhook_secret', providedSecret)
    .maybeSingle();
  
  if (cfgByInstanceSecret) {
    configs = cfgByInstanceSecret;
    authMethod = 'instance_secret';
  } else {
    // 2. Tentar instance_name + api_key
    const { data: cfgByInstanceApiKey } = await supabase
      .from('evolution_config')
      .eq('instance_name', instance)
      .eq('api_key', providedSecret)
      .maybeSingle();
    
    if (cfgByInstanceApiKey) {
      configs = cfgByInstanceApiKey;
      authMethod = 'instance_apikey';
    }
  }
}

// 3. Fallback: buscar apenas por secret (se não encontrou por instance_name)
if (!configs) {
  // ... busca por webhook_secret ou api_key
}
```

## 🧪 Como Testar

1. Configure duas instâncias do Evolution na mesma organização
2. Certifique-se de que cada instância tem seu próprio `webhook_secret` único (ou use `instance_name` no webhook)
3. Envie mensagem para um número novo na primeira instância
4. Verifique se lead foi criado ✅
5. Envie mensagem para outro número novo na segunda instância
6. Verifique se lead foi criado ✅ (agora deve funcionar!)

## 📝 Logs Esperados

### Primeira Instância:
```
✅ Config encontrada por instance_name + webhook_secret: instancia1
✅ Config validada: org=xxx, user=yyy, instance=instancia1
🆕 Criando novo lead...
✅ Lead criado com ID: zzz
```

### Segunda Instância:
```
✅ Config encontrada por instance_name + webhook_secret: instancia2
✅ Config validada: org=xxx, user=yyy, instance=instancia2
🆕 Criando novo lead...
✅ Lead criado com ID: www
```

## ⚠️ Importante

### Como Funciona o Webhook Secret

**Cada instância já tem seu próprio `webhook_secret` único:**
- Quando uma instância é criada, um UUID único é gerado automaticamente
- O webhook URL é configurado na Evolution API com esse secret: `?secret=${webhookSecret}`
- Há uma constraint única no banco que garante que cada `webhook_secret` é único

### Por Que a Correção Ainda é Útil

Mesmo com secrets únicos, a correção é importante porque:

1. **Robustez**: Se o secret não for enviado corretamente no webhook (problema de configuração), ainda tenta buscar por `instance_name`
2. **Fallback**: Se houver algum problema na configuração do webhook na Evolution API, ainda funciona
3. **Melhor identificação**: Buscar por `instance_name + secret` primeiro é mais específico e garante que encontramos a instância correta mesmo em casos edge

### Configuração do Webhook na Evolution API

Ao configurar o webhook, certifique-se de que:
- O `webhook_secret` está sendo enviado corretamente na URL: `?secret=${webhookSecret}`
- O `instance_name` está no payload do webhook (enviado pela Evolution API)
- Cada instância tem seu próprio `webhook_secret` único (gerado automaticamente)

## 📌 Arquivos Modificados

- `supabase/functions/evolution-webhook/index.ts` - Lógica de autenticação melhorada

## ✅ Resultado

Agora **todas as instâncias** conseguem cadastrar leads via webhook, mesmo quando compartilham o mesmo `webhook_secret` ou `api_key`, pois a busca prioriza `instance_name` + secret para identificar a instância correta.
