# Como Remover X-Frame-Options no Chatwoot Auto-Hospedado

Este guia explica como permitir que o Chatwoot seja incorporado via iframe removendo ou configurando o header `X-Frame-Options`.

## Opção 1: Configurar via Nginx (Recomendado)

Se você está usando Nginx como proxy reverso, adicione estas configurações:

### Arquivo de Configuração do Nginx

Edite o arquivo de configuração do Nginx (geralmente em `/etc/nginx/sites-available/chatwoot` ou similar):

```nginx
server {
    listen 80;
    server_name chat.atendimentoagilize.com;

    # Remover X-Frame-Options e configurar Content-Security-Policy
    add_header X-Frame-Options "" always;
    add_header Content-Security-Policy "frame-ancestors 'self' https://seu-dominio.com https://*.seu-dominio.com" always;
    
    # Ou para permitir de qualquer domínio (menos seguro):
    # add_header X-Frame-Options "" always;
    # add_header Content-Security-Policy "frame-ancestors *" always;

    location / {
        proxy_pass http://localhost:3000;  # Ajuste a porta se necessário
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Substitua:**
- `https://seu-dominio.com` pelo domínio onde você quer incorporar o Chatwoot
- `localhost:3000` pela porta onde o Chatwoot está rodando

**Depois de editar:**
```bash
sudo nginx -t  # Testar configuração
sudo systemctl reload nginx  # Recarregar Nginx
```

## Opção 2: Configurar no Chatwoot (application.rb)

Se você tem acesso ao código do Chatwoot, edite o arquivo `config/application.rb`:

```ruby
# Adicione ou modifique esta seção:
config.action_dispatch.default_headers = {
  'X-Frame-Options' => '',  # Remove o header
  'Content-Security-Policy' => "frame-ancestors 'self' https://seu-dominio.com"
}
```

**Ou para permitir de qualquer domínio (menos seguro):**
```ruby
config.action_dispatch.default_headers = {
  'X-Frame-Options' => '',
  'Content-Security-Policy' => "frame-ancestors *"
}
```

**Depois de editar:**
```bash
# Reiniciar o Chatwoot
sudo systemctl restart chatwoot
# Ou se estiver usando Docker:
docker-compose restart
```

## Opção 3: Variáveis de Ambiente (Docker)

Se você está usando Docker, adicione estas variáveis no `docker-compose.yml`:

```yaml
services:
  rails:
    environment:
      - FRAME_ANCESTORS=https://seu-dominio.com,https://*.seu-dominio.com
      # Ou para permitir qualquer domínio:
      # - FRAME_ANCESTORS=*
```

E configure o Nginx para usar essas variáveis ou remova o header diretamente no Nginx.

## Opção 4: Script de Configuração Automática

Crie um script para configurar automaticamente:

```bash
#!/bin/bash
# configure-chatwoot-iframe.sh

DOMAIN="https://seu-dominio.com"  # Substitua pelo seu domínio

# Configurar Nginx
sudo sed -i "s/add_header X-Frame-Options.*/add_header X-Frame-Options \"\" always;/" /etc/nginx/sites-available/chatwoot
sudo sed -i "s/add_header Content-Security-Policy.*/add_header Content-Security-Policy \"frame-ancestors 'self' $DOMAIN\" always;/" /etc/nginx/sites-available/chatwoot

# Testar e recarregar
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Configuração aplicada! O Chatwoot agora pode ser incorporado via iframe."
```

## Verificação

Para verificar se funcionou:

1. **Verificar headers HTTP:**
```bash
curl -I https://chat.atendimentoagilize.com/ | grep -i "x-frame-options\|content-security-policy"
```

2. **Testar no navegador:**
   - Abra o DevTools (F12)
   - Vá para a aba Network
   - Recarregue a página
   - Clique em uma requisição
   - Veja os Headers de resposta
   - Verifique se `X-Frame-Options` não está presente ou está vazio
   - Verifique se `Content-Security-Policy` tem `frame-ancestors` configurado

## Segurança

⚠️ **Importante:**
- Permitir iframe de qualquer domínio (`*`) é menos seguro
- Recomenda-se permitir apenas domínios específicos e confiáveis
- Use HTTPS em ambos os domínios (Chatwoot e o site que incorpora)

## Troubleshooting

Se ainda não funcionar:

1. **Limpar cache do navegador**
2. **Verificar se há múltiplas configurações conflitantes** (Nginx + Chatwoot)
3. **Verificar logs do Nginx:** `sudo tail -f /var/log/nginx/error.log`
4. **Verificar logs do Chatwoot:** `docker-compose logs rails` (se usar Docker)

