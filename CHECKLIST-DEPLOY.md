# ✅ Checklist de Deploy

Use este checklist antes e depois de cada deploy para garantir que tudo está funcionando corretamente.

---

## 📋 Pré-Deploy

### Antes de Fazer Deploy

- [ ] **Código testado localmente**
  - [ ] Aplicação funciona sem erros
  - [ ] Console do navegador sem erros críticos
  - [ ] Funcionalidades principais testadas

- [ ] **Mudanças no código identificadas**
  - [ ] Lista de arquivos modificados revisada
  - [ ] Imports do React verificados (useEffect, useState, etc.)
  - [ ] Dependências atualizadas (se necessário)

- [ ] **Ambiente preparado**
  - [ ] Acesso ao servidor Hetzner
  - [ ] Script de deploy disponível (`scripts/deploy-automatico.sh`)
  - [ ] Backup realizado (se necessário)

---

## 🚀 Durante o Deploy

### Executar Deploy

- [ ] **Executar script de deploy**
  ```bash
  cd /root/kanban-buzz-95241
  ./scripts/deploy-automatico.sh
  ```

- [ ] **Verificar build**
  - [ ] Build completou sem erros
  - [ ] Mensagem "Build concluído com sucesso!" apareceu
  - [ ] Nenhum erro crítico nos logs do build

- [ ] **Verificar container**
  - [ ] Container está rodando (`docker compose ps`)
  - [ ] Container está respondendo na porta 3000
  - [ ] Logs não mostram erros críticos

---

## ✅ Pós-Deploy

### Validação Obrigatória

- [ ] **Aplicação carrega corretamente**
  - [ ] Página inicial abre sem erros
  - [ ] Não há tela em branco
  - [ ] Interface renderiza corretamente

- [ ] **Console do navegador limpo**
  - [ ] Abrir DevTools (F12)
  - [ ] Verificar aba Console
  - [ ] ❌ **CRÍTICO**: Não deve haver `ReferenceError: useEffect is not defined`
  - [ ] ❌ **CRÍTICO**: Não deve haver `undefined is not a function`
  - [ ] ⚠️ Avisos são aceitáveis, mas erros não

- [ ] **Bundle JavaScript atualizado** ⚠️ **CRÍTICO - Previne Erro #001**
  - [ ] Verificar Network tab no DevTools
  - [ ] Arquivo `index-*.js` tem hash novo (não é o mesmo do deploy anterior)
  - [ ] Arquivo carrega com status 200
  - [ ] **Validação via terminal:**
    ```bash
    # Verificar hash do bundle
    curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1
    # Hash deve ser diferente do deploy anterior
    ```
  - [ ] Se hash não mudou após mudanças no código → **REBUILD OBRIGATÓRIO**

- [ ] **Funcionalidades principais**
  - [ ] Login funciona
  - [ ] Navegação entre páginas funciona
  - [ ] Funcionalidades críticas testadas
  - [ ] Integrações principais funcionam

- [ ] **Performance**
  - [ ] Página carrega em tempo razoável
  - [ ] Não há travamentos visíveis
  - [ ] Realtime funciona (se aplicável)

---

## 🚨 Se Encontrar Erros

### Erro: ReferenceError: useEffect is not defined (Erro #001)

**⚠️ Este é o erro mais comum relacionado a build desatualizado!**

**Diagnóstico Rápido:**
```bash
# 1. Verificar hash do bundle atual
BUNDLE_HASH=$(curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1)
echo "Hash atual: $BUNDLE_HASH"

# 2. Se hash não mudou após mudanças no código → build desatualizado
```

**Ação Imediata:**
1. ✅ Verificar se rebuild foi executado com `--no-cache`
2. ✅ Executar rebuild completo:
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```
3. ✅ Verificar novo hash do bundle (deve ser diferente)
4. ✅ Limpar cache do navegador (Ctrl+Shift+Delete ou Ctrl+Shift+R)
5. ✅ Verificar console do navegador novamente

**Se persistir:**
- Consultar `REGISTRO-ERROS-DEPLOY.md` (seção Erro #001)
- Verificar logs do container: `docker compose logs app`
- Verificar logs do build: `docker compose build --no-cache 2>&1 | tail -50`
- Verificar se código-fonte tem imports corretos (todos os arquivos que usam `useEffect` devem importar de `react`)

### Outros Erros

- [ ] Documentar erro em `REGISTRO-ERROS-DEPLOY.md`
- [ ] Verificar logs do container
- [ ] Verificar logs do build
- [ ] Consultar documentação de troubleshooting

---

## 📝 Documentação

### Após Deploy Bem-Sucedido

- [ ] Deploy documentado (se necessário)
- [ ] Mudanças principais anotadas
- [ ] Problemas encontrados registrados em `REGISTRO-ERROS-DEPLOY.md`

### Se Houve Problemas

- [ ] Erro documentado em `REGISTRO-ERROS-DEPLOY.md`
- [ ] Solução aplicada documentada
- [ ] Prevenção para futuro adicionada ao checklist

---

## 🔄 Deploy Rápido (Apenas Reiniciar)

**⚠️ ATENÇÃO: Use APENAS se NÃO houve mudanças no código!**

Se você apenas quer reiniciar o container sem rebuild:

```bash
docker compose restart
```

**NUNCA use isso se:**
- ❌ Houve mudanças no código-fonte
- ❌ Houve mudanças em imports do React
- ❌ Houve mudanças em dependências
- ❌ Você não tem certeza se houve mudanças

**SEMPRE use rebuild completo se:**
- ✅ Qualquer arquivo `.tsx`, `.ts`, `.js` foi modificado
- ✅ `package.json` foi modificado
- ✅ Qualquer mudança no código-fonte

---

**Última atualização:** 16/12/2025
**Versão:** 1.0
