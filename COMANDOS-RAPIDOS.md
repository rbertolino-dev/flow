# 🚀 Comandos Rápidos - Sistema de Versionamento

## 📊 Ver Versões (Mais Fácil)

### Comando Mais Simples
```bash
./scripts/v
```

### Comando Completo
```bash
./scripts/show-versions.sh
```

**O que mostra:**
- ✅ Versão atual
- ✅ Histórico completo de versões
- ✅ Mudanças de cada versão
- ✅ Estatísticas
- ✅ Comandos úteis

---

## 🚀 Deploy

### Deploy Rápido (Mais Simples)
```bash
./scripts/quick-deploy.sh "Descrição das mudanças"
```

### Deploy Completo
```bash
./scripts/deploy-with-version.sh --auto-changes
```

---

## 📋 Outros Comandos Úteis

### Ver Versão Atual
```bash
./scripts/version-manager.sh current
```

### Listar Todas as Versões
```bash
./scripts/version-manager.sh list
```

### Ver Detalhes de uma Versão
```bash
./scripts/version-manager.sh show 1.2.3
```

### Ver Últimas Mudanças
```bash
./scripts/version-manager.sh changes 10
```

### Fazer Rollback
```bash
./scripts/deploy-with-version.sh --rollback
```

---

## 📊 Dashboard Visual (HTML)

### Criar Dashboard HTML
```bash
./scripts/create-dashboard.sh
```

**Depois abra no navegador:**
- Arquivo: `dashboard-versions.html`
- Ou via servidor: `python3 -m http.server 8080`

---

## 🎯 Resumo dos Comandos Mais Usados

| Ação | Comando |
|------|---------|
| **Ver versões** | `./scripts/v` |
| **Deploy rápido** | `./scripts/quick-deploy.sh "mudanças"` |
| **Deploy completo** | `./scripts/deploy-with-version.sh --auto-changes` |
| **Rollback** | `./scripts/deploy-with-version.sh --rollback` |
| **Dashboard HTML** | `./scripts/create-dashboard.sh` |

---

## 💡 Dica: Criar Alias (Opcional)

Para usar comandos ainda mais curtos, adicione ao seu `~/.bashrc`:

```bash
# Versionamento
alias v='./scripts/v'
alias deploy='./scripts/quick-deploy.sh'
alias versions='./scripts/show-versions.sh'
```

Depois execute: `source ~/.bashrc`

Agora você pode usar:
- `v` - Ver versões
- `deploy "mudanças"` - Deploy rápido
- `versions` - Ver versões completo

---

**Pronto! Agora você tem acesso rápido a tudo!** 🎉
