# 🚀 Instruções de Deploy Automático - Cursor AI

## Contexto para IA

Este projeto usa **Docker + Docker Compose** no servidor **Hetzner** para deploy.

### Informações Críticas

1. **Localização do Projeto no Servidor**: `/root/kanban-buzz-95241`
2. **Docker Compose**: Versão v5.0.0 (usa comando `docker compose` sem hífen)
3. **Container Name**: `kanban-buzz-app`
4. **Porta**: 3000 (mapeada para 80 no container)
5. **Script de Deploy**: `scripts/deploy-automatico.sh`

### Processo de Deploy Automático

Quando precisar fazer deploy, execute:

```bash
cd /root/kanban-buzz-95241
./scripts/deploy-automatico.sh
```

### Comandos Essenciais

**Parar containers**:
```bash
docker compose down
```

**Build sem cache**:
```bash
docker compose build --no-cache
```

**Subir containers**:
```bash
docker compose up -d
```

**Ver logs**:
```bash
docker compose logs -f app
```

**Verificar status**:
```bash
docker compose ps
```

### Fluxo Completo

1. Fazer commit e push das mudanças (se necessário)
2. No servidor: `cd /root/kanban-buzz-95241`
3. Executar: `./scripts/deploy-automatico.sh`
4. Aguardar build completar (pode levar alguns minutos)
5. Verificar se container está rodando: `docker compose ps`
6. Testar aplicação: `curl http://localhost:3000`

### Troubleshooting

- Se container não sobe: `docker compose logs app`
- Se build falha: limpar cache com `docker system prune -a`
- Se código não atualiza: verificar se `git pull` foi executado
- Sempre usar `--no-cache` no build para garantir mudanças

### Erros Conhecidos

**Erro #001: ReferenceError: useEffect is not defined**
- **Causa**: Build desatualizado servindo bundle antigo
- **Solução**: Rebuild completo com `docker compose build --no-cache`
- **Prevenção**: SEMPRE fazer rebuild após mudanças no código
- **Documentação**: Ver `REGISTRO-ERROS-DEPLOY.md` para detalhes completos

### Importante

- **SEMPRE** usar `docker compose` (sem hífen) - versão v5
- **SEMPRE** usar `--no-cache` no build (obrigatório para evitar bundle desatualizado)
- **SEMPRE** fazer rebuild após mudanças no código (nunca apenas reiniciar container)
- **SEMPRE** aguardar alguns segundos após subir container
- **SEMPRE** verificar logs se algo não funcionar
- **SEMPRE** validar pós-deploy: verificar console do navegador para erros JavaScript
- **NUNCA** reiniciar container sem rebuild após mudanças no código

