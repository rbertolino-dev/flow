# 📦 Sistema de Versionamento Automático

Sistema completo de versionamento automático com registro de mudanças e rollback para cada deploy do Docker.

---

## 🎯 Funcionalidades

✅ **Versionamento Automático**: Gera versões semanticamente (major.minor.patch)  
✅ **Registro de Mudanças**: Registra automaticamente o que mudou em cada deploy  
✅ **Rollback Rápido**: Volta para versões anteriores com um comando  
✅ **Histórico Completo**: Mantém histórico de todas as versões  
✅ **Integração com Deploy**: Integrado com deploy zero-downtime  
✅ **Retorno Imediato**: Retorna versão criada imediatamente após deploy  

---

## 🚀 Uso Rápido

### Deploy Normal (Mais Comum)

```bash
# Deploy com descrição automática do último commit git
./scripts/deploy-with-version.sh --auto-changes

# Deploy com descrição manual
./scripts/deploy-with-version.sh --changes "Correção de bug crítico no login"
```

### Deploy com Tipo Específico

```bash
# Patch (correção de bug) - padrão
./scripts/deploy-with-version.sh --type patch --changes "Correção de bug"

# Minor (nova funcionalidade)
./scripts/deploy-with-version.sh --type minor --changes "Adicionada funcionalidade de relatórios"

# Major (mudança quebra compatibilidade)
./scripts/deploy-with-version.sh --type major --changes "Refatoração completa do sistema"
```

### Rollback

```bash
# Rollback para versão anterior
./scripts/deploy-with-version.sh --rollback

# Rollback para versão específica
./scripts/deploy-with-version.sh --rollback --version 1.2.3
```

---

## 📋 Comandos do Version Manager

### Listar Versões

```bash
# Listar todas as versões
./scripts/version-manager.sh list
```

**Saída:**
```
📦 Versões Disponíveis
════════════════════════════════════════════════════

Versão Atual: 1.2.5

→ 1.2.5 | 2024-01-15T10:30:00Z | abc123 | main [ATUAL]
  1.2.4 | 2024-01-14T09:20:00Z | def456 | main
  1.2.3 | 2024-01-13T08:15:00Z | ghi789 | main
```

### Ver Detalhes de uma Versão

```bash
# Ver versão atual
./scripts/version-manager.sh show

# Ver versão específica
./scripts/version-manager.sh show 1.2.3
```

### Ver Últimas Mudanças

```bash
# Últimas 5 mudanças (padrão)
./scripts/version-manager.sh changes

# Últimas 10 mudanças
./scripts/version-manager.sh changes 10
```

### Versão Atual

```bash
./scripts/version-manager.sh current
```

---

## 🔄 Fluxo Automático

Quando você executa `./scripts/deploy-with-version.sh`, o sistema:

1. **Cria Nova Versão** automaticamente
   - Gera versão baseada no tipo (patch/minor/major)
   - Registra timestamp, git hash e branch
   - Cria descrição de mudanças

2. **Registra no Histórico**
   - Salva em `.versions.json`
   - Atualiza `CHANGELOG.md`
   - Tag Docker (opcional)

3. **Executa Deploy Zero-Downtime**
   - Build da nova versão
   - Health check
   - Alternância de tráfego
   - Rollback automático se falhar

4. **Retorna Versão Imediatamente**
   - Versão é retornada no final do script
   - Pode ser capturada para uso em CI/CD

---

## 📁 Arquivos Criados

### `.versions.json`
Arquivo JSON com histórico completo de versões:
```json
{
  "current_version": "1.2.5",
  "versions": [
    {
      "version": "1.2.5",
      "timestamp": "2024-01-15T10:30:00Z",
      "changes": "Correção de bug crítico",
      "git_hash": "abc123",
      "git_branch": "main",
      "docker_image": "kanban-buzz-app:1.2.5"
    }
  ],
  "last_updated": "2024-01-15T10:30:00Z"
}
```

### `CHANGELOG.md`
Arquivo markdown com histórico legível:
```markdown
## [1.2.5] - 2024-01-15

### Mudanças
- Correção de bug crítico

**Detalhes:**
- Git Hash: `abc123`
- Timestamp: `2024-01-15T10:30:00Z`
```

---

## 🎯 Exemplos Práticos

### Exemplo 1: Deploy de Correção de Bug

```bash
./scripts/deploy-with-version.sh --type patch --changes "Correção de bug no sistema de pagamento"
```

**Resultado:**
- Versão criada: `1.2.6` (se atual era 1.2.5)
- Deploy executado
- Versão retornada: `1.2.6`

### Exemplo 2: Deploy de Nova Funcionalidade

```bash
./scripts/deploy-with-version.sh --type minor --changes "Adicionada funcionalidade de relatórios em PDF"
```

**Resultado:**
- Versão criada: `1.3.0` (se atual era 1.2.6)
- Deploy executado
- Versão retornada: `1.3.0`

### Exemplo 3: Rollback Rápido

```bash
# Algo deu errado, voltar para versão anterior
./scripts/deploy-with-version.sh --rollback
```

**Resultado:**
- Versão atual volta para `1.2.6`
- Deploy zero-downtime com rollback
- Sistema volta a funcionar

### Exemplo 4: Deploy Automático com Git

```bash
# Usa mensagem do último commit automaticamente
./scripts/deploy-with-version.sh --auto-changes
```

**Resultado:**
- Versão criada automaticamente
- Descrição vem do último commit git
- Deploy executado

---

## 🔧 Integração com CI/CD

### Capturar Versão em Script

```bash
#!/bin/bash
VERSION=$(./scripts/deploy-with-version.sh --auto-changes)
echo "Deploy da versão $VERSION concluído!"
```

### Usar em Pipeline

```yaml
# Exemplo GitLab CI
deploy:
  script:
    - VERSION=$(./scripts/deploy-with-version.sh --auto-changes)
    - echo "Deploy da versão $VERSION concluído!"
    - # Notificar equipe, criar tag git, etc.
```

---

## 📊 Versionamento Semântico

O sistema usa **Semantic Versioning** (SemVer):

- **MAJOR** (1.0.0): Mudanças que quebram compatibilidade
- **MINOR** (0.1.0): Novas funcionalidades (compatível)
- **PATCH** (0.0.1): Correções de bugs (compatível)

**Exemplo de evolução:**
```
0.0.0 → 0.0.1 → 0.0.2 → 0.1.0 → 0.2.0 → 1.0.0 → 1.0.1 → 1.1.0
```

---

## 🚨 Rollback Automático

O sistema tem **rollback automático** em caso de falha:

1. Se health check falhar → Rollback automático
2. Se build falhar → Rollback automático
3. Se deploy falhar → Rollback automático

**Você não precisa fazer nada** - o sistema volta automaticamente para a versão anterior que estava funcionando.

---

## 📝 Boas Práticas

### 1. Sempre Descrever Mudanças

```bash
# ✅ BOM
./scripts/deploy-with-version.sh --changes "Correção de bug crítico no login que causava loop infinito"

# ❌ RUIM
./scripts/deploy-with-version.sh --changes "Correção"
```

### 2. Usar Tipo Correto

```bash
# ✅ BOM - Bug fix
./scripts/deploy-with-version.sh --type patch --changes "Correção de bug"

# ✅ BOM - Nova funcionalidade
./scripts/deploy-with-version.sh --type minor --changes "Nova funcionalidade"

# ✅ BOM - Breaking change
./scripts/deploy-with-version.sh --type major --changes "Refatoração completa"
```

### 3. Verificar Versões Antes de Rollback

```bash
# Ver histórico antes de fazer rollback
./scripts/version-manager.sh list

# Fazer rollback para versão específica
./scripts/deploy-with-version.sh --rollback --version 1.2.3
```

---

## 🔍 Troubleshooting

### Erro: "jq não está instalado"

```bash
# Instalar jq
apt-get install -y jq
```

### Erro: "Arquivo de versões não encontrado"

```bash
# O arquivo será criado automaticamente no primeiro deploy
# Ou criar manualmente:
./scripts/version-manager.sh create patch "Versão inicial"
```

### Ver Logs Detalhados

```bash
# Executar com debug
bash -x ./scripts/deploy-with-version.sh --auto-changes
```

---

## 📚 Comandos de Referência Rápida

```bash
# Deploy
./scripts/deploy-with-version.sh --auto-changes
./scripts/deploy-with-version.sh --changes "Descrição"
./scripts/deploy-with-version.sh --type minor --changes "Nova feature"

# Rollback
./scripts/deploy-with-version.sh --rollback
./scripts/deploy-with-version.sh --rollback --version 1.2.3

# Consultar
./scripts/version-manager.sh list
./scripts/version-manager.sh show
./scripts/version-manager.sh current
./scripts/version-manager.sh changes 10
```

---

## ✅ Pronto para Usar!

O sistema está **100% automatizado** e **pronto para uso imediato**:

1. Execute seu primeiro deploy:
   ```bash
   ./scripts/deploy-with-version.sh --auto-changes
   ```

2. Versão será criada automaticamente
3. Deploy será executado
4. Versão será retornada imediatamente

**É isso!** 🎉





