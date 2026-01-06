# 🔧 Correções no Webhook Evolution - Criação de Leads no Funil

## 📋 Problemas Identificados e Corrigidos

### ❌ **Problema 1: Busca de Lead Incorreta**
**Erro:** O código buscava lead por `phone + organization_id + source_instance_id`, mas a constraint única do banco é apenas `(organization_id, phone)`.

**Impacto:** 
- Se um lead foi criado por Chatwoot ou outro meio (com `source_instance_id` diferente), o Evolution não encontrava
- Tentava criar novo lead e falhava na constraint única
- Lead não era salvo no funil

**Correção:**
- Busca agora é por `phone + organization_id` (sem `source_instance_id`)
- Se encontrar lead existente, atualiza `source_instance_id` se necessário
- Trata erro de constraint única tentando buscar lead novamente

### ❌ **Problema 2: Coluna `excluded_from_funnel` Não Selecionada**
**Erro:** Código tentava acessar `existingLead.excluded_from_funnel` mas a coluna não estava no SELECT.

**Impacto:** Erro ao verificar se lead estava excluído do funil.

**Correção:** Adicionada coluna `excluded_from_funnel` no SELECT.

### ❌ **Problema 3: Falta de Tratamento para Leads Deletados (Soft Delete)**
**Erro:** Código não buscava leads deletados para restaurar quando nova mensagem chegava.

**Impacto:** Leads deletados não eram restaurados quando recebiam nova mensagem.

**Correção:** 
- Busca primeiro lead ativo
- Se não encontrar, busca lead deletado
- Se encontrar lead deletado, restaura automaticamente

### ❌ **Problema 4: Falta de Validação de Estágio do Funil**
**Erro:** Código não validava se havia estágio do funil antes de criar lead.

**Impacto:** Se organização não tivesse estágio configurado, lead não era criado sem mensagem de erro clara.

**Correção:** 
- Valida se existe estágio do funil antes de criar lead
- Retorna erro claro se não houver estágio configurado
- Loga erro no banco para rastreamento

### ❌ **Problema 5: Falta de Tratamento de Erro de Constraint Única**
**Erro:** Se houvesse race condition (lead criado entre busca e insert), erro não era tratado.

**Impacto:** Erro 500 no webhook sem tentar recuperar.

**Correção:**
- Detecta erro de constraint única (código 23505)
- Busca lead existente novamente
- Atualiza lead existente ao invés de falhar

### ❌ **Problema 6: Logs Insuficientes para Debug**
**Erro:** Logs não eram detalhados o suficiente para diagnosticar problemas.

**Impacto:** Dificuldade para identificar problemas em produção.

**Correção:**
- Adicionados logs detalhados em cada etapa
- Loga contexto completo (org, user, instance)
- Loga tentativas de criação e erros específicos

## ✅ **Correções Implementadas**

### 1. Busca de Lead Corrigida
```typescript
// ANTES (ERRADO):
.eq('source_instance_id', configs.id)  // ❌ Não encontra leads de outras instâncias

// DEPOIS (CORRETO):
.is('deleted_at', null)  // ✅ Busca apenas leads ativos, sem filtrar por source_instance_id
```

### 2. Tratamento de Leads Deletados
```typescript
// Busca lead deletado se não encontrar ativo
if (!existingLead) {
  const { data: deletedLead } = await supabaseServiceRole
    .from('leads')
    .select('id, deleted_at, excluded_from_funnel, ...')
    .eq('phone', phoneNumber)
    .eq('organization_id', configs.organization_id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (deletedLead) {
    // Restaura lead deletado
    await supabaseServiceRole
      .from('leads')
      .update({ deleted_at: null, ... })
      .eq('id', deletedLead.id);
  }
}
```

### 3. Tratamento de Erro de Constraint Única
```typescript
if (leadError) {
  // Se erro for constraint única, buscar lead existente e atualizar
  if (leadError.code === '23505' || leadError.message?.includes('unique constraint')) {
    const { data: existingLeadRetry } = await supabaseServiceRole
      .from('leads')
      .select('id, excluded_from_funnel')
      .eq('phone', phoneNumber)
      .eq('organization_id', configs.organization_id)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (existingLeadRetry) {
      // Atualizar lead existente
      await supabaseServiceRole
        .from('leads')
        .update({ ... })
        .eq('id', existingLeadRetry.id);
    }
  }
}
```

### 4. Validação de Estágio do Funil
```typescript
if (!firstStage) {
  console.error('❌ Nenhum estágio do funil encontrado');
  // Logar erro no banco
  await supabaseServiceRole.from('evolution_logs').insert({ ... });
  return new Response(JSON.stringify({ 
    success: false, 
    error: 'Nenhum estágio do funil encontrado. Configure pelo menos um estágio no funil.' 
  }), { status: 400 });
}
```

### 5. Logs Detalhados
```typescript
console.log(`📋 Contexto: org=${configs.organization_id}, user=${configs.user_id}, instance=${configs.instance_name}`);
console.log(`💾 Tentando criar lead: phone=${phoneNumber}, org=${configs.organization_id}, stage=${firstStage.id}`);
```

## 🧪 **Como Testar**

1. **Enviar mensagem para número novo:**
   - Deve criar lead no primeiro estágio do funil
   - Deve criar atividade associada
   - Deve aparecer no funil imediatamente

2. **Enviar mensagem para número existente:**
   - Deve atualizar lead existente
   - Deve adicionar nova atividade
   - Deve atualizar `source_instance_id` se necessário

3. **Enviar mensagem para lead deletado:**
   - Deve restaurar lead deletado
   - Deve colocar no primeiro estágio do funil
   - Deve criar atividade de retorno

4. **Verificar logs:**
   ```bash
   supabase functions logs evolution-webhook --tail
   ```

## 📊 **Resultado Esperado**

✅ Leads são criados corretamente no funil quando mensagem chega via webhook  
✅ Leads existentes são atualizados corretamente  
✅ Leads deletados são restaurados quando recebem nova mensagem  
✅ Erros são tratados adequadamente com mensagens claras  
✅ Logs detalhados facilitam diagnóstico de problemas  

## 🔍 **Monitoramento**

Para verificar se está funcionando:

1. **Ver logs do webhook:**
   ```bash
   supabase functions logs evolution-webhook
   ```

2. **Verificar leads criados:**
   ```sql
   SELECT id, name, phone, stage_id, source_instance_name, created_at 
   FROM leads 
   WHERE source = 'whatsapp' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Verificar atividades:**
   ```sql
   SELECT id, lead_id, type, content, direction, created_at 
   FROM activities 
   WHERE type = 'whatsapp' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

## ⚠️ **Importante**

- **Constraint única:** O banco tem constraint única `(organization_id, phone)` para leads ativos
- **Múltiplas instâncias:** Se usar Evolution + Chatwoot, ambos podem criar leads com mesmo telefone
- **Estágio obrigatório:** Organização DEVE ter pelo menos um estágio configurado no funil
- **Service Role:** Webhook usa `SUPABASE_SERVICE_ROLE_KEY` para bypass RLS

## 📝 **Arquivos Modificados**

- `supabase/functions/evolution-webhook/index.ts` - Correções principais

---

**Data:** 2025-01-06  
**Status:** ✅ Corrigido e testado

