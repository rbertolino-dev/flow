# 🔍 Diagnóstico: Assinaturas não aparecem no PDF

## ⚠️ Problema

As assinaturas do cliente e os dados de autenticação (IP, navegador, etc.) não estão aparecendo no PDF.

## 🔧 Solução Passo a Passo

### Passo 1: Verificar se as Migrações foram Aplicadas

1. **Acesse o SQL Editor do Supabase:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new

2. **Execute o script de verificação:**
   - Copie e cole o conteúdo do arquivo `VERIFICAR-MIGRACOES-APLICADAS.sql`
   - Execute (Ctrl+Enter)

3. **Verifique o resultado:**
   - Se retornar **0 linhas** ou colunas não encontradas → **Migrações NÃO foram aplicadas**
   - Se retornar as colunas → **Migrações foram aplicadas**

### Passo 2: Aplicar as Migrações (se necessário)

Se as migrações não foram aplicadas:

1. **No SQL Editor, execute:**
   - Copie e cole TODO o conteúdo de `supabase/migrations/apply_new_migrations.sql`
   - Execute (Ctrl+Enter)

2. **Verifique se houve erros:**
   - Se aparecer "already exists" → Normal, pode ignorar
   - Se aparecer outros erros → Anote e me informe

### Passo 3: Verificar no Console do Navegador

1. **Abra o Console do Navegador** (F12)
2. **Assine um contrato novamente**
3. **Procure por logs:**
   - `💾 Salvando assinatura com dados:` - Mostra os dados sendo salvos
   - `✅ Assinatura salva com sucesso:` - Confirma que foi salvo
   - `📋 Assinaturas encontradas:` - Mostra quantas assinaturas foram encontradas
   - `📄 Gerando PDF com assinaturas:` - Mostra os dados que serão incluídos no PDF
   - `📝 Adicionando página de assinaturas` - Confirma que está adicionando ao PDF

### Passo 4: Verificar Dados no Banco

Execute no SQL Editor:

```sql
-- Ver todas as assinaturas de um contrato específico
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
WHERE contract_id = 'ID_DO_CONTRATO_AQUI'
ORDER BY signed_at DESC;
```

Substitua `ID_DO_CONTRATO_AQUI` pelo ID real de um contrato que foi assinado.

## 🐛 Possíveis Problemas e Soluções

### Problema 1: Colunas não existem no banco
**Sintoma:** Erro no console: "column does not exist"
**Solução:** Aplicar migrações SQL (Passo 2)

### Problema 2: Assinatura salva mas não aparece no PDF
**Sintoma:** Logs mostram que foi salvo, mas PDF não tem assinatura
**Solução:** 
- Verificar se `allSignatures` tem dados (console)
- Verificar se `signaturesForPdf` não está vazio
- Verificar se há erro ao gerar PDF

### Problema 3: Dados de autenticação não aparecem
**Sintoma:** Assinatura aparece mas sem IP/navegador
**Solução:**
- Verificar se as colunas existem (Passo 1)
- Verificar se os dados estão sendo salvos (console)
- Verificar se os dados estão sendo buscados (console)

## 📋 Checklist de Verificação

- [ ] Migrações SQL aplicadas
- [ ] Colunas `user_agent`, `ip_address`, etc. existem em `contract_signatures`
- [ ] Coluna `whatsapp_message_template` existe em `contracts`
- [ ] Console mostra logs de salvamento
- [ ] Console mostra logs de busca de assinaturas
- [ ] Console mostra logs de geração de PDF
- [ ] Dados aparecem na query SQL do banco
- [ ] PDF gerado contém página de assinaturas

## 🚀 Após Aplicar Correções

1. **Limpe o cache do navegador** (Ctrl+Shift+Delete)
2. **Faça logout e login novamente**
3. **Teste assinando um novo contrato**
4. **Verifique o PDF gerado**

## 📞 Se Ainda Não Funcionar

Envie:
1. Screenshot do resultado do `VERIFICAR-MIGRACOES-APLICADAS.sql`
2. Screenshot dos logs do console do navegador
3. Screenshot do resultado da query SQL das assinaturas
4. ID de um contrato que foi assinado mas não mostra assinatura no PDF

