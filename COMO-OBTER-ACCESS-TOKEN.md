# 🔐 Como Obter o Access Token Correto

**Problema**: O token fornecido é uma **publishable key** (para frontend), mas o CLI precisa de um **access token** (para autenticação).

---

## 🎯 Diferença Entre os Tokens

| Tipo | Formato | Uso |
|------|---------|-----|
| **Publishable Key** | `sb_publishable_...` | Frontend (já fornecido ✅) |
| **Access Token** | `sbp_0102...1920` | CLI (precisa obter) |

---

## 🔑 Como Obter o Access Token

### Opção 1: Via Dashboard (Recomendado)

1. **Acesse**: https://supabase.com/dashboard/account/tokens
2. **Clique** em **"Generate new token"**
3. **Nome**: "Migração Automática" (ou qualquer nome)
4. **Clique** em **"Generate token"**
5. **⚠️ COPIE O TOKEN** (começa com `sbp_`)

### Opção 2: Via CLI (Se já estiver autenticado)

```bash
# Se já fez login antes
cat ~/.supabase/access-token
```

---

## 🚀 Após Obter o Token Correto

Execute a migração:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_0102...1920"  # Seu token aqui
./scripts/migracao-automatica.sh
```

---

## 📝 Token Fornecido (Publishable Key)

O token que você forneceu (`sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm`) será usado no **frontend**, não no CLI.

**Use no frontend:**
```bash
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_7vsOSU_x3SOWheInFDj6yA_o6LG8Jdm
```

---

**Precisa do access token para continuar a migração automática!** 🔑
