# Registro de mudanças — Hardening Evolution API (18/06/2026)

Documento para **análise de impacto** e **rollback controlado** das alterações aplicadas no servidor Evolution.

| Campo | Valor |
|-------|-------|
| **Servidor** | `62.72.8.186` (SSH alias: servidor Evolution / `api.ordemservico.com`) |
| **Stack Docker Swarm** | `evolution` |
| **Serviço** | `evolution_evolution` |
| **Arquivo de config** | `/root/evolution.yaml` |
| **Data/hora (UTC)** | 2026-06-18 ~19:10 |
| **Executor** | `scripts/evolution-hardening-deploy.sh` |
| **Commit repo** | `6a13b9a` (`feat(evolution): hardening Redis persistência e limpeza de ruídos Chatwoot`) |
| **Org impactada (principal)** | IClass `34086d07-9181-43fc-a3e8-6aa28974d68b` (42 instâncias) |

---

## 1. O que mudou (diff resumido)

| Variável / item | **ANTES** | **DEPOIS** | Motivo |
|-----------------|-----------|------------|--------|
| `image` (yaml) | `atendai/evolution-api:latest` | `evoapicloud/evolution-api:v2.3.7` | Evitar pull acidental de imagem diferente; manter versão estável sem licença 2.4+ |
| Imagem em execução | Já era `evoapicloud/evolution-api:v2.3.7` | Mesma (`sha256:1bd8afc4…`) | **Sem upgrade de binário** — só fixou o yaml |
| `CACHE_REDIS_SAVE_INSTANCES` | `false` | `true` → **revertido `false`** após incidente | Ver seção incidente `connecting` abaixo |
| `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI` | `@pgvector:5432/chatwoot` | `@postgres:5432/chatwoot_nestor` | Host `pgvector` não existe no Swarm → erros `ENOTFOUND` |
| `CONFIG_SESSION_PHONE_VERSION` | `2.3000.1019673114` | `2.3000.1025099606` → **revertido** `2.3000.1019673114` | Sincronizado no hardening; revertido no recovery |
| `DATABASE_SAVE_DATA_INSTANCE` | `true` (inalterado) | `true` | Sessões Baileys continuam no Postgres |
| `CACHE_REDIS_ENABLED` | `true` (inalterado) | `true` | Redis cache ativo |

**O que NÃO mudou:**
- Versão da Evolution em produção (permanece **v2.3.7**)
- Postgres / Redis / Traefik (sem alteração de infra)
- Webhooks, CRM, Supabase, Nginx do CRM (`95.217.2.116`)
- Upgrade para v2.4.x (**não aplicado** — exige licença)

---

## 2. Backups disponíveis (rollback)

| Arquivo | Data (UTC) | Observação |
|---------|------------|------------|
| `/root/evolution-hardening-backups/evolution.yaml.20260618-190956.bak` | 18/06 19:09:56 | **Usar este para rollback** — estado imediatamente anterior |
| `/root/evolution-hardening-backups/evolution.yaml.20260618-191009.bak` | 18/06 19:10:09 | Segundo backup (quase idêntico ao anterior) |

> Os backups contêm senhas em texto. **Não commitar no Git.** Acesso apenas via SSH root no servidor Evolution.

---

## 3. Análise de impacto

### 3.1 Impacto imediato (esperado)

| Área | Impacto | Severidade |
|------|---------|------------|
| **Restart do container** | `docker stack deploy` recria a task `evolution_evolution` | **Alto** — ~1–3 min API indisponível ou instável |
| **Instâncias WhatsApp** | Todas passam por reconexão Baileys após restart | **Alto** — queda temporária de `open` |
| **Campanhas / Disparador** | Envios falham ou reagem até chips voltarem `open` | **Alto** se campanha rodando no momento |
| **CRM `is_connected`** | Pode ficar desatualizado vs API durante janela de reconexão | **Médio** — webhook `connection.update` corrige com tempo |
| **Logs** | Menos ruído (`pgvector`, `ChatwootImport` ERROR) | **Positivo** |
| **Redis** | Novas chaves `evolution:instance:*` com TTL `-1` | **Positivo** a longo prazo |

### 3.2 Medições antes vs depois (18/06/2026)

| Métrica | Antes do deploy | ~18 min após deploy |
|---------|-----------------|---------------------|
| Instâncias `open` (Postgres, todas orgs) | **14** | **0** |
| `connecting` | — | **37** |
| `close` | — | **15** |
| Sessões Postgres (`Session`) | 38 | **38** (preservadas) |
| Chaves Redis `evolution:instance:*` | ~270 total `evolution:*` | **75** instance keys, TTL `-1` |
| `ENOTFOUND pgvector` (últimos 3k logs) | presente | **0** |
| `ChatwootImport` ERROR | presente | **0** |
| Eventos QR nos logs | — | **99** (chips pedindo pareamento) |
| API IClass `connectionState` | 12 open / 30 close (pré-deploy) | **35 connecting / 7 close / 0 open** |
| CRM `is_connected=true` | — | **12** (defasado vs API) |

### 3.3 Interpretação

1. **`CACHE_REDIS_SAVE_INSTANCES=true`** — não desconecta chips por si só; melhora recuperação após **futuros** restarts. O restart do deploy é que causou a reconexão em massa.

2. **Correção Chatwoot** — impacto apenas na integração de importação Chatwoot; **não afeta** envio WhatsApp nem webhooks do CRM.

3. **Fixar imagem no yaml** — alinha documentação com o que já rodava; sem mudança de código da API.

4. **`CONFIG_SESSION_PHONE_VERSION`** — versão do cliente WA usada pelo Baileys; valor novo já era o do container em execução antes do patch (baixo risco).

5. **Chips em `connecting` há muitos minutos** — pode indicar:
   - fila lenta de reconexão (52 instâncias no servidor);
   - sessões inválidas que exigem **novo QR** (não é regressão do hardening);
   - comportamento conhecido da v2.3.7 em janelas de restart.

6. **CRM com 12 `is_connected=true` mas API 0 `open`** — defasagem operacional; não reverter hardening por isso; aguardar webhooks ou forçar health check.

### 3.4 Riscos se mantiver as mudanças

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Chips precisarem QR manual | Média-alta (muitos já estavam `close`) | Reconectar só os necessários no CRM |
| Redis crescer com mais chaves | Baixa | Monitorar `redis-cli -n 8 DBSIZE` |
| Próximo `stack deploy` repetir restart | Certa | Evitar deploy em horário de campanha; usar rollback script se necessário |

### 3.5 Riscos se fizer rollback

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| **Novo restart** ao aplicar yaml antigo | **Certa** | Só rollback fora de campanha |
| Voltar `CACHE_REDIS_SAVE_INSTANCES=false` | Perde persistência Redis de instâncias | Aceitável só se Redis causar problema comprovado |
| Voltar URI `pgvector` | **Reativa ruído** `ENOTFOUND` nos logs | Não recomendado |
| Voltar `atendai/evolution-api:latest` no yaml | Próximo deploy pode puxar imagem errada | Manter `evoapicloud/v2.3.7` mesmo no rollback parcial |

---

## 4. Quando fazer rollback

**Faça rollback completo** se:
- API Evolution não sobe após 10 min (`docker service ls` ≠ `1/1`);
- erros críticos novos nos logs ligados a Redis/Chatwoot (não QR);
- decisão de negócio para reverter ambiente.

**NÃO faça rollback** só porque:
- chips estão `connecting` após restart (esperado);
- chips `close` precisam QR (já precisariam antes);
- CRM `is_connected` defasado temporariamente.

**Rollback parcial recomendado** (se só Redis causar problema):
- Reverter apenas `CACHE_REDIS_SAVE_INSTANCES=false`
- **Manter** URI Chatwoot corrigida e imagem fixada

---

## 5. Procedimento de rollback

### Opção A — Script automatizado (recomendado)

No servidor Evolution (`62.72.8.186`):

```bash
# 1. Conferir backups
ls -la /root/evolution-hardening-backups/

# 2. Dry-run (mostra o que será restaurado)
/root/evolution-hardening-rollback.sh --dry-run

# 3. Rollback completo (restaura backup + stack deploy)
/root/evolution-hardening-rollback.sh

# 4. Rollback parcial — só Redis
/root/evolution-hardening-rollback.sh --partial redis
```

Script no repositório: `scripts/evolution-hardening-rollback.sh`

### Opção B — Manual

```bash
ssh root@62.72.8.186

# Backup do estado ATUAL antes de reverter
cp -a /root/evolution.yaml /root/evolution-hardening-backups/evolution.yaml.pre-rollback.$(date -u +%Y%m%d-%H%M%S).bak

# Restaurar backup pré-hardening
cp -a /root/evolution-hardening-backups/evolution.yaml.20260618-190956.bak /root/evolution.yaml

# Aplicar
docker stack deploy -c /root/evolution.yaml evolution

# Aguardar 1/1
watch -n5 'docker service ls --filter name=evolution_evolution'

# Verificar env
docker service inspect evolution_evolution --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -E 'CACHE_REDIS_SAVE_INSTANCES|CHATWOOT_IMPORT'
```

### Pós-rollback — verificações

```bash
# Saúde
curl -s -o /dev/null -w '%{http_code}\n' https://api.ordemservico.com/

# Instâncias
docker exec $(docker ps --filter name=postgres_postgres -q | head -1) \
  psql -U postgres -d evolution -c 'select "connectionStatus"::text, count(*) from "Instance" group by 1;'

# Ruído pgvector (esperado voltar se URI antiga)
docker inspect --format='{{.LogPath}}' $(docker ps --filter name=evolution_evolution -q) | xargs tail -200 | grep -c pgvector || true
```

---

## 6. Rollback parcial — matriz de decisão

| Cenário | Ação |
|---------|------|
| Redis com problema | `--partial redis` → só `CACHE_REDIS_SAVE_INSTANCES=false` |
| Chatwoot import OK, não mexer | Manter URI `@postgres/chatwoot_nestor` |
| Imagem | **Nunca** voltar para `atendai/latest` no yaml |
| Versão WA | Pode manter `2.3000.1025099606` mesmo no rollback |

---

## 7. Histórico de commits relacionados

| Commit | Descrição |
|--------|-----------|
| `9f1dc50` | Script diagnóstico bloqueios Evolution |
| `6a13b9a` | Script hardening + doc incidente atualizada |

---

## 8. Contatos operacionais

- **Diagnóstico bloqueios:** `python3 scripts/diagnostico-bloqueios-evolution.py --date YYYY-MM-DD --save`
- **Doc incidente IClass:** `docs/INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md`
- **Credenciais SSH Evolution:** `scripts/.evolution-ssh-credentials` (gitignored)

---

## 9. Incidente: preso em `connecting` após hardening (18/06/2026)

### Sintoma
- 30+ minutos com **0 `open`**, 37 `connecting`, 219 eventos QR nos logs
- `Session` existia no Postgres (creds ~3 KB) mas `GET /instance/connect/{nome}` retornava QR
- **0 eventos `state: open`** no log do container desde o hardening

### Causa raiz
`CACHE_REDIS_SAVE_INSTANCES=true` gravou estado Baileys em Redis como **hash** (`evolution:instance:{uuid}` com pre-keys, device-list, etc.). Após `stack deploy`, esse cache **conflitou** com as sessões em Postgres — Evolution ficou em loop `connecting` sem nunca atingir `open`.

### Correção aplicada (`scripts/evolution-recovery-stuck-connecting.sh`)
1. `CACHE_REDIS_SAVE_INSTANCES=false`
2. `CONFIG_SESSION_PHONE_VERSION=2.3000.1019673114` (backup)
3. `DEL` de todas as chaves `evolution:instance:*` no Redis db 8 (75 chaves)
4. `stack deploy`
5. Em **~60s**: **14 `open`** (Postgres), IClass API **12 `open`**

### Estado final recomendado (produção)
| Item | Valor |
|------|-------|
| `CACHE_REDIS_SAVE_INSTANCES` | **`false`** (não reativar sem teste) |
| `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI` | `@postgres:5432/chatwoot_nestor` (**manter**) |
| `image` | `evoapicloud/evolution-api:v2.3.7` (**manter**) |
| `CONFIG_SESSION_PHONE_VERSION` | `2.3000.1019673114` |

### Se voltar a travar em `connecting`
```bash
ssh root@62.72.8.186 '/root/evolution-recovery-stuck-connecting.sh'
```

---

*Última atualização: 2026-06-18 19:47 UTC — recovery aplicado, 14 open restaurados.*
