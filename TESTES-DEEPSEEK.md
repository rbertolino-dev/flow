# 🧪 Guia de Testes - Correções DeepSeek

**Data:** 15/12/2025  
**Objetivo:** Validar todas as correções aplicadas

---

## 📋 Pré-requisitos

1. ✅ API Key do DeepSeek configurada
2. ✅ Organização ativa no sistema
3. ✅ Pelo menos 1 lead criado
4. ✅ Pelo menos 1 etapa do funil criada
5. ✅ Pelo menos 1 tag criada

---

## 🧪 Testes de Validação

### Teste 1: Criar Lead - Validações

#### ✅ Teste 1.1: Dados Válidos
```json
{
  "message": "Criar um lead chamado João Silva com telefone 11987654321 e email joao@teste.com"
}
```
**Resultado esperado:** Lead criado com sucesso

#### ❌ Teste 1.2: Nome Muito Curto
```json
{
  "message": "Criar um lead chamado J com telefone 11987654321"
}
```
**Resultado esperado:** Erro "Nome deve ter entre 2 e 200 caracteres"

#### ❌ Teste 1.3: Telefone Inválido
```json
{
  "message": "Criar um lead chamado João Silva com telefone 123"
}
```
**Resultado esperado:** Erro "Telefone inválido. Deve ter entre 10 e 15 dígitos"

#### ❌ Teste 1.4: Email Inválido
```json
{
  "message": "Criar um lead chamado João Silva com telefone 11987654321 e email email-invalido"
}
```
**Resultado esperado:** Erro "Email inválido"

#### ❌ Teste 1.5: Valor Negativo
```json
{
  "message": "Criar um lead chamado João Silva com telefone 11987654321 e valor -100"
}
```
**Resultado esperado:** Erro "Valor deve ser um número positivo"

---

### Teste 2: Buscar Leads - Validações

#### ✅ Teste 2.1: Busca Válida
```json
{
  "message": "Buscar leads com nome João"
}
```
**Resultado esperado:** Lista de leads encontrados

#### ❌ Teste 2.2: Query Muito Curta
```json
{
  "message": "Buscar leads com nome J"
}
```
**Resultado esperado:** Erro "Query deve ter pelo menos 2 caracteres"

#### ❌ Teste 2.3: Query Muito Longa
```json
{
  "message": "Buscar leads com nome [string de 101 caracteres]"
}
```
**Resultado esperado:** Erro "Query muito longa. Máximo 100 caracteres"

---

### Teste 3: Atualizar Lead - Validações

#### ✅ Teste 3.1: Atualização Válida
```json
{
  "message": "Atualizar o lead [ID] com nome Maria Silva"
}
```
**Resultado esperado:** Lead atualizado com sucesso

#### ❌ Teste 3.2: Lead de Outra Organização
```json
{
  "message": "Atualizar o lead [ID_DE_OUTRA_ORG] com nome Teste"
}
```
**Resultado esperado:** Erro "Lead não encontrado ou não pertence à organização"

#### ❌ Teste 3.3: UUID Inválido
```json
{
  "message": "Atualizar o lead 123 com nome Teste"
}
```
**Resultado esperado:** Erro "ID do lead inválido"

---

### Teste 4: Adicionar Tag - Validações

#### ✅ Teste 4.1: Adição Válida
```json
{
  "message": "Adicionar tag [TAG_ID] ao lead [LEAD_ID]"
}
```
**Resultado esperado:** Tag adicionada com sucesso

#### ❌ Teste 4.2: Tag de Outra Organização
```json
{
  "message": "Adicionar tag [TAG_ID_OUTRA_ORG] ao lead [LEAD_ID]"
}
```
**Resultado esperado:** Erro "Tag não encontrada ou não pertence à organização"

---

### Teste 5: Agendar Ligação - Validações

#### ✅ Teste 5.1: Agendamento Válido
```json
{
  "message": "Agendar ligação para o lead [LEAD_ID] amanhã às 14h"
}
```
**Resultado esperado:** Ligação agendada com sucesso

#### ❌ Teste 5.2: Data no Passado
```json
{
  "message": "Agendar ligação para o lead [LEAD_ID] ontem às 14h"
}
```
**Resultado esperado:** Erro "Não é possível agendar ligação no passado"

#### ❌ Teste 5.3: Prioridade Inválida
```json
{
  "message": "Agendar ligação para o lead [LEAD_ID] com prioridade urgente"
}
```
**Resultado esperado:** Erro "Prioridade deve ser: low, normal ou high"

---

### Teste 6: Enviar WhatsApp - Validações

#### ✅ Teste 6.1: Envio Válido
```json
{
  "message": "Enviar mensagem WhatsApp para o lead [LEAD_ID] dizendo: Olá, como posso ajudar?"
}
```
**Resultado esperado:** Mensagem enviada com sucesso

#### ❌ Teste 6.2: Mensagem Muito Longa
```json
{
  "message": "Enviar mensagem WhatsApp para o lead [LEAD_ID] dizendo: [string de 1001 caracteres]"
}
```
**Resultado esperado:** Erro "Mensagem deve ter entre 1 e 1000 caracteres"

#### ❌ Teste 6.3: Lead Sem Telefone Válido
```json
{
  "message": "Enviar mensagem WhatsApp para o lead [LEAD_ID_SEM_TELEFONE] dizendo: Olá"
}
```
**Resultado esperado:** Erro "Lead não possui telefone válido"

---

### Teste 7: Tamanho de Mensagem

#### ❌ Teste 7.1: Mensagem Muito Longa
```json
{
  "message": "[string de 5001 caracteres]"
}
```
**Resultado esperado:** Erro "Mensagem muito longa. Máximo 5000 caracteres"

---

### Teste 8: Sanitização de Erros

#### Verificação de Logs
1. Provocar um erro intencional
2. Verificar logs no Supabase
3. **Verificar que:**
   - ✅ Não contém API keys (`sk-...`)
   - ✅ Não contém tokens Bearer
   - ✅ Mensagens são genéricas
   - ✅ Sem informações sensíveis

---

## ✅ Checklist de Testes

### Validações Básicas
- [ ] Criar lead com dados válidos
- [ ] Criar lead com nome muito curto
- [ ] Criar lead com telefone inválido
- [ ] Criar lead com email inválido
- [ ] Criar lead com valor negativo

### Validações de Organização
- [ ] Tentar acessar lead de outra organização
- [ ] Tentar usar tag de outra organização
- [ ] Tentar usar etapa de outra organização

### Validações de Tamanho
- [ ] Mensagem muito longa (> 5000 caracteres)
- [ ] Query de busca muito curta (< 2 caracteres)
- [ ] Query de busca muito longa (> 100 caracteres)
- [ ] Mensagem WhatsApp muito longa (> 1000 caracteres)

### Validações de Formato
- [ ] UUID inválido
- [ ] Data inválida
- [ ] Prioridade inválida
- [ ] Telefone inválido

### Sanitização
- [ ] Verificar logs não expõem API keys
- [ ] Verificar logs não expõem tokens
- [ ] Verificar mensagens de erro são genéricas

---

## 🚀 Como Executar os Testes

### Via Interface
1. Acesse a página do Assistente
2. Execute cada teste manualmente
3. Verifique os resultados

### Via API (Postman/curl)
```bash
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/deepseek-assistant \
  -H "Authorization: Bearer [TOKEN]" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Criar um lead chamado João Silva com telefone 11987654321",
    "organization_id": "[ORG_ID]"
  }'
```

---

## 📊 Resultados Esperados

### ✅ Sucesso
- Funções executam corretamente
- Validações bloqueiam dados inválidos
- Erros são sanitizados
- Logs não expõem informações sensíveis

### ❌ Falhas
- Se alguma validação não funcionar, reportar
- Se logs expuserem dados sensíveis, reportar
- Se validação de organização falhar, reportar

---

**Status:** ✅ Pronto para execução



