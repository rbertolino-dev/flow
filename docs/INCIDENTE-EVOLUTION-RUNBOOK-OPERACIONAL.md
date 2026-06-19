# Runbook operacional — Servidor Evolution API

Referência rápida para operação segura do servidor Evolution (`62.72.8.186` / `api.ordemservico.com`).

Relacionado: [INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md](INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md) | [INCIDENTE-EVOLUTION-HARDENING-ROLLBACK.md](INCIDENTE-EVOLUTION-HARDENING-ROLLBACK.md) | [INCIDENTE-CHECKLIST-CAMPANHA-WHATSAPP.md](INCIDENTE-CHECKLIST-CAMPANHA-WHATSAPP.md)

---

## Configuração de produção (obrigatória)

| Variável | Valor | Motivo |
|----------|-------|--------|
| `CACHE_REDIS_SAVE_INSTANCES` | **`false`** | `true` causou loop `connecting` em 18/06/2026 |
| `DATABASE_SAVE_DATA_INSTANCE` | `true` | Sessões Baileys no Postgres |
| `CACHE_REDIS_ENABLED` | `true` | Cache geral OK |
| `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI` | `@postgres:5432/chatwoot_nestor` | Host `pgvector` não existe |
| Imagem | `evoapicloud/evolution-api:v2.3.7` | Sem licença 2.4+ |
| Réplicas Evolution | **1** | Múltiplas réplicas = conflito Baileys |

**Nunca reativar** `CACHE_REDIS_SAVE_INSTANCES=true` sem ambiente de teste + flush do Redis db 8.

---

## Antes de qualquer deploy / stack deploy

1. Confirmar **nenhuma campanha Disparador 2 em `running`** na org afetada.
2. Backup automático: scripts `evolution-hardening-deploy.sh` / recovery criam cópia em `/root/evolution-hardening-backups/`.
3. Anotar contagem `open` antes:
   ```bash
   docker exec $(docker ps --filter name=postgres_postgres -q | head -1) \
     psql -U postgres -d evolution -c \
     'select "connectionStatus"::text, count(*) from "Instance" group by 1;'
   ```
4. Executar deploy apenas em janela acordada (preferir fora de horário comercial de campanhas).

---

## Deploy seguro

```bash
ssh root@62.72.8.186
/root/evolution-hardening-deploy.sh --dry-run   # revisar diff
/root/evolution-hardening-deploy.sh             # só se dry-run OK
```

**Não usar:** `docker compose down` + rebuild na Evolution em produção.

---

## Pós-deploy (5 minutos)

1. Serviço `1/1`: `docker service ls --filter name=evolution_evolution`
2. Contagem `open` > 0 (ou chips reconectando):
   ```bash
   docker exec $(docker ps --filter name=postgres_postgres -q | head -1) \
     psql -U postgres -d evolution -Atc \
     'select count(*) from "Instance" where "connectionStatus"::text = '\''open'\'';'
   ```
3. API responde: `curl -s -o /dev/null -w '%{http_code}\n' https://api.ordemservico.com/`
4. Logs sem `ENOTFOUND pgvector` (últimas 500 linhas do json.log)

---

## Se `open = 0` após deploy (recovery)

```bash
ssh root@62.72.8.186
/root/evolution-recovery-stuck-connecting.sh
```

O script:
- Reverte `CACHE_REDIS_SAVE_INSTANCES=false`
- Restaura `CONFIG_SESSION_PHONE_VERSION` do backup
- Remove chaves `evolution:instance:*` do Redis db 8
- Aplica `stack deploy` e monitora `open`

**Rollback completo do yaml:**
```bash
/root/evolution-hardening-rollback.sh --dry-run
/root/evolution-hardening-rollback.sh
```

---

## O que NÃO fazer

| Ação | Risco |
|------|-------|
| Deploy durante campanha ativa | Derruba/reconecta todos os chips |
| `CACHE_REDIS_SAVE_INSTANCES=true` | Travamento em `connecting` |
| Upgrade para v2.4.x sem licença | `503 LICENSE_REQUIRED` |
| Reconectar 40+ chips no mesmo dia da campanha | Rajada de QR / instabilidade |
| `docker logs evolution` (host atual) | Comando trava — usar `json.log` direto |

---

## Monitoramento semanal

```bash
# No repo CRM (95.217.2.116 ou dev)
python3 scripts/diagnostico-bloqueios-evolution.py --date $(date +%Y-%m-%d) --save
```

Verificar: `device_removed`, 401, 403 nos logs; comparar com quedas em `instance_connection_events`.

---

## Contatos de scripts

| Script | Uso |
|--------|-----|
| `scripts/evolution-hardening-deploy.sh` | Hardening (Chatwoot, imagem) — **sem** ativar Redis save |
| `scripts/evolution-recovery-stuck-connecting.sh` | Recovery pós-travamento `connecting` |
| `scripts/evolution-hardening-rollback.sh` | Rollback yaml |
| `scripts/diagnostico-bloqueios-evolution.py` | Diagnóstico bloqueios |

*Última atualização: 2026-06-18*
