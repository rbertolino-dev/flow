# 🔍 Teste: Dados de Autenticação

## ⚠️ Problema Reportado

Os dados de autenticação (IP, navegador, etc.) não estão sendo salvos e não aparecem no PDF nem no painel.

## 🔧 Verificação Passo a Passo

### 1. Verificar se as Migrações Foram Aplicadas

Execute no SQL Editor do Supabase:

```sql
-- Verificar se as colunas existem
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'contract_signatures' 
AND column_name IN ('user_agent', 'device_info', 'validation_hash', 'signed_ip_country');
```

**Resultado esperado:** 4 linhas (uma para cada coluna)

**Se retornar 0 linhas:** Execute `supabase/migrations/apply_new_migrations.sql`

### 2. Verificar no Console do Navegador

1. Abra o Console (F12)
2. Assine um contrato
3. Procure por estes logs:

```
💾 Salvando assinatura com dados: { ... }
✅ Assinatura salva com sucesso: { ... }
✅ Dados de autenticação salvos: { ip: "...", user_agent: "Sim", ... }
```

### 3. Verificar no Banco de Dados

Execute no SQL Editor:

```sql
-- Ver última assinatura salva
SELECT 
    id,
    signer_name,
    signed_at,
    ip_address,
    user_agent,
    signed_ip_country,
    validation_hash,
    device_info
FROM contract_signatures
ORDER BY signed_at DESC
LIMIT 1;
```

**Se `ip_address`, `user_agent`, etc. estiverem NULL:**
- As colunas podem não existir
- Ou houve erro ao salvar (verifique console)

### 4. Verificar no PDF

Após assinar, baixe o PDF e verifique:
- Deve ter página "ASSINATURAS" no final
- Deve mostrar dados de autenticação abaixo de cada assinatura

### 5. Verificar no Painel

Na página de contratos, ao visualizar um contrato assinado:
- Deve aparecer seção "Assinaturas"
- Deve ter botão "Dados de Autenticação e Validação" (expansível)
- Ao expandir, deve mostrar IP, navegador, hash, etc.

## 🐛 Possíveis Problemas

### Problema 1: Colunas não existem
**Sintoma:** Erro no console: "column does not exist"
**Solução:** Aplicar migrações SQL

### Problema 2: Dados não estão sendo capturados
**Sintoma:** Logs mostram `ip_address: null`
**Solução:** Verificar se APIs externas estão acessíveis (ipify.org, ipapi.co)

### Problema 3: Dados salvos mas não aparecem no PDF
**Sintoma:** Dados no banco, mas PDF não mostra
**Solução:** Verificar se `generateContractPDF` está recebendo os dados

## 📋 Checklist

- [ ] Migrações SQL aplicadas
- [ ] Colunas existem no banco
- [ ] Console mostra logs de salvamento
- [ ] Dados aparecem na query SQL
- [ ] PDF contém página de assinaturas
- [ ] PDF mostra dados de autenticação
- [ ] Painel mostra dados de autenticação


