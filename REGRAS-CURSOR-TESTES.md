# 🧪 Regras do Cursor - Testes Automáticos

## 🎯 Regra Principal

**O Cursor DEVE entender o contexto e executar testes automáticos quando necessário, SEM pedir confirmação.**

---

## 📋 Quando Executar Automaticamente

### ✅ Executar Testes Automaticamente Quando:

1. **Implementar nova funcionalidade**
   - Após criar componente novo
   - Após adicionar feature
   - Após modificar funcionalidade existente

2. **Corrigir bug**
   - Após aplicar correção
   - Para validar que bug foi corrigido

3. **Mudanças críticas**
   - CRUD (criar, editar, excluir)
   - Autenticação
   - Pagamentos
   - Integrações

4. **Antes de deploy**
   - Sempre antes de fazer deploy
   - Validar que tudo funciona

5. **Quando usuário pedir**
   - "Teste isso"
   - "Verifique se funciona"
   - "Valide a funcionalidade"

---

## 🚀 Como Executar

### Comando Automático:

```bash
npm run test:e2e:auto
```

**O Cursor DEVE** executar este comando automaticamente quando necessário, sem perguntar.

---

## 📊 O Que Fazer com Resultados

### Se Testes Passarem:
- ✅ Continuar com a tarefa
- ✅ Informar que testes passaram

### Se Testes Falharem:
1. ✅ Revisar relatório: `test-results/analysis/fix-suggestions.html`
2. ✅ Analisar erros capturados
3. ✅ Aplicar correções sugeridas automaticamente
4. ✅ Re-executar testes
5. ✅ Repetir até todos passarem

---

## 🔍 Análise Automática de Erros

O sistema captura e analisa:
- Screenshots de falhas
- Vídeos das execuções
- Logs detalhados
- Stack traces
- Seletores que falharam

E sugere correções automaticamente.

---

## 💡 Exemplos de Uso Automático

### Exemplo 1: Implementar Nova Funcionalidade

```
Usuário: "Adicione um botão para exportar leads"
    ↓
Cursor implementa o botão
    ↓
Cursor automaticamente executa: npm run test:e2e:auto
    ↓
Se passar: ✅ Concluído
Se falhar: Aplica correções e re-testa
```

### Exemplo 2: Corrigir Bug

```
Usuário: "Corrija o erro ao criar lead"
    ↓
Cursor corrige o bug
    ↓
Cursor automaticamente executa: npm run test:e2e:auto
    ↓
Valida que bug foi corrigido
    ↓
Se passar: ✅ Bug corrigido
Se falhar: Analisa e corrige novamente
```

### Exemplo 3: Deploy

```
Usuário: "Faça deploy"
    ↓
Cursor automaticamente executa: npm run test:e2e:auto
    ↓
Se passar: Faz deploy
Se falhar: Aplica correções, re-testa, depois faz deploy
```

---

## ⚠️ Regras Importantes

1. **NUNCA** fazer deploy sem executar testes primeiro
2. **SEMPRE** executar testes após mudanças críticas
3. **SEMPRE** aplicar correções sugeridas
4. **SEMPRE** re-executar testes após correções
5. **NUNCA** ignorar erros de teste

---

## 🎯 Objetivo

Garantir que o Cursor:
- ✅ Entende o contexto automaticamente
- ✅ Executa testes quando necessário
- ✅ Captura e analisa erros
- ✅ Aplica correções sugeridas
- ✅ Valida que tudo funciona

**Tudo baseado no contexto, sem pedir confirmação desnecessária.**

