# 🔄 Como Acompanhar a Migração em Background

## ✅ Status

**Migração iniciada em background!**

## 📝 Comandos Úteis

### Ver progresso em tempo real:
```bash
tail -f /tmp/migration-background-completa.log
```

### Verificar se está rodando:
```bash
ps aux | grep migration-background-completa
```

### Ver últimas linhas do log:
```bash
tail -50 /tmp/migration-background-completa.log
```

### Verificar PID:
```bash
cat /tmp/migration-background-completa.pid
```

### Parar o processo (se necessário):
```bash
kill $(cat /tmp/migration-background-completa.pid)
```

### Verificar status das migrations:
```bash
export SUPABASE_ACCESS_TOKEN="sbp_65ea725d285d73d58dc277c200fbee1975f01b9f"
supabase migration list | grep -E "(Pending|Applied)"
```

## 🎯 O Que o Script Faz

1. ✅ **Roda em background** - Não bloqueia o terminal
2. ✅ **Ignora erros de "already exists"** - Continua automaticamente
3. ✅ **Retry automático** - Tenta até 5 vezes se necessário
4. ✅ **Continua até acabar** - Não para em erros de duplicação
5. ✅ **Log completo** - Tudo é salvo em `/tmp/migration-background-completa.log`

## ⏱️ Tempo Estimado

- **220 migrations** podem levar **30-60 minutos**
- O script continua mesmo com erros de "already exists"
- Não precisa intervir - deixe rodar!

## ✅ Quando Terminar

O script mostrará:
- ✅ Quantas migrations foram aplicadas
- ✅ Status final
- ✅ Log completo salvo

## 💡 Dica

Deixe rodar em background e acompanhe o log quando quiser:
```bash
tail -f /tmp/migration-background-completa.log
```




