# 👀 Como Ver Versões - Guia Rápido

## ⚡ Comando Mais Simples

```bash
./scripts/v
```

**Execute esse comando e veja tudo!** 🎉

---

## 📊 O Que Foi Criado

### 1. **Comando Visual no Terminal** ⭐ (Mais Fácil)
```bash
./scripts/v
```
Mostra versões de forma bonita e organizada no terminal.

### 2. **Dashboard HTML** (Mais Bonito)
```bash
./scripts/create-dashboard.sh
```
Cria uma página HTML visual que você pode abrir no navegador!

### 3. **Comandos Completos**
```bash
./scripts/show-versions.sh      # Visualização completa
./scripts/version-manager.sh list    # Lista simples
```

---

## 🎯 Fluxo Completo

### Ver Versões Agora
```bash
# Opção 1: Comando mais simples
./scripts/v

# Opção 2: Dashboard HTML (mais bonito)
./scripts/create-dashboard.sh
# Depois abra: dashboard-versions.html no navegador
```

### Fazer Deploy
```bash
# Deploy rápido
./scripts/quick-deploy.sh "Correção de bug"

# Deploy completo
./scripts/deploy-with-version.sh --auto-changes
```

### Fazer Rollback
```bash
./scripts/deploy-with-version.sh --rollback
```

---

## 📋 Exemplo de Saída do `./scripts/v`

```
╔════════════════════════════════════════════════════════════════╗
║           📦 SISTEMA DE VERSIONAMENTO - DASHBOARD           ║
╚════════════════════════════════════════════════════════════════╝

📊 Informações Gerais
────────────────────────────────────────────────────────────────
Versão Atual: 1.2.5
Total de Versões: 10
Última Atualização: 2024-01-15T10:30:00Z

📋 Histórico de Versões
────────────────────────────────────────────────────────────────
▶ 1.2.5 [ATUAL]
  📅 15/01/2024 10:30
  🔀 main (abc123)
  📝 Correção de bug crítico no login

  1.2.4
  📅 14/01/2024 09:20
  🔀 main (def456)
  📝 Adicionada nova funcionalidade

📈 Estatísticas
────────────────────────────────────────────────────────────────
Versões Major: 1
Versões Minor: 2
Total de Patches: 10

🔧 Comandos Úteis
────────────────────────────────────────────────────────────────
Ver detalhes de uma versão:
  ./scripts/version-manager.sh show 1.2.5

Fazer novo deploy:
  ./scripts/deploy-with-version.sh --auto-changes

Fazer rollback:
  ./scripts/deploy-with-version.sh --rollback
```

---

## 🎨 Dashboard HTML

O dashboard HTML é ainda mais bonito:

1. Execute: `./scripts/create-dashboard.sh`
2. Abra o arquivo `dashboard-versions.html` no navegador
3. Veja versões com cores, cards e layout profissional!

---

## ✅ Tudo Pronto!

Agora você tem **3 formas fáceis** de ver versões:

1. ✅ **Terminal visual**: `./scripts/v` (mais rápido)
2. ✅ **Dashboard HTML**: `./scripts/create-dashboard.sh` (mais bonito)
3. ✅ **Comandos completos**: `./scripts/version-manager.sh list` (mais detalhado)

**Escolha a que preferir!** 🚀

---

## 📚 Documentação Completa

- `VERSIONAMENTO-AUTOMATICO.md` - Documentação completa
- `COMANDOS-RAPIDOS.md` - Todos os comandos
- `ACESSO-RAPIDO.md` - Acesso rápido
- `README-VERSIONAMENTO.md` - Resumo geral





