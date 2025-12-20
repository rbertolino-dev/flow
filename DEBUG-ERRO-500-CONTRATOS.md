# 🔍 Debug: Erro 500 ao Enviar Contrato

## 📋 Problema
Erro 500 (Internal Server Error) ao tentar enviar contrato via WhatsApp.

## 🔧 Como Verificar os Logs

### Opção 1: Supabase Dashboard (Recomendado)

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog
   - Faça login

2. **Vá em Edge Functions:**
   - Menu lateral → **Edge Functions**

3. **Abra a função `send-contract-whatsapp`:**
   - Clique na função na lista

4. **Vá na aba "Logs":**
   - Você verá os logs em tempo real
   - Procure por mensagens com ❌ ou ⚠️

### Opção 2: Via CLI (se tiver acesso)

```bash
# Ver logs recentes
supabase functions logs send-contract-whatsapp --tail

# Ou ver logs específicos
supabase functions logs send-contract-whatsapp
```

## 🔍 O que Procurar nos Logs

A edge function agora tem logs detalhados em cada etapa:

### 1. Recebimento da Requisição
```
📥 Recebido: { contract_id: "...", instance_id: "..." }
```

### 2. Busca do Contrato
```
🔍 Buscando contrato: [ID]
📄 Contrato encontrado: Sim/Não
❌ Erro contrato: [detalhes]
```

### 3. Validação do Lead
```
👤 Validando lead: { has_lead: true/false, lead_id: "...", lead_phone: "..." }
```

### 4. Busca da Instância Evolution
```
🔍 Buscando instância Evolution: [ID]
📱 Instância encontrada: Sim/Não
❌ Erro instância: [detalhes]
```

### 5. Envio para Evolution API
```
📤 Enviando para Evolution API: { url: "...", number: "...", fileName: "..." }
📥 Resposta Evolution: { status: 200, ok: true }
```

### 6. Erros Gerais
```
❌ Erro no send-contract-whatsapp: [mensagem]
❌ Stack trace: [detalhes]
```

## 🐛 Possíveis Causas do Erro 500

### 1. Contrato não encontrado
**Sintoma:** Log mostra "Contrato encontrado: Não"
**Solução:** Verificar se o `contract_id` está correto

### 2. Lead não encontrado ou sem telefone
**Sintoma:** Log mostra "Lead não encontrado ou sem telefone"
**Solução:** 
- Verificar se o contrato tem um `lead_id` válido
- Verificar se o lead tem telefone cadastrado

### 3. Instância Evolution não encontrada
**Sintoma:** Log mostra "Instância encontrada: Não"
**Solução:** Verificar se o `instance_id` está correto e se a instância está conectada

### 4. Erro ao enviar para Evolution API
**Sintoma:** Log mostra erro na resposta da Evolution
**Solução:** Verificar:
- Se a API da Evolution está acessível
- Se a API key está correta
- Se a instância está conectada

### 5. Erro ao atualizar contrato
**Sintoma:** Erro silencioso (não aparece nos logs principais)
**Solução:** Verificar permissões RLS na tabela `contracts`

## 📝 Checklist de Verificação

Antes de tentar novamente, verifique:

- [ ] O contrato existe no banco de dados
- [ ] O contrato tem um `lead_id` válido
- [ ] O lead tem telefone cadastrado
- [ ] A instância Evolution está conectada (`is_connected = true`)
- [ ] A instância pertence à mesma organização do contrato
- [ ] O contrato tem PDF (`pdf_url` ou `signed_pdf_url`)
- [ ] A API da Evolution está acessível

## 🔧 Como Testar

1. **Tente enviar o contrato novamente**
2. **Imediatamente após o erro, vá nos logs**
3. **Copie os logs que aparecem com ❌**
4. **Envie os logs para análise**

## 📊 Informações Úteis para Debug

Se você conseguir acessar os logs, envie:

1. **Últimos logs da função** (últimas 20 linhas)
2. **ID do contrato** que está tentando enviar
3. **ID da instância** que está usando
4. **Mensagem de erro completa** do navegador (F12 → Console)

## ✅ Próximos Passos

1. Verifique os logs no Dashboard
2. Identifique em qual etapa está falhando
3. Me envie os logs para eu ajudar a corrigir

---

**Última atualização:** Edge function atualizada com logs detalhados
**Versão:** 129.2kB

