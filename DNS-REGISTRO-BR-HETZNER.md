# 🌐 Configurar DNS no Registro.br para Servidor Hetzner

**Situação:**
- ✅ Domínio registrado no **registro.br**
- ✅ Sistema rodando em servidor **Hetzner** (Supabase self-hosted)
- ❌ **NÃO** está usando Supabase Cloud nem Lovable

---

## 📋 O Que Configurar no Registro.br

Para apontar seu domínio para o servidor Hetzner, você precisa configurar um **registro A** com o **IP público** do seu servidor.

---

## 🔧 Configuração de DNS

### Passo 1: Obter o IP Público do Servidor Hetzner

No servidor Hetzner, execute:

```bash
# Ver IP público
curl -s ifconfig.me
# OU
curl -s ipinfo.io/ip
# OU
hostname -I | awk '{print $1}'
```

**Anote este IP** - você vai precisar dele!

---

### Passo 2: Configurar no Registro.br

#### Opção 1: Subdomínio (Recomendado)

Exemplo: `app.seudominio.com.br` ou `api.seudominio.com.br`

**No registro.br:**
```
Tipo: A
Nome: app (ou o subdomínio desejado)
Valor: [IP_PUBLICO_DO_HETZNER]
TTL: 3600 (ou padrão)
```

**Exemplo:**
```
Tipo: A
Nome: app
Valor: 123.45.67.89
TTL: 3600
```

---

#### Opção 2: Domínio Raiz

Exemplo: `seudominio.com.br` (sem subdomínio)

**No registro.br:**
```
Tipo: A
Nome: @ (ou deixar em branco)
Valor: [IP_PUBLICO_DO_HETZNER]
TTL: 3600
```

**Exemplo:**
```
Tipo: A
Nome: @
Valor: 123.45.67.89
TTL: 3600
```

---

## 🚀 Passo a Passo no Registro.br

### 1. Acessar o Registro.br

1. Acesse: https://registro.br
2. Faça login na sua conta
3. Vá em **Meus Domínios**
4. Selecione o domínio que deseja configurar

### 2. Configurar DNS

1. Clique em **DNS** ou **Zona DNS**
2. Clique em **Adicionar Registro** ou **Novo Registro**
3. Preencha:
   - **Tipo**: `A`
   - **Nome**: `app` (ou subdomínio desejado) OU `@` (para domínio raiz)
   - **Valor**: `[IP_PUBLICO_DO_HETZNER]` (ex: `123.45.67.89`)
   - **TTL**: `3600` (ou padrão)
4. Salve

---

## ⚙️ Configurar no Servidor Hetzner

Após configurar o DNS, você precisa configurar o servidor para aceitar requisições no domínio:

### 1. Verificar Nginx/Apache

Se você usa Nginx (recomendado):

```bash
# Verificar se Nginx está instalado
sudo systemctl status nginx

# Se não estiver, instalar:
sudo apt update
sudo apt install -y nginx
```

### 2. Configurar Nginx

Edite o arquivo de configuração:

```bash
sudo nano /etc/nginx/sites-available/default
# OU criar novo:
sudo nano /etc/nginx/sites-available/seudominio
```

**Configuração básica:**

```nginx
server {
    listen 80;
    server_name app.seudominio.com.br;  # OU seudominio.com.br

    # Se usar Supabase self-hosted na porta 8000
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Habilitar Site

```bash
# Se criou novo arquivo:
sudo ln -s /etc/nginx/sites-available/seudominio /etc/nginx/sites-enabled/

# Testar configuração:
sudo nginx -t

# Recarregar Nginx:
sudo systemctl reload nginx
```

### 4. Configurar SSL (HTTPS)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d app.seudominio.com.br
# OU para domínio raiz:
sudo certbot --nginx -d seudominio.com.br
```

---

## 🔍 Verificar Configuração DNS

Após configurar, aguarde a propagação DNS (1-2 horas) e verifique:

### Via Terminal:

```bash
# Verificar se DNS está apontando corretamente
dig app.seudominio.com.br A

# Verificar se está resolvendo para o IP correto
nslookup app.seudominio.com.br
```

### Online:

- https://dnschecker.org
- https://www.whatsmydns.net

---

## 📝 Exemplos Completos

### Exemplo 1: Subdomínio `app`

**Domínio:** `meusite.com.br`  
**Subdomínio desejado:** `app.meusite.com.br`  
**IP Hetzner:** `123.45.67.89`

**No registro.br:**
```
Tipo: A
Nome: app
Valor: 123.45.67.89
TTL: 3600
```

**No servidor Hetzner (Nginx):**
```nginx
server {
    listen 80;
    server_name app.meusite.com.br;
    
    location / {
        proxy_pass http://localhost:8000;
        # ... (resto da config)
    }
}
```

---

### Exemplo 2: Domínio Raiz

**Domínio:** `meusite.com.br`  
**IP Hetzner:** `123.45.67.89`

**No registro.br:**
```
Tipo: A
Nome: @
Valor: 123.45.67.89
TTL: 3600
```

**No servidor Hetzner (Nginx):**
```nginx
server {
    listen 80;
    server_name meusite.com.br;
    
    location / {
        proxy_pass http://localhost:8000;
        # ... (resto da config)
    }
}
```

---

## ⚠️ Observações Importantes

### 1. Firewall

Certifique-se de que o firewall permite conexões:

```bash
# Se usar UFW:
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Se usar iptables:
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

### 2. Porta do Supabase

- Supabase self-hosted geralmente roda na porta **8000**
- Nginx faz proxy da porta 80/443 para 8000
- Verifique qual porta seu Supabase está usando

### 3. Propagação DNS

- DNS pode levar de **1 hora a 48 horas** para propagar
- Geralmente leva **1-2 horas** no Brasil
- Use ferramentas de verificação para acompanhar

---

## 🔐 Configuração de SSL (HTTPS)

Após configurar DNS e Nginx:

1. **Instalar Certbot:**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. **Obter certificado:**
   ```bash
   sudo certbot --nginx -d app.seudominio.com.br
   ```

3. **Renovação automática:**
   ```bash
   # Certbot já configura renovação automática
   # Verificar:
   sudo certbot renew --dry-run
   ```

---

## 📊 Verificar se Está Funcionando

Após configurar tudo:

1. **Verificar DNS:**
   ```bash
   dig app.seudominio.com.br A
   ```

2. **Testar HTTP:**
   ```bash
   curl http://app.seudominio.com.br
   ```

3. **Testar HTTPS:**
   ```bash
   curl https://app.seudominio.com.br
   ```

4. **Acessar no navegador:**
   - http://app.seudominio.com.br
   - https://app.seudominio.com.br

---

## 🆘 Troubleshooting

### Problema: DNS não está propagando

**Solução:**
- Aguarde até 48 horas
- Verifique se o registro está correto no registro.br
- Limpe cache DNS local

### Problema: "Connection refused"

**Solução:**
- Verifique se o servidor está rodando
- Verifique firewall (portas 80 e 443)
- Verifique se Nginx está configurado corretamente

### Problema: "502 Bad Gateway"

**Solução:**
- Verifique se Supabase está rodando na porta correta
- Verifique configuração do proxy no Nginx
- Verifique logs: `sudo tail -f /var/log/nginx/error.log`

---

## 📞 Próximos Passos

Após configurar DNS e domínio:

1. ✅ Atualizar variáveis de ambiente no Supabase com o novo domínio
2. ✅ Configurar webhooks externos para usar o novo domínio
3. ✅ Testar todas as funcionalidades

---

**Última atualização**: 15/12/2025 02:00



