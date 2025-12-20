# 📺 Como Acompanhar em Tempo Real

## 🖥️ No Seu Terminal (Recomendado)

Abra um terminal no seu computador e execute:

```bash
tail -f /tmp/migration-inteligente-final.log
```

Este comando mostra o log em **tempo real** - novas linhas aparecem automaticamente.

### Para parar:
Pressione `Ctrl + C`

## 📊 Comandos Úteis

### Ver últimas 50 linhas:
```bash
tail -50 /tmp/migration-inteligente-final.log
```

### Ver apenas progressos:
```bash
tail -f /tmp/migration-inteligente-final.log | grep -E "(Aplicando|aplicada|Progresso|Corrigindo)"
```

### Ver apenas correções:
```bash
tail -f /tmp/migration-inteligente-final.log | grep "Corrigindo"
```

### Ver estatísticas:
```bash
grep -E "(Progresso|aplicadas|falhas)" /tmp/migration-inteligente-final.log | tail -20
```

## 🤖 Ou Acompanhe Aqui no Agente

Posso mostrar o status atual sempre que você pedir! Basta dizer:
- "mostre o status"
- "como está a migração"
- "acompanhar migração"

## 📝 O Que Você Verá

O log mostra:
- ✅ Cada migration sendo aplicada
- 🔧 Correções automáticas sendo feitas
- 📊 Progresso (X aplicadas, Y falhas)
- ⚠️ Erros e tentativas de correção
- 🎉 Sucesso quando uma migration passa

## 💡 Dica

Deixe o `tail -f` rodando em uma janela do terminal enquanto trabalha em outra. Assim você acompanha o progresso sem interromper seu trabalho!




