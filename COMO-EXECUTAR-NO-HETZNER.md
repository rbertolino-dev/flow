# 🚀 Como Executar Correção no Servidor Hetzner

**Problema**: 404 Not Found em http://agilizeflow.com.br/cadastro  
**Solução**: Adicionar `try_files` no nginx para React SPA

---

## ⚡ Opção 1: Comando Rápido (Uma Linha)

Execute **DIRETAMENTE no servidor Hetzner**:

```bash
CONFIG_FILE=$(ls /etc/nginx/sites-available/agilizeflow* /etc/nginx/sites-available/default 2>/dev/null | head -1) && \
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup-$(date +%Y%m%d-%H%M%S)" && \
if ! grep -q "try_files.*index.html" "$CONFIG_FILE"; then \
  if grep -q "location / {" "$CONFIG_FILE"; then \
    sed -i '/location \/ {/a\        try_files $uri $uri/ /index.html;' "$CONFIG_FILE"; \
  fi; \
fi && \
nginx -t && systemctl reload nginx && echo "✅ Corrigido!"
```

---

## 📄 Opção 2: Usar Script Completo

### Passo 1: Copiar Script para Servidor

```bash
# Do seu computador local:
scp EXECUTAR-NO-HETZNER.sh root@95.217.2.116:/root/
```

### Passo 2: Executar no Servidor

```bash
# Acessar servidor:
ssh root@95.217.2.116

# Executar script:
bash /root/EXECUTAR-NO-HETZNER.sh
```

---

## ✏️ Opção 3: Edição Manual

### Passo 1: Acessar Servidor

```bash
ssh root@95.217.2.116
```

### Passo 2: Editar Configuração

```bash
# Encontrar arquivo de configuração:
ls /etc/nginx/sites-available/

# Editar (escolha o arquivo correto):
nano /etc/nginx/sites-available/agilizeflow.com.br
# OU
nano /etc/nginx/sites-available/default
```

### Passo 3: Adicionar try_files

Dentro do bloco `location / {`, adicionar:

```nginx
location / {
    try_files $uri $uri/ /index.html;  # ← ADICIONAR ESTA LINHA
    # ... resto da configuração
}
```

### Passo 4: Salvar e Recarregar

```bash
# Testar configuração:
nginx -t

# Se OK, recarregar:
systemctl reload nginx
```

---

## ✅ Verificar se Funcionou

Após executar, teste no navegador:

- http://agilizeflow.com.br/cadastro

**Deve carregar a página de cadastro** (não mais 404)

---

## 🔍 Se Ainda Não Funcionar

### Verificar Logs do Nginx:

```bash
tail -f /var/log/nginx/error.log
```

### Verificar se Aplicação Está Rodando:

```bash
# Se usa proxy (porta):
netstat -tlnp | grep :3000
# OU
ss -tlnp | grep :3000

# Se usa arquivos estáticos:
ls -la /var/www/agilizeflow/dist/
# OU verificar caminho no nginx:
grep "root" /etc/nginx/sites-available/agilizeflow.com.br
```

---

**Última atualização**: 15/12/2025 02:15



