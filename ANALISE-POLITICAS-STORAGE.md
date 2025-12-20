# 🔍 Análise das Políticas de Storage

**Antes de deletar qualquer coisa, vamos analisar o que é necessário!**

---

## 📋 Execute Primeiro: Análise Completa

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new
2. **Execute o SQL**: `supabase/fixes/analisar_politicas_storage.sql`
3. **Veja os resultados** - ele vai mostrar:
   - Todas as políticas existentes
   - Quais são necessárias
   - Quais são duplicadas
   - Quais têm comandos errados

---

## ✅ Políticas NECESSÁRIAS (Manter)

### Políticas Principais (4):
1. ✅ `Public read access to workflow media` (SELECT, public)
   - **Para**: Leitura pública de arquivos (Evolution API, etc.)

2. ✅ `Authenticated users can upload workflow media` (INSERT, authenticated)
   - **Para**: Upload de arquivos gerais

3. ✅ `Authenticated users can update their workflow media` (UPDATE, authenticated)
   - **Para**: Atualizar arquivos próprios

4. ✅ `Authenticated users can delete their workflow media` (DELETE, authenticated)
   - **Para**: Deletar arquivos próprios

### Políticas para Contratos (2):
5. ✅ `Allow PDF uploads for contracts` (INSERT, authenticated)
   - **Para**: Upload de PDFs de contratos na pasta `contracts/`
   - **Condição**: `name LIKE '%/contracts/%'`

6. ✅ `Allow public read access to contract PDFs` (SELECT, public)
   - **Para**: Leitura pública de PDFs de contratos
   - **Condição**: `name LIKE '%/contracts/%'`

**Total necessário**: 6 políticas

---

## ❌ Políticas que DEVEM SER DELETADAS

### Políticas com nomes estranhos (tuder5):
- ❌ `Authenticated users can update their workflow medi tuder5_0`
- ❌ `Authenticated users can update their workflow medi tuder5_1`
- ❌ `Authenticated users can upload workflow media tuder5_0`
- ❌ `Delete Autenticado tuder5_0`
- ❌ `Delete Autenticado tuder5_1`
- ❌ `Public read access to workflow media tuder5_0`

**Motivo**: Nomes estranhos, provavelmente criadas por erro ou duplicadas

### Políticas com comandos ERRADOS:
- ❌ `Authenticated users can update their workflow medi tuder5_1` (tem SELECT, deveria ser UPDATE)
- ❌ `Delete Autenticado tuder5_1` (tem SELECT, deveria ser DELETE)

**Motivo**: Comandos errados - não funcionam corretamente

### Políticas antigas/duplicadas (se existirem):
- ❌ `Allow update contract PDFs` (se já tiver a política principal de UPDATE)
- ❌ Qualquer outra com nome diferente das 6 necessárias acima

---

## 📋 Plano de Ação

### Passo 1: Analisar
Execute o SQL de análise primeiro para ver exatamente o que você tem.

### Passo 2: Deletar apenas as problemáticas
Delete APENAS as políticas com:
- Nome contendo "tuder5"
- Comandos errados (ex: "Delete" com SELECT)
- Duplicadas que não são as 6 necessárias

### Passo 3: Criar as que faltam
Se faltar alguma das 6 necessárias, crie com os nomes EXATOS.

### Passo 4: Verificar
Execute o SQL de verificação novamente para confirmar.

---

## ⚠️ IMPORTANTE

**NÃO delete as políticas de contratos** (`Allow PDF uploads for contracts` e `Allow public read access to contract PDFs`) - elas são necessárias para o sistema de contratos funcionar!

**NÃO delete políticas que você não reconhece** sem antes verificar no código se são usadas.

---

## 🎯 Resultado Esperado

Após limpar, você deve ter **EXATAMENTE** estas 6 políticas:

1. ✅ `Public read access to workflow media` (SELECT, public)
2. ✅ `Authenticated users can upload workflow media` (INSERT, authenticated)
3. ✅ `Authenticated users can update their workflow media` (UPDATE, authenticated)
4. ✅ `Authenticated users can delete their workflow media` (DELETE, authenticated)
5. ✅ `Allow PDF uploads for contracts` (INSERT, authenticated) - para pasta contracts/
6. ✅ `Allow public read access to contract PDFs` (SELECT, public) - para pasta contracts/

**Total**: 6 políticas (4 principais + 2 para contratos)


