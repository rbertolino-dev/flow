# 🔧 Corrigir Erro 404 no Nginx - Página de Cadastro

**Problema**: `404 Not Found` ao acessar http://agilizeflow.com.br/cadastro

**Causa**: Nginx não está configurado corretamente para aplicação React (SPA)

---

## 🔍 Problema Identificado

O nginx está retornando 404 porque:
1. A aplicação React é uma **SPA (Single Page Application)**
2. Todas as rotas (`/cadastro`, `/login`, etc.) precisam ser redirecionadas para `index.html`
3. O nginx precisa de configuração especial para SPAs

---

## ✅ Solução: Configurar Nginx para SPA

### Passo 1: Acessar Servidor Hetzner

```bash
ssh root@[IP_HETZNER]
# OU
ssh usuario@[IP_HETZNER]
```

### Passo 2: Editar Configuração do Nginx

```bash
# Editar configuração do site
sudo nano /etc/nginx/sites-available/agilizeflow
# OU
sudo nano /etc/nginx/sites-available/default
```

### Passo 3: Configuração Correta para React SPA

**Substitua a configuração atual por:**

```nginx
server {
    listen 80;
    server_name agilizeflow.com.br;

    # Diretório onde está a aplicação React buildada
    root /var/www/agilizeflow/dist;
    # OU se usar outra pasta:
    # root /opt/agilizeflow/dist;
    # OU se aplicação roda em porta (ex: 3000):
    # proxy_pass http://localhost:3000;

    index index.html;

    # Configuração para SPA - redirecionar todas as rotas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Se aplicação roda em porta (ex: 3000), use proxy:
    # location / {
    #     proxy_pass http://localhost:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection "upgrade";
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    # }

    # Arquivos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Passo 4: Testar Configuração

```bash
# Testar se configuração está correta
sudo nginx -t
```

**Se aparecer "syntax is ok" e "test is successful"**, está correto!

### Passo 5: Recarregar Nginx

```bash
# Recarregar nginx
sudo systemctl reload nginx
# OU
sudo service nginx reload
```

---

## 🔍 Verificar Onde Está a Aplicação

### Opção 1: Aplicação Buildada (Static Files)

Se a aplicação foi buildada e os arquivos estão em uma pasta:

```bash
# Verificar onde está
ls -la /var/www/agilizeflow/
ls -la /opt/agilizeflow/
ls -la /home/usuario/agilizeflow/dist/

# Verificar se index.html existe
find / -name "index.html" -path "*/agilizeflow/*" 2>/dev/null
```

**Configuração nginx:**
```nginx
root /caminho/para/dist;
index index.html;
location / {
    try_files $uri $uri/ /index.html;
}
```

---

### Opção 2: Aplicação Rodando em Porta (ex: 3000)

Se a aplicação está rodando como servidor (ex: Vite dev server na porta 3000):

```bash
# Verificar se está rodando
ps aux | grep -E "node|vite|npm"
netstat -tlnp | grep :3000
# OU
ss -tlnp | grep :3000
```

**Configuração nginx:**
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 📋 Checklist de Verificação

- [ ] Aplicação está rodando? (`ps aux | grep node`)
- [ ] Onde está a aplicação? (pasta dist ou porta?)
- [ ] Nginx configurado para SPA? (`try_files $uri $uri/ /index.html`)
- [ ] Nginx testado? (`sudo nginx -t`)
- [ ] Nginx recarregado? (`sudo systemctl reload nginx`)

---

## 🚀 Script Rápido de Correção

Crie um script para corrigir automaticamente:

```bash
#!/bin/bash
# Corrigir nginx para SPA

CONFIG_FILE="/etc/nginx/sites-available/agilizeflow"
# OU
# CONFIG_FILE="/etc/nginx/sites-available/default"

# Backup
sudo cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

# Adicionar try_files se não existir
if ! grep -q "try_files.*index.html" "$CONFIG_FILE"; then
    sudo sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"
fi

# Testar
sudo nginx -t && sudo systemctl reload nginx
```

---

## ⚠️ Importante

1. **Se aplicação está buildada**: Use `try_files $uri $uri/ /index.html;`
2. **Se aplicação roda em porta**: Use `proxy_pass` para a porta
3. **Sempre teste**: `sudo nginx -t` antes de recarregar
4. **Backup**: Sempre faça backup antes de editar

---

**Me informe:**
- A aplicação está buildada (pasta dist) ou rodando em porta?
- Qual é o caminho/pasta onde está a aplicação?
- Qual porta a aplicação está usando (se for servidor)?



