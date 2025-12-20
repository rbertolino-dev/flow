# 🔧 Corrigir Políticas Storage - Nomes Exatos

**Problema**: As políticas foram criadas com nomes diferentes dos esperados pelo SQL de verificação.

---

## ⚠️ IMPORTANTE: Deletar TODAS as Políticas Atuais

1. **Acesse**: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/storage/policies
2. **Delete TODAS as políticas** que você vê na lista (9 políticas)
3. **Confirme a exclusão** de cada uma

---

## ✅ Criar as 4 Políticas com Nomes EXATOS

Após deletar todas, crie **EXATAMENTE** estas 4 políticas com os nomes **EXATOS** abaixo:

---

### Política 1: Public read access to workflow media

- **Policy name**: `Public read access to workflow media` (EXATO, copie e cole)
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **USING expression**:
```sql
bucket_id = 'whatsapp-workflow-media'
```
- **WITH CHECK expression**: (deixe vazio)

---

### Política 2: Authenticated users can upload workflow media

- **Policy name**: `Authenticated users can upload workflow media` (EXATO, copie e cole)
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **USING expression**: (deixe vazio)
- **WITH CHECK expression**:
```sql
bucket_id = 'whatsapp-workflow-media'
```

---

### Política 3: Authenticated users can update their workflow media

- **Policy name**: `Authenticated users can update their workflow media` (EXATO, copie e cole)
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**:
```sql
bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
```
- **WITH CHECK expression**:
```sql
bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
```

---

### Política 4: Authenticated users can delete their workflow media

- **Policy name**: `Authenticated users can delete their workflow media` (EXATO, copie e cole)
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **USING expression**:
```sql
bucket_id = 'whatsapp-workflow-media' AND owner = auth.uid()
```
- **WITH CHECK expression**: (deixe vazio)

---

## ✅ Verificar Após Criar

1. Execute novamente o SQL de verificação:
   - Arquivo: `supabase/fixes/verificar_storage_policies.sql`
2. Agora deve mostrar **✅ OK** para todas as 4 políticas

---

## 📋 Checklist Final

Após criar, você deve ter **EXATAMENTE** estas 4 políticas:

- [ ] `Public read access to workflow media` (SELECT, public)
- [ ] `Authenticated users can upload workflow media` (INSERT, authenticated)
- [ ] `Authenticated users can update their workflow media` (UPDATE, authenticated)
- [ ] `Authenticated users can delete their workflow media` (DELETE, authenticated)

**NENHUMA outra política deve existir!**

---

## ⚠️ Problemas Encontrados nas Políticas Atuais

1. ❌ Nomes diferentes dos esperados (ex: "tuder5_0", "tuder5_1")
2. ❌ Políticas duplicadas
3. ❌ Comandos errados (ex: "Delete" com SELECT ao invés de DELETE)
4. ❌ Políticas antigas ainda presentes

**Solução**: Deletar tudo e criar apenas as 4 políticas acima com nomes EXATOS.


