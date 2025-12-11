# Solução de Proxy para Incorporar Chatwoot via Iframe

## 🎯 Problema

O Chatwoot auto-hospedado bloqueia incorporação via iframe usando o header `X-Frame-Options`, impedindo que seja exibido em outros domínios.

## ✅ Solução: Proxy Server-Side

Criamos uma **Edge Function do Supabase** que faz proxy do Chatwoot, removendo os headers de segurança que bloqueiam o iframe.

### Como Funciona

1. **Edge Function (`chatwoot-proxy`)**: 
   - Recebe requisições do frontend
   - Faz fetch do Chatwoot server-side
   - Remove/modifica headers `X-Frame-Options` e `Content-Security-Policy`
   - Modifica URLs no HTML para apontar de volta ao proxy
   - Retorna o conteúdo modificado

2. **Frontend (`AgilizeEmbed.tsx`)**:
   - Usa o iframe apontando para a Edge Function ao invés do Chatwoot diretamente
   - A Edge Function faz o proxy transparente

### Vantagens

✅ **Não requer configuração no servidor Chatwoot**  
✅ **Funciona mesmo com X-Frame-Options bloqueado**  
✅ **Mantém autenticação e segurança**  
✅ **Transparente para o usuário**

### Desvantagens

⚠️ **Pode ter impacto de performance** (todos os recursos passam pelo proxy)  
⚠️ **Requer autenticação no Supabase**  
⚠️ **Pode não funcionar perfeitamente com JavaScript complexo**

## 📋 Como Usar

### 1. Deploy da Edge Function

A Edge Function já está criada em:
```
agilize/supabase/functions/chatwoot-proxy/index.ts
```

Para fazer deploy:
```bash
cd agilize
supabase functions deploy chatwoot-proxy
```

### 2. Configuração no Frontend

O componente `AgilizeEmbed.tsx` já está configurado para usar o proxy automaticamente.

**Modo Proxy (Padrão):**
- Usa a Edge Function como proxy
- Remove headers de segurança
- Funciona mesmo com X-Frame-Options

**Modo Direto:**
- Tenta acessar Chatwoot diretamente
- Pode falhar se X-Frame-Options estiver ativo
- Botão para alternar entre modos

### 3. Verificação

1. Acesse a página `/agilize` no sistema
2. O iframe deve carregar o Chatwoot via proxy
3. Verifique o console do navegador para logs:
   - `✅ URL do proxy construída`
   - `✅ Iframe carregado via PROXY`

## 🔧 Troubleshooting

### Proxy não carrega

1. **Verificar autenticação:**
   - Usuário deve estar autenticado
   - Token de sessão deve ser válido

2. **Verificar configuração Chatwoot:**
   - `chatwoot_configs` deve estar configurado
   - `enabled` deve ser `true`
   - `chatwoot_base_url` deve estar correto

3. **Verificar logs da Edge Function:**
   ```bash
   supabase functions logs chatwoot-proxy
   ```

### Recursos não carregam (CSS, JS, imagens)

A Edge Function tenta modificar URLs no HTML, mas alguns recursos podem não funcionar perfeitamente. Nesse caso:

1. **Opção 1:** Configurar o Chatwoot para permitir iframe (veja `CHATWOOT_REMOVE_XFRAME_OPTIONS.md`)
2. **Opção 2:** Usar modo "Nova Aba" ou "Popup" como fallback

### Performance lenta

O proxy adiciona latência porque todos os recursos passam pelo Supabase. Para melhorar:

1. Configure o Chatwoot diretamente (melhor performance)
2. Use cache na Edge Function (futuro)
3. Considere usar CDN para recursos estáticos

## 🔐 Segurança

- ✅ Requer autenticação no Supabase
- ✅ Valida organização do usuário
- ✅ Usa Service Role Key apenas server-side
- ⚠️ Permite iframe de qualquer origem (apenas no proxy)
- ⚠️ Não expõe credenciais do Chatwoot

## 📝 Notas Técnicas

### Headers Modificados

A Edge Function:
- **Remove:** `X-Frame-Options`
- **Remove:** `Content-Security-Policy` (frame-ancestors)
- **Adiciona:** `X-Frame-Options: ""` (vazio)
- **Adiciona:** `Content-Security-Policy: frame-ancestors *`

### URLs Modificadas

No HTML, todas as URLs são modificadas para apontar de volta ao proxy:
- `/path` → `/functions/v1/chatwoot-proxy?path=/path`
- `https://chatwoot.com/path` → `/functions/v1/chatwoot-proxy?path=/path`

### Limitações

- JavaScript complexo pode não funcionar perfeitamente
- WebSockets podem não funcionar através do proxy
- Alguns recursos podem precisar de configuração adicional

## 🚀 Próximos Passos

1. **Cache:** Implementar cache para recursos estáticos
2. **WebSockets:** Suporte para WebSockets através do proxy
3. **Otimização:** Melhorar substituição de URLs no HTML
4. **Monitoramento:** Adicionar métricas de performance


