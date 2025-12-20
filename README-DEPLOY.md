# 🚀 Deploy Automático - Guia Rápido

## ⚡ Deploy Rápido (1 comando)

```bash
cd /root/kanban-buzz-95241 && ./scripts/deploy-automatico.sh
```

## 📋 O que o script faz automaticamente

1. ✅ Atualiza código (`git pull`)
2. ✅ Para containers atuais
3. ✅ Faz build sem cache
4. ✅ Sobe containers novamente
5. ✅ Verifica saúde da aplicação
6. ✅ Mostra logs e status

## 🔧 Informações do Ambiente

- **Servidor**: Hetzner
- **Diretório**: `/root/kanban-buzz-95241`
- **Docker Compose**: v5.0.0 (`docker compose`)
- **Container**: `kanban-buzz-app`
- **Porta**: 3000

## 📚 Documentação Completa

- **Guia Completo**: `DEPLOY-AUTOMATICO.md`
- **Instruções para IA**: `.cursor/deploy-instructions.md`

## 🎯 Próxima Vez que Precisar Fazer Deploy

Basta executar:
```bash
./scripts/deploy-automatico.sh
```

Tudo será feito automaticamente! 🎉


