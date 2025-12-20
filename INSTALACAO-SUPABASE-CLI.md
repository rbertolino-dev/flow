# 🔧 Instalação do Supabase CLI

## Opções de Instalação

### Opção 1: Via npm (Requer Node.js)

```bash
# Instalar Node.js primeiro
sudo apt update
sudo apt install nodejs npm

# Instalar Supabase CLI
npm install -g supabase
```

### Opção 2: Via Homebrew (Linux)

```bash
# Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar Supabase CLI
brew install supabase/tap/supabase
```

### Opção 3: Download Binário Direto

```bash
# Baixar binário para Linux
wget https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb

# Instalar
sudo dpkg -i supabase_linux_amd64.deb
```

### Opção 4: Via Docker (Sem instalação local)

```bash
# Usar via Docker
docker run --rm supabase/cli:latest --version
```

---

## Verificar Instalação

```bash
supabase --version
```

---

## Próximo Passo: Login

Após instalar:

```bash
supabase login
```

Isso abrirá o navegador para autenticação.





