# 🔐 Configuração de Variáveis de Ambiente - Facebook/Instagram

## ✅ Credenciais do App (Já Fornecidas)

As seguintes credenciais já estão disponíveis e devem ser configuradas como variáveis de ambiente:

### **Credenciais do App Facebook**

```bash
# ID do Aplicativo Facebook
FACEBOOK_APP_ID=1616642309241531

# Chave Secreta do Aplicativo
FACEBOOK_APP_SECRET=6513bcad61c0e9355d59cc31de243411

# Token de Cliente (opcional, mas recomendado)
FACEBOOK_CLIENT_TOKEN=ef4a74f7a245713f66688e19d2741516

# Token para verificação do Webhook (você precisa criar)
# Gere um UUID aleatório ou string secreta única
FACEBOOK_WEBHOOK_VERIFY_TOKEN=seu_token_secreto_aqui
```

**📝 Exemplo de como gerar um token seguro:**
```bash
# No terminal (Linux/Mac):
uuidgen

# Ou use um gerador online:
# https://www.uuidgenerator.net/
```

---

## 📝 Como Configurar no Lovable Cloud

1. Acesse o projeto no Lovable Cloud
2. Vá em **Settings** → **Environment Variables**
3. Adicione cada variável acima
4. Clique em **Save**

---

## 📝 Como Configurar no Supabase

1. Acesse o projeto no Supabase Dashboard
2. Vá em **Project Settings** → **Edge Functions** → **Secrets**
3. Adicione cada variável acima
4. Clique em **Save**

---

## ⚠️ Importante

- **NUNCA** commite essas credenciais no código
- **NUNCA** exponha essas credenciais no frontend
- Use apenas variáveis de ambiente
- Mantenha o `FACEBOOK_WEBHOOK_VERIFY_TOKEN` secreto e único

---

## 🔗 URLs de Configuração no Facebook Developer

### **Redirect URI OAuth:**
```
https://seu-dominio.com/supabase/functions/v1/facebook-oauth-callback
```

### **Webhook URL:**
```
https://seu-dominio.com/supabase/functions/v1/facebook-webhook
```

### **Webhook Verify Token:**
Use o mesmo valor de `FACEBOOK_WEBHOOK_VERIFY_TOKEN`

---

## ✅ Checklist de Configuração

- [ ] Variáveis de ambiente configuradas
- [ ] Redirect URI configurado no Facebook Developer
- [ ] Webhook URL configurado no Facebook Developer
- [ ] Webhook Verify Token configurado
- [ ] Permissões do app aprovadas (`pages_messaging`, `instagram_manage_messages`)

