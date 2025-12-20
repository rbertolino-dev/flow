# 📋 Registro de Erros de Deploy

Este documento registra erros críticos que ocorreram durante deploys para prevenir que se repitam no futuro.

---

## 🚨 Erro #001: ReferenceError: useEffect is not defined

### Data do Erro
**16/12/2025 - 03:04 UTC**

### Descrição do Erro
```
ReferenceError: useEffect is not defined
at IV (index-DJ73OY57.js:889:932)
```

**Sintomas:**
- Tela em branco na aplicação
- Erro no console do navegador indicando que `useEffect` não está definido
- Bundle minificado (`index-DJ73OY57.js`) contém código desatualizado
- Hash do bundle JavaScript não muda após deploy (indicando build antigo)

### Causa Raiz
O build do Docker estava **desatualizado**, servindo um bundle minificado antigo que não refletia as mudanças recentes no código-fonte. O código-fonte estava correto (todos os imports de `useEffect` estavam presentes), mas o bundle compilado não havia sido atualizado.

**Possíveis causas:**
1. Build do Docker não foi executado após mudanças no código
2. Cache do Docker estava servindo uma imagem antiga
3. Container foi reiniciado sem rebuild (`docker compose restart` ao invés de rebuild)
4. Build foi executado com cache, ignorando mudanças recentes

### Como Detectar o Problema

**Sinais de alerta:**
1. Hash do bundle JavaScript não muda após deploy
   - Verificar: `curl http://localhost:3000 | grep -o 'index-[^"]*\.js'`
   - Hash deve mudar a cada build bem-sucedido
2. Erros de `ReferenceError` ou `undefined` no console do navegador
3. Funcionalidades que funcionavam param de funcionar após deploy
4. Tela em branco sem erros de rede

**Validação rápida:**
```bash
# Verificar hash do bundle atual
CURRENT_HASH=$(curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1)
echo "Hash atual: $CURRENT_HASH"

# Após rebuild, hash deve ser diferente
```

### Solução Aplicada
```bash
# 1. Parar containers
docker compose down

# 2. Rebuild completo sem cache (OBRIGATÓRIO)
docker compose build --no-cache

# 3. Reiniciar containers
docker compose up -d

# 4. Verificar se hash mudou
NEW_HASH=$(curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1)
echo "Novo hash: $NEW_HASH"
```

**Resultado:** ✅ Erro resolvido após rebuild completo.

### Prevenção para Futuros Deploys

#### ✅ Checklist Obrigatório Antes de Deploy

1. **SEMPRE fazer rebuild após mudanças no código:**
   ```bash
   docker compose build --no-cache
   ```

2. **NUNCA apenas reiniciar container sem rebuild:**
   ```bash
   # ❌ ERRADO - não atualiza código
   docker compose restart
   
   # ✅ CORRETO - atualiza código
   docker compose down && docker compose build --no-cache && docker compose up -d
   ```

3. **Verificar se build foi executado:**
   - Verificar timestamp do último build
   - Confirmar que `dist/` foi atualizado (se build local)
   - Verificar logs do build para erros

4. **Após mudanças em imports do React:**
   - Sempre fazer rebuild completo
   - Verificar se todos os hooks estão importados corretamente
   - Testar localmente antes de deploy

#### 🔧 Atualização no Script de Deploy

O script `scripts/deploy-automatico.sh` deve **SEMPRE** incluir:
- `docker compose build --no-cache` (nunca usar cache)
- Verificação de sucesso do build
- Logs do build para debug

#### 📝 Validação Pós-Deploy

Após cada deploy, verificar:
1. ✅ Aplicação carrega sem erros no console
2. ✅ Não há erros de `ReferenceError` ou `undefined`
3. ✅ Funcionalidades principais funcionam
4. ✅ Bundle JavaScript está atualizado (verificar hash no nome do arquivo)
5. ✅ Hash do bundle mudou após rebuild (comparar antes/depois)

**Script de validação automática:**
```bash
# Verificar hash do bundle
BUNDLE_HASH=$(curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1)
if [ -z "$BUNDLE_HASH" ]; then
    echo "❌ ERRO: Bundle não encontrado - build pode ter falhado"
    exit 1
fi
echo "✅ Bundle detectado: $BUNDLE_HASH"
```

### Arquivos Afetados
- Todos os componentes React que usam hooks (`useEffect`, `useState`, etc.)
- Bundle minificado: `dist/assets/index-*.js`

### Lições Aprendidas
1. **Build é obrigatório após qualquer mudança no código**
2. **Cache do Docker pode esconder problemas** - sempre usar `--no-cache` em produção
3. **Erros de runtime podem indicar build desatualizado**, não necessariamente código incorreto
4. **Validação pós-deploy é essencial** para detectar problemas rapidamente
5. **Hash do bundle é indicador confiável** de build atualizado
6. **Nunca usar `docker compose restart`** após mudanças no código - sempre rebuild completo
7. **Erros de `ReferenceError` em produção geralmente indicam bundle desatualizado**, não bug no código

### Comandos de Diagnóstico

**Verificar se build está atualizado:**
```bash
# 1. Verificar hash do bundle atual
curl -s http://localhost:3000 | grep -o 'index-[^"]*\.js' | head -1

# 2. Verificar data de modificação do container
docker inspect kanban-buzz-app | grep -i created

# 3. Verificar logs do build
docker compose logs app | grep -i "built\|error\|warning"
```

**Forçar rebuild se necessário:**
```bash
# Rebuild completo garantido
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 📌 Regras Gerais de Deploy

### ✅ SEMPRE Fazer
- [ ] Rebuild completo com `--no-cache` após mudanças no código
- [ ] Verificar logs do build para erros
- [ ] Testar aplicação após deploy
- [ ] Verificar console do navegador para erros JavaScript
- [ ] Confirmar que bundle foi atualizado (hash no nome do arquivo)

### ❌ NUNCA Fazer
- [ ] Reiniciar container sem rebuild após mudanças no código
- [ ] Usar cache do Docker em builds de produção (`--no-cache` é obrigatório)
- [ ] Ignorar erros no console do navegador
- [ ] Fazer deploy sem testar localmente primeiro
- [ ] Assumir que código está atualizado sem verificar build

---

**Última atualização:** 16/12/2025
**Próxima revisão:** Após próximo deploy
