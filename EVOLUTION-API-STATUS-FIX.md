# 🔧 Correções na Integração com Evolution API para Status

## Problema Identificado

A Evolution API pode usar diferentes formatos de payload dependendo da versão. A função foi atualizada para tentar múltiplos formatos automaticamente.

## Melhorias Implementadas

### 1. Múltiplos Formatos de Payload

A função agora tenta 4 formatos diferentes automaticamente:

**Formato 1:**
```json
{
  "type": "image",
  "content": "https://...",
  "allContacts": true,
  "caption": "Legenda opcional"
}
```

**Formato 2:**
```json
{
  "image": "https://...",
  "caption": "Legenda opcional",
  "allContacts": true
}
```

**Formato 3:**
```json
{
  "mediatype": "image",
  "media": "https://...",
  "caption": "Legenda opcional",
  "allContacts": true
}
```

**Formato 4:**
```json
{
  "type": "image",
  "content": "https://...",
  "caption": "Legenda opcional"
}
```

### 2. Logging Detalhado

A função agora registra:
- URL da requisição
- Cada tentativa de formato
- Resposta de sucesso ou erro
- Qual formato funcionou

### 3. Tratamento de Erros Melhorado

- Tenta todos os formatos antes de falhar
- Registra qual formato funcionou (se algum funcionar)
- Mensagens de erro mais detalhadas

## Endpoint Utilizado

```
POST {baseUrl}/message/sendStatus/{instance_name}
```

## Headers

```
apikey: {api_key}
Content-Type: application/json
```

## Verificações Importantes

1. **Instância deve estar conectada**: `is_connected = true`
2. **Número de telefone configurado**: A instância deve ter o número configurado antes de conectar
3. **URL da mídia acessível**: A URL deve ser pública e acessível pela Evolution API
4. **Versão da Evolution API**: Versões mais recentes podem ter formatos diferentes

## Como Testar

1. Verifique os logs da edge function no Supabase Dashboard
2. Procure por mensagens como:
   - `📤 Publicando status via Evolution API`
   - `📋 Tentativa X/4 - Payload:`
   - `✅ Status publicado com sucesso usando formato X`
   - `⚠️ Formato X falhou:`

3. Se todos os formatos falharem, verifique:
   - Se a instância está conectada
   - Se a URL da mídia é acessível
   - Se a Evolution API suporta o endpoint `/message/sendStatus/`
   - Versão da Evolution API instalada

## Próximos Passos se Ainda Não Funcionar

1. Verificar documentação específica da versão da Evolution API instalada
2. Testar o endpoint diretamente via Postman/curl
3. Verificar se a Evolution API suporta publicação de status na versão instalada
4. Considerar usar webhook para verificar se o status foi publicado

## Exemplo de Teste Manual

```bash
curl -X POST "https://sua-evolution-api.com/message/sendStatus/sua-instancia" \
  -H "apikey: sua-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "content": "https://exemplo.com/imagem.jpg",
    "allContacts": true,
    "caption": "Teste"
  }'
```



