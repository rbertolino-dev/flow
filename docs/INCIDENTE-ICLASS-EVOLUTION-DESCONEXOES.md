# Incidente IClass — Desconexões Evolution API (17/06/2026)

Documento de referência para retomar em chats futuros. Consolida diagnóstico, evidências, correções aplicadas e conclusões.

---

## Contexto

| Item | Valor |
|------|--------|
| Organização | **IClass Sistemas** |
| `organization_id` | `34086d07-9181-43fc-a3e8-6aa28974d68b` |
| Instâncias WhatsApp | **42** (todas no mesmo servidor Evolution) |
| Servidor Evolution | `https://api.ordemservico.com` → VPS `62.72.8.186` (`srv758756.hstgr.cloud`, Hostinger) |
| Servidor CRM (AgilizeFlow) | `95.217.2.116` — **não** roda Evolution, só o app |
| Evolution no servidor | Docker Swarm: `evolution_evolution.1.*` — imagem `evoapicloud/evolution-api:v2.3.7` |

---

## O que aconteceu (resumo)

No dia **17/06/2026**, muitas instâncias da IClass apareceram como desconectadas. No pico do dia:

- **28 eventos** de desconexão registrados (`instance_connection_events`)
- Estado ao final do dia: ~**6–8 conectadas** de 42
- **100%** das quedas foram em chips do **pool da campanha** Disparador 2 em rodízio
- **Não foi bug de status no CRM** — Evolution API ao vivo confirmou `close` nas desconectadas

---

## Campanha envolvida

| Campo | Valor |
|-------|--------|
| Nome | `2 contato - Refrigeração - Sudeste - 17/06/26` |
| Tabela | `broadcast_campaigns_2` |
| Modo | `rotate` (rodízio) |
| Chips no pool | **30** de 42 |
| Início | `2026-06-17T13:09:21 UTC` (**10:09 BRT**) |
| Delay configurado | 1200–1600 s (20–27 min) entre envios |
| Envios no dia | **~412** mensagens (`broadcast_queue_2`, status `sent`) |
| Falhas na fila | 0 registradas como `failed` (antes do failover ser desligado, muitas foram reagendadas) |

---

## Linha do tempo (17/06/2026)

Horários em **BRT** (UTC−3).

| Horário | Evento |
|---------|--------|
| **10:09:03** | Primeira queda (Cecília) — **18 s antes** do `started_at` oficial da campanha |
| **10:09** | **9 chips** caem em ~1 minuto |
| **10:29–10:36** | Mais **8 chips**, ~1 minuto de intervalo |
| **11:42 – 15:44** | Quedas espalhadas; chips com **mais envios** caem depois (bia 53, Silvia/Ana Carolina/Ana Iclass 51 cada) |
| Resto do dia | Envios contínuos (~72/h no horário comercial UTC) |

### Pico 10:09 — detalhe

- **9 quedas** no minuto `13:09 UTC`
- **23 envios** naquele minuto
- Na queda: **0 ou 1 envio** por chip (não era “chip já com 50 mensagens”)
- `Aline Silva` e `Aline Santos`: **0 envios** e mesmo assim caíram → sessão já frágil ou efeito do arranque da campanha

---

## O que NÃO foi a causa

| Hipótese | Por que descartada |
|----------|-------------------|
| Bug de status no CRM | Live `connectionState` = `is_connected` no banco (**0 divergências** em 42 chips) |
| “Piscar” / oscilação falsa | Monitor `teste-oscilacao-status-evolution.py`: **0 flips** no período testado |
| Health check do frontend | Desligado para orgs com **>15** instâncias (`Index.tsx` — IClass tem 42) |
| Restart/crash do servidor Evolution | Ver seção **Evidência definitiva (SSH)** abaixo |
| Disparador 1 (`broadcast_campaigns`) | **0 envios** no dia; campanhas antigas pausadas/concluídas |
| Queda global do servidor afetando outras empresas | Só IClass usa `api.ordemservico.com` (42 chips, 1 org) — não há outra org para comparar no mesmo host |

---

## Causa principal (confirmada)

### 1. Sobrecarga operacional — campanha + sessões WhatsApp

- Disparo em massa com **30 chips em rodízio** e **centenas de mensagens**
- Chips com **mais envios** caíram **horas depois** (correlação envio → queda)
- Logs Evolution no dia: erros **`Connection Closed` (HTTP 428)** do Baileys — queda de **sessão individual**, não do servidor
- Webhooks `messages.upsert` no Supabase (`evolution_logs`) **continuaram** durante o pico — API viva

### 2. Failover entre chips (agravante — **corrigido**)

**Comportamento antigo** (`process-broadcast-queue-2`):

- Chip offline ou `Connection Closed` → mensagem **reagendada em outro chip** do pool (até 4 tentativas, delay 45 s)
- Efeito: chips saudáveis **acumulavam** envios extras (ex.: bia 53, Silvia 51) e também caíam

**Correção aplicada** (commit `c0c954c`, edge functions publicadas):

- `process-broadcast-queue-2`: sem `resolveFailoverInstance` / `rescheduleWithFailover` — mensagem **falha** (`status: failed`)
- `process-scheduled-messages`: sem fallback para outra instância da org quando `is_connected = false`

---

## Evidência definitiva — servidor Evolution (SSH 17/06/2026)

Acesso: `root@62.72.8.186` (Hostinger). Somente leitura nos logs.

| Verificação | Resultado |
|-------------|-----------|
| Container Evolution `StartedAt` | **2026-05-24** — **não** reiniciou em 17/06 |
| `RestartCount` | **0** |
| `OOMKilled` | **false** |
| Boot do host | **2026-02-23** (~114 dias uptime) |
| Redis / Postgres | Desde **2026-05-22**, `RestartCount: 0` |
| Logs 13:05–13:15 UTC | **34.101 linhas** — servidor ativo |
| Logs 13:09 UTC | `Sending message`, `connection.update`, `Closing session` — operação normal |
| Erros no dia | `Connection Closed` (428) por sessão; erros Chatwoot `ENOTFOUND pgvector` (ruído, não derrubou API) |

**Conclusão:** o incidente **não** foi queda/restart do servidor Evolution. Foi **estresse nas sessões WhatsApp** durante campanha, **agravado pelo failover** (já desligado).

---

## Veredito final (para próximo chat)

| Pergunta | Resposta |
|----------|----------|
| Desconexões eram reais? | **Sim** |
| Foi bug do AgilizeFlow/CRM? | **Não** |
| Servidor Evolution caiu? | **Não** (evidência Docker + webhooks) |
| Causa principal? | **Campanha Disparador 2** + sessões WhatsApp caindo sob uso |
| O que piorou? | **Failover** redistribuindo para chips bons (**desligado**) |
| Rodízio é o problema? | **Não** — o problema foi volume + chips caindo + failover empilhando carga |

### Sobre “menos chips no pool”

Não é a correção principal. Com failover desligado, o acúmulo nos chips bons **não deve repetir**. Manter no pool apenas chips **confirmados conectados** antes e durante a campanha é operação sensata; não significa abandonar rodízio com muitos chips quando todos estão saudáveis.

---

## Dados úteis para consultas SQL

Org IClass:

```sql
-- organization_id
'34086d07-9181-43fc-a3e8-6aa28974d68b'
```

Desconexões por minuto (BRT):

```sql
SELECT
  date_trunc('minute', occurred_at AT TIME ZONE 'America/Sao_Paulo') AS minuto_brt,
  COUNT(*) AS quedas
FROM instance_connection_events
WHERE organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
  AND event_kind = 'disconnect'
  AND occurred_at >= '2026-06-17'::date
GROUP BY 1 ORDER BY 1;
```

Script SQL completo: `scripts/diagnostico-servidor-vs-campanha-iclass.sql`

---

## Scripts e comandos do repositório

| Script / comando | Uso |
|------------------|-----|
| `npm run report:servidor-vs-campanha:iclass` | Relatório read-only (campanha × quedas × envios) |
| `python3 scripts/relatorio-servidor-vs-campanha-iclass.py --date 2026-06-17` | Mesmo relatório com data |
| `python3 scripts/relatorio-servidor-vs-campanha-iclass.py --json` | Export JSON |
| `npm run test:oscilacao:iclass` | Monitora flips de `is_connected` no Supabase |
| `scripts/diagnostico-evolution-robusto.py [org] --limit 3` | Amostra leve CRM vs Evolution (não varrer 42 chips) |
| `docs/GUIA-CORRECAO-EVOLUTION-API.md` | Guia geral Evolution + Disparador 2 |

### SSH Evolution (somente leitura — incidente)

```bash
ssh root@62.72.8.186
docker ps | grep evolution
docker inspect evolution_evolution.1.<id> --format '{{.State.StartedAt}} RestartCount={{.RestartCount}}'
docker logs evolution_evolution.1.<id> --since '2026-06-17T13:05:00' --until '2026-06-17T13:15:00' 2>&1 | tail -80
```

**Não commitar senhas SSH** no repositório. Credenciais ficam no painel Hostinger / gestão segura.

---

## Alterações de código (referência)

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-broadcast-queue-2/index.ts` | Removido failover entre chips ao falhar envio |
| `supabase/functions/process-scheduled-messages/index.ts` | Removido fallback para outra instância desconectada |
| `scripts/relatorio-servidor-vs-campanha-iclass.py` | Novo — relatório incidente |
| `scripts/diagnostico-servidor-vs-campanha-iclass.sql` | Novo — queries Supabase |
| `package.json` | `report:servidor-vs-campanha:iclass` |

Deploy: edge functions publicadas no Supabase (`process-broadcast-queue-2`, `process-scheduled-messages`). Commit: `c0c954c`.

---

## Comportamento esperado após correção

| Situação | Antes | Agora |
|----------|-------|-------|
| Chip cai no meio do disparo | Mensagem vai para outro chip | Mensagem **falha** na fila |
| Chip marcado desconectado (agendamento) | Usava outro chip da org | **Não envia** — erro explícito |
| Rodízio normal da campanha | Continua | **Continua** — cada mensagem mantém `instance_id` definido no agendamento |

---

## Pontos técnicos para investigações futuras

1. **`evolution_logs`** no dia 17/06: 977 eventos, todos `messages.upsert` — não grava `connection.update` nessa tabela.
2. **Tabela `instance_connection_events`**: histórico confiável de transições `disconnect`/`reconnect` (trigger em `evolution_config.is_connected`).
3. **Delay 1200–1600 s** na campanha vs **50+ envios/chip** no dia: volume real maior que o delay nominal sugere — investigar se failover + fila pré-atribuída explicam; após desligar failover, validar em nova campanha.
4. **Erro `pgvector` ENOTFOUND** nos logs Evolution — integração Chatwoot; corrigir DNS/serviço se necessário (não causou o incidente de desconexão em massa).
5. **Frontend**: health check desabilitado com `configs.length > 15` para evitar flips no DB em orgs grandes.

---

## Como usar este doc em um novo chat

Sugestão de prompt:

> Leia `docs/INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md` e [descreva a tarefa]. Contexto: IClass, org `34086d07-9181-43fc-a3e8-6aa28974d68b`, Evolution em `api.ordemservico.com`.

---

*Última atualização: investigação e consolidação pós-incidente 17/06/2026 — diagnóstico CRM, Supabase, SSH Evolution e desativação de failover.*
