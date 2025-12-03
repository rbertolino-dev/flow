# Como Fazer Deploy da Edge Function chatwoot-proxy

## 🚀 Deploy Rápido

### Pré-requisitos

1. **Supabase CLI instalado:**
   ```bash
   npm install -g supabase
   ```

2. **Autenticado no Supabase:**
   ```bash
   supabase login
   ```

3. **Link do projeto:**
   ```bash
   supabase link --project-ref seu-project-ref
   ```

### Deploy da Função

```bash
cd agilize
supabase functions deploy chatwoot-proxy
```

### Verificar Deploy

Após o deploy, você pode verificar os logs:

```bash
supabase functions logs chatwoot-proxy
```

## 🔍 Troubleshooting

### Erro 404: Function not found

**Causa:** A função não foi deployada ou o nome está incorreto.

**Solução:**
1. Verificar se a função existe em `supabase/functions/chatwoot-proxy/`
2. Fazer deploy novamente:
   ```bash
   supabase functions deploy chatwoot-proxy
   ```

### Erro 401: Não autenticado

**Causa:** Token inválido ou expirado.

**Solução:**
1. Verificar se o usuário está autenticado no frontend
2. Verificar se o token está sendo passado corretamente na URL
3. Verificar logs da função para mais detalhes:
   ```bash
   supabase functions logs chatwoot-proxy --tail
   ```

### Erro 404: Configuração do Chatwoot não encontrada

**Causa:** A configuração do Chatwoot não está cadastrada no banco.

**Solução:**
1. Acessar a página de configurações do Chatwoot
2. Preencher todos os campos obrigatórios:
   - URL base do Chatwoot
   - Account ID
   - API Access Token
3. Habilitar a configuração (`enabled = true`)

## 📝 Verificação

Após o deploy, teste acessando:

```
https://seu-project.supabase.co/functions/v1/chatwoot-proxy?path=/&token=SEU_TOKEN
```

Substitua:
- `seu-project` pelo seu project ref do Supabase
- `SEU_TOKEN` por um token de autenticação válido

## 🔐 Segurança

⚠️ **Importante:**
- O token é passado como query parameter para funcionar com iframe
- Isso é menos seguro que usar headers, mas necessário para iframes
- Considere implementar tokens temporários ou renovação automática

## 📊 Monitoramento

Para monitorar o uso da função:

```bash
# Ver logs em tempo real
supabase functions logs chatwoot-proxy --tail

# Ver métricas
supabase functions list
```

