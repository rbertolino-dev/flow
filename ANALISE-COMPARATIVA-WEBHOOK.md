# 🔍 Análise Comparativa - Webhook Evolution (Criação de Leads)

## 📋 Objetivo
Comparar a lógica de criação de leads no webhook atual com o repositório oficial para identificar diferenças que impedem a criação de leads.

## 🔎 Pontos Críticos de Verificação

### 1. **Detecção de Mensagem Recebida vs Enviada**

**Código Atual (linha 141-142):**
```typescript
const isFromMe = data.key.fromMe === true;
const direction = isFromMe ? 'outgoing' : 'incoming';
```

**Verificação:**
- ✅ Lógica parece correta
- ⚠️ **POSSÍVEL PROBLEMA**: Se `data.key.fromMe` for `undefined` ou `null`, `isFromMe` será `false`, tratando como mensagem recebida
- ⚠️ **POSSÍVEL PROBLEMA**: Algumas versões da Evolution podem usar `fromMe` como string `"true"` ao invés de boolean

**Recomendação:**
```typescript
const isFromMe = data.key?.fromMe === true || data.key?.fromMe === "true";
```

---

### 2. **Validação de Número Brasileiro**

**Código Atual (linhas 379-401):**
```typescript
const isBrazilian = phoneNumber.startsWith('55') && phoneNumber.length >= 12 && phoneNumber.length <= 13;
const isBRWithoutCode = phoneNumber.length >= 10 && phoneNumber.length <= 11 && !phoneNumber.startsWith('55');

if (!isBrazilian && !isBRWithoutCode) {
  // Ignora número internacional
  return new Response(...);
}
```

**Verificação:**
- ✅ Lógica parece correta
- ⚠️ **POSSÍVEL PROBLEMA**: Se número vier com formatação (espaços, parênteses, hífens), `replace(/\D/g, '')` pode não funcionar corretamente
- ⚠️ **POSSÍVEL PROBLEMA**: Números internacionais podem estar sendo bloqueados incorretamente

**Recomendação:**
- Adicionar logs detalhados do número antes e depois da normalização
- Verificar se números brasileiros estão sendo normalizados corretamente

---

### 3. **Busca de Lead Existente**

**Código Atual (linhas 432-438):**
```typescript
let { data: existingLead } = await supabaseServiceRole
  .from('leads')
  .select('id, deleted_at, excluded_from_funnel, source_instance_id, source_instance_name')
  .eq('phone', phoneNumber)
  .eq('organization_id', configs.organization_id)
  .is('deleted_at', null)
  .maybeSingle();
```

**Verificação:**
- ✅ Busca por `phone + organization_id` (correto)
- ✅ Usa `maybeSingle()` (correto)
- ✅ Busca leads deletados depois (linhas 441-451)
- ⚠️ **POSSÍVEL PROBLEMA**: Se `phoneNumber` tiver formatação diferente (com/sem DDI), pode não encontrar lead existente

**Recomendação:**
- Normalizar número antes de buscar (sempre remover formatação)
- Adicionar log do número usado na busca

---

### 4. **Criação de Novo Lead**

**Código Atual (linhas 578-706):**
```typescript
if (!isFromMe) {
  // Buscar primeiro estágio do funil
  const { data: firstStage } = await supabaseServiceRole
    .from('pipeline_stages')
    .select('id')
    .eq('organization_id', configs.organization_id)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstStage) {
    // Retorna erro
    return new Response(...);
  }

  // Criar lead
  const { data: newLead, error: leadError } = await supabaseServiceRole
    .from('leads')
    .insert({...})
    .select()
    .single();
}
```

**Verificação:**
- ✅ Só cria se `!isFromMe` (correto)
- ✅ Valida estágio do funil (correto)
- ✅ Trata erro de constraint única (linhas 647-687)
- ⚠️ **POSSÍVEL PROBLEMA**: Se `isFromMe` estiver incorreto (sempre `false`), pode criar leads para mensagens enviadas
- ⚠️ **POSSÍVEL PROBLEMA**: Se `firstStage` for `null` mas não retornar erro, lead não será criado

**Recomendação:**
- Adicionar logs detalhados antes de criar lead
- Verificar se `isFromMe` está sendo detectado corretamente

---

### 5. **Autenticação e Configuração**

**Código Atual (linhas 214-288):**
```typescript
// Buscar config por webhook_secret
const { data: cfgBySecret } = await supabase
  .from('evolution_config')
  .select('user_id, instance_name, id, organization_id, webhook_secret, api_key')
  .eq('webhook_secret', providedSecret)
  .maybeSingle();

// Se não encontrar, buscar por api_key
// Se não encontrar, buscar por instance_name
```

**Verificação:**
- ✅ Múltiplos métodos de autenticação (correto)
- ✅ Fallback para `instance_name` (correto)
- ⚠️ **POSSÍVEL PROBLEMA**: Se `providedSecret` estiver vazio/null, busca falha silenciosamente
- ⚠️ **POSSÍVEL PROBLEMA**: Se `configs` for `null`, retorna erro 403 mas não cria lead

**Recomendação:**
- Adicionar logs detalhados da autenticação
- Verificar se `webhook_secret` está configurado corretamente no banco

---

## 🐛 Possíveis Problemas Identificados

### **Problema 1: Detecção de `isFromMe` Incorreta**
**Sintoma:** Leads não são criados mesmo para mensagens recebidas
**Causa:** `data.key.fromMe` pode estar vindo como string ou undefined
**Solução:**
```typescript
const isFromMe = data.key?.fromMe === true || data.key?.fromMe === "true" || data.key?.fromMe === 1;
```

### **Problema 2: Normalização de Telefone**
**Sintoma:** Leads não são encontrados ou criados duplicados
**Causa:** Número pode ter formatação diferente
**Solução:** Normalizar número antes de todas as operações

### **Problema 3: Autenticação Falhando Silenciosamente**
**Sintoma:** Webhook recebido mas lead não criado
**Causa:** `providedSecret` pode estar vazio ou incorreto
**Solução:** Adicionar validação e logs detalhados

### **Problema 4: Estágio do Funil Não Encontrado**
**Sintoma:** Erro "Nenhum estágio do funil encontrado"
**Causa:** Organização não tem estágios configurados
**Solução:** Verificar se organização tem estágios no banco

---

## 🔧 Script de Diagnóstico

Criar script para verificar:
1. Se `isFromMe` está sendo detectado corretamente
2. Se número está sendo normalizado corretamente
3. Se autenticação está funcionando
4. Se estágio do funil existe
5. Se lead já existe no banco

---

## 📊 Próximos Passos

1. Adicionar logs detalhados em cada etapa crítica
2. Verificar logs do webhook no Supabase
3. Testar com payload real da Evolution API
4. Comparar com repositório oficial (se acessível)
5. Criar script de teste que simula webhook recebido

