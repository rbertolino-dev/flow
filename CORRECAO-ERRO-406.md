# 🔧 Correção do Erro 406 (Not Acceptable)

## Problema Identificado

O erro **406 (Not Acceptable)** estava ocorrendo porque:

1. **O endpoint `/message/sendStatus/` pode não existir** na versão da Evolution API instalada
2. A Evolution API retorna 406 quando o endpoint não existe ou não aceita o formato da requisição
3. O código estava tentando múltiplos formatos no endpoint errado

## Correção Aplicada

### 1. Detecção de Erro 406
A função agora detecta quando o endpoint `sendStatus` retorna 406 ou 404 e **imediatamente** tenta usar `sendMedia` sem o campo `number`.

### 2. Fallback Inteligente
```typescript
// Se sendStatus retornar 404 ou 406
if (response.status === 404 || response.status === 406) {
  // Tenta imediatamente sendMedia sem number
  const sendMediaPayload = {
    mediatype: mediaType,
    media: mediaUrl,
    caption: caption,
    // SEM o campo 'number' - isso pode funcionar como status
  };
}
```

### 3. Headers Corrigidos
Adicionado header `Accept: application/json` para garantir que a Evolution API aceite a requisição.

## Fluxo Corrigido

1. ✅ Tenta `/message/sendStatus/` com formato `{ image: "..." }`
2. ✅ Se retornar 404 ou 406, tenta `/message/sendMedia/` **sem** campo `number`
3. ✅ Se ainda falhar, tenta outros formatos alternativos
4. ✅ Logs detalhados para identificar qual método funcionou

## Como Verificar

Após o deploy, verifique os logs da edge function:

```
⚠️ Endpoint sendStatus retornou 406, tentando sendMedia sem number...
✅ Status publicado com sucesso usando sendMedia (sem number)
```

OU

```
✅ Status publicado com sucesso usando formato 1
```

## Observação Importante

**O endpoint `/message/sendStatus/` pode não existir em todas as versões da Evolution API!**

Se a sua versão não suporta esse endpoint, a função agora usa automaticamente `sendMedia` sem o campo `number`, que pode funcionar como status em algumas versões.

## Próximos Passos

1. Fazer deploy da função atualizada
2. Testar publicação de status
3. Verificar logs para confirmar qual método funcionou
4. Se ainda não funcionar, verificar:
   - Versão da Evolution API
   - Se status é suportado na sua versão
   - Configuração da instância (número de telefone)

