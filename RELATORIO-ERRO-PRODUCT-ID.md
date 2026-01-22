# 📋 Relatório de Erro: `column leads_1.product_id does not exist`

## 🔍 Diagnóstico do Erro

### Problema Identificado
O código estava tentando buscar uma coluna `product_id` diretamente da tabela `leads`, mas essa coluna **não existe** no banco de dados.

### Causa Raiz
- A tabela `leads` **não possui** uma coluna `product_id` diretamente
- Os produtos são relacionados aos leads através de uma **tabela intermediária** chamada `lead_products`
- A estrutura correta é: `leads` ← `lead_products` → `products`

### Estrutura Real do Banco

```
leads
├── id
├── name
├── phone
├── email
└── ... (outros campos)

lead_products (tabela de relacionamento)
├── id
├── lead_id (FK → leads.id)
├── product_id (FK → products.id)
├── quantity
├── unit_price
└── total_price

products
├── id
├── name
└── ... (outros campos)
```

### Erro Específico
```
column leads_1.product_id does not exist
```

O Supabase estava tentando executar:
```sql
SELECT ..., product_id FROM leads WHERE ...
```

Mas a coluna `product_id` não existe na tabela `leads`.

## ✅ Solução Aplicada

### Correção Implementada

1. **Removida a coluna `product_id` da query do lead**
   ```typescript
   // ANTES (ERRADO):
   lead:leads(..., product_id, ...)
   
   // DEPOIS (CORRETO):
   lead:leads(..., ...) // sem product_id
   ```

2. **Busca do produto através da tabela `lead_products`**
   ```typescript
   // Buscar produto do lead através da tabela lead_products
   if (contract.lead?.id) {
     const { data: leadProductData } = await supabase
       .from('lead_products')
       .select('product:products(name)')
       .eq('lead_id', contract.lead.id)
       .limit(1)
       .maybeSingle();
     
     if (leadProductData?.product) {
       leadWithProduct = {
         ...contract.lead,
         product: { name: leadProductData.product.name }
       };
     }
   }
   ```

### Arquivos Modificados
- `src/hooks/useContracts.ts` - Função `regenerateContractPDF`

## 📊 Impacto

### Antes da Correção
- ❌ Erro 400 (Bad Request) ao tentar recarregar contrato
- ❌ Mensagem: "Contrato não encontrado"
- ❌ Funcionalidade de regeneração de PDF quebrada

### Depois da Correção
- ✅ Query funciona corretamente
- ✅ Produto é buscado através da relação correta
- ✅ Funcionalidade de regeneração de PDF restaurada

## 🔧 Detalhes Técnicos

### Query Corrigida
```typescript
// Query do contrato (sem product_id)
.select(`
  *,
  template:contract_templates(*),
  lead:leads(
    id, 
    name, 
    phone, 
    email, 
    company, 
    cpf_cnpj, 
    value, 
    status, 
    source, 
    notes, 
    created_at, 
    last_contact
  )
`)

// Busca separada do produto
.from('lead_products')
.select('product:products(name)')
.eq('lead_id', contract.lead.id)
.limit(1)
```

### Comportamento
- Se o lead tiver produtos associados, pega o primeiro produto
- Se não tiver produtos, `lead.product` será `undefined`
- A substituição `{{produto}}` no template funcionará corretamente (vazio se não houver produto)

## ✅ Status
**CORRIGIDO** - Erro resolvido e funcionalidade restaurada.
