# 🔑 Como Obter a Anon Key para Atualizar o .env

**Status**: ⏳ **Aguardando Anon Key do Dashboard**

---

## 📋 O Que Já Foi Feito

✅ **Arquivo `.env` atualizado com:**
- `VITE_SUPABASE_URL=https://ogeljmbhqxpfjbpnbwog.supabase.co` ✅
- `VITE_SUPABASE_PROJECT_ID=ogeljmbhqxpfjbpnbwog` ✅
- `VITE_SUPABASE_PUBLISHABLE_KEY=[ANON_KEY_AQUI]` ⏳ (precisa substituir)

---

## 🔑 Como Obter a Anon Key

### Opção 1: Via Dashboard (Recomendado)

1. **Acesse o Dashboard:**
   - URL: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/settings/api

2. **Copie a Anon Key:**
   - Role: `anon` ou `public`
   - Clique no ícone de copiar ao lado da chave
   - A chave começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **Atualize o .env:**
   ```bash
   # Substituir [ANON_KEY_AQUI] pela chave copiada
   sed -i 's|VITE_SUPABASE_PUBLISHABLE_KEY=\[ANON_KEY_AQUI\]|VITE_SUPABASE_PUBLISHABLE_KEY="SUA_CHAVE_AQUI"|' .env
   ```

---

### Opção 2: Via CLI (Se Tiver Acesso)

```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"

# Tentar obter via API
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/ogeljmbhqxpfjbpnbwog/api-keys" \
  | jq -r '.api_keys[] | select(.name == "anon") | .api_key'
```

---

## ✅ Após Obter a Anon Key

1. **Atualizar o .env:**
   ```bash
   # Editar manualmente ou usar sed
   nano .env
   # Ou
   sed -i 's|\[ANON_KEY_AQUI\]|SUA_CHAVE_AQUI|' .env
   ```

2. **Verificar:**
   ```bash
   grep VITE_SUPABASE .env
   ```

3. **Se usar Lovable Cloud:**
   - Settings → Environment Variables
   - Atualizar `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## 📝 Arquivo .env Atual

O arquivo `.env` já está atualizado com:
- ✅ URL do novo projeto
- ✅ Project ID
- ⏳ Falta apenas a Anon Key

**Localização**: `/root/kanban-buzz-95241/.env`

---

**Última atualização**: 15/12/2025 01:20



