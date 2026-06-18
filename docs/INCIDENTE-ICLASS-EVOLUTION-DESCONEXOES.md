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

## Plano cauteloso para instâncias mais estáveis

Não existe garantia técnica de manter sessões Baileys/Evolution conectadas indefinidamente, porque a conexão depende do WhatsApp Web, da reputação do número, da sessão salva e da rede. A estratégia mais segura é reduzir estímulos que pareçam automação agressiva, detectar instâncias frágeis antes do envio e parar cedo quando o padrão de queda aparece.

### 1. Regras de ouro confirmadas por documentação

| Tema | Decisão prática |
|------|-----------------|
| Fonte de verdade para disparo | Exigir `GET /instance/connectionState/{nome}` com `state = open`; `fetchInstances` pode ficar defasado |
| Estados transitórios | `connecting`, timeout ou resposta inconclusiva **não devem enviar** em campanha; também não devem marcar o chip como desconectado sem confirmação |
| `428 Connection Closed` | Tratar como perda de conexão/sessão; Evolution/Baileys pode tentar reconectar, mas a mensagem atual deve falhar sem failover |
| `401`, `403`, `406` | Tratar como problema permanente ou sessão inválida; remover do pool até reconectar QR/recriar instância |
| Webhooks | Manter `CONNECTION_UPDATE` ativo em todas as instâncias para atualizar o CRM em tempo real |
| Sessão persistida | Conferir no servidor Evolution se `DATABASE_SAVE_DATA_INSTANCE=true` e/ou `CACHE_REDIS_SAVE_INSTANCES=true` estão ativos |
| Conexão duplicada | Evitar o mesmo número conectado em outro WhatsApp Web/automação; múltiplas conexões do mesmo número podem substituir ou derrubar sessão |

Referências consultadas:

- Evolution API — Connection Management: `https://evolutionapi-evolution-api-90.mintlify.app/whatsapp/connections`
- Evolution API — Baileys Provider: `https://evolutionapi-evolution-api-90.mintlify.app/whatsapp/baileys`
- Baileys — Connection Lifecycle: `https://whiskeysockets-baileys-94.mintlify.app/concepts/connection`

### 2. Checklist obrigatório antes de campanha

1. Rodar diagnóstico leve:

```bash
./scripts/diagnostico-evolution-robusto.py 34086d07-9181-43fc-a3e8-6aa28974d68b --limit 3
```

2. Sincronizar somente as instâncias do grupo que será usado, não todas as 42.
3. Remover do pool qualquer instância com `close`, `connecting`, `qr`, `fantasma_lista` ou `fantasma_crm`.
4. Validar uma amostra pequena de contatos usando apenas chips `open`.
5. Iniciar campanha com rampa: poucos envios nos primeiros 15–30 minutos antes de liberar o volume completo.
6. Se houver várias quedas no arranque, pausar a campanha antes de continuar.

### 3. Limites conservadores recomendados

Como a queda aconteceu até com chips que tinham 0 ou 1 envio, o controle não deve olhar só “mensagens por chip no dia”. Precisa haver proteção contra pico, primeira onda e concentração silenciosa.

| Controle | Recomendação inicial |
|----------|----------------------|
| Primeira onda da campanha | No máximo 1 envio por instância nos primeiros 10–15 minutos |
| Taxa por organização | Limitar a poucos envios por minuto, mesmo com muitos chips no pool |
| Taxa por chip | Começar abaixo de 5 envios/hora por chip e aumentar só após evidência de estabilidade |
| Teto diário por chip | Manter teto baixo para números novos/frágeis; aumentar por histórico de sucesso, não por urgência |
| Pausa por erro 428 | Quarentena automática do chip por algumas horas; não realocar mensagens para outro chip |
| Pausa por rajada | Se 3+ instâncias caírem em poucos minutos, pausar campanha e exigir revisão manual |

Esses números são deliberadamente conservadores. A IClass teve chips caindo com baixa contagem individual, então o melhor ganho vem de rampa + pausa por rajada + remoção preventiva de instâncias frágeis.

### 4. Melhorias de produto a implementar

| Prioridade | Melhoria | Objetivo |
|------------|----------|----------|
| Alta | **Fail closed** no disparo quando `connectionState` for timeout/inconclusivo | Evitar enviar em sessão possivelmente instável sem marcar falso offline |
| Alta | Quarentena por instância após `Connection Closed` | Tirar chip do pool por cooldown configurável |
| Alta | Disjuntor de campanha por rajada de desconexões | Pausar automaticamente quando o padrão do incidente reaparecer |
| Média | Score de saúde por chip | Combinar quedas recentes, falhas, tempo desde reconexão e mensagens enviadas |
| Média | Rampa automática de campanha | Agendar início gradual em vez de liberar 200 itens prontos no primeiro processamento |
| Média | Painel “pronto para disparo” | Mostrar chips `open`, em quarentena, fantasmas e instáveis antes de iniciar |
| Baixa | Recomendação de reconexão QR guiada | Gerar lista operacional para reconectar apenas os chips realmente necessários |

Alteração aplicada após este diagnóstico: o `process-broadcast-queue-2` passou a exigir `connectionState=open` para enviar. Estados transitórios/inconclusivos (`connecting`, `qr`, timeout ou resposta indefinida) não são tratados como conectados nem como desconectados definitivos: o envio atual é reagendado com cooldown limitado. Só `close/closed` confirmado marca `is_connected=false` e falha a mensagem sem failover.

### 5. Recomendações para o servidor Evolution

1. Verificar persistência de sessão:
   - `DATABASE_SAVE_DATA_INSTANCE=true`
   - `CACHE_REDIS_ENABLED=true`
   - `CACHE_REDIS_SAVE_INSTANCES=true`
2. Confirmar que Postgres e Redis não reiniciam nem perdem dados de sessão.
3. Conferir se só há **1 réplica** ativa da Evolution para Baileys; múltiplas réplicas usando a mesma sessão podem gerar concorrência.
4. Manter `CONNECTION_UPDATE` e `QRCODE_UPDATED` ativos nos webhooks.
5. Corrigir o ruído `ENOTFOUND pgvector` da integração Chatwoot para reduzir erro operacional, mesmo não sendo a causa confirmada.
6. Testar upgrade controlado da Evolution fora de produção se houver loops de sessão/decriptação em `v2.3.7`; issues públicas indicam relatos de problemas nessa versão durante janelas de reconexão.

**Hardening aplicado em 18/06/2026** (`scripts/evolution-hardening-deploy.sh` no servidor `62.72.8.186`):

| Item | Antes | Depois |
|------|-------|--------|
| `CACHE_REDIS_SAVE_INSTANCES` | `false` | `true` |
| `CHATWOOT_IMPORT_DATABASE_CONNECTION_URI` | `@pgvector:5432/chatwoot` (host inexistente) | `@postgres:5432/chatwoot_nestor` |
| Imagem Evolution | `atendai/evolution-api:latest` no yaml | `evoapicloud/evolution-api:v2.3.7` (fixada) |
| Ruído `ENOTFOUND pgvector` | presente nos logs | **0** nos logs pós-deploy |
| Chaves Redis `evolution:instance:*` | ~270 (sem persistência de instância) | ~75 com TTL `-1` (persistente) |

Backup do yaml: `/root/evolution-hardening-backups/`. O `stack deploy` reinicia o container Evolution (~1–2 min de indisponibilidade); chips com sessão válida reconectam em background; chips já `close` ou com sessão expirada exigem novo QR. **Upgrade para v2.4.x não aplicado** — exige licença Evolution Foundation (`503 LICENSE_REQUIRED`).

### 6. Processo operacional mais seguro

1. Separar chips por maturidade: novos, estáveis, instáveis, quarentena.
2. Não misturar chips recém-reconectados em campanhas grandes no mesmo dia.
3. Usar mensagens com opt-in, variação legítima e identificação clara da empresa.
4. Evitar disparos frios para listas sem consentimento; bloqueios/denúncias reduzem reputação e aumentam risco de queda/ban.
5. Preferir WhatsApp Business Platform oficial para fluxos críticos que exigem estabilidade contratual, templates e limites previsíveis.

---

## Pontos técnicos para investigações futuras

1. **`evolution_logs`** no dia 17/06: 977 eventos, todos `messages.upsert` — não grava `connection.update` nessa tabela.
2. **Tabela `instance_connection_events`**: histórico confiável de transições `disconnect`/`reconnect` (trigger em `evolution_config.is_connected`).
3. **Delay 1200–1600 s** na campanha vs **50+ envios/chip** no dia: volume real maior que o delay nominal sugere — investigar se failover + fila pré-atribuída explicam; após desligar failover, validar em nova campanha.
4. **Erro `pgvector` ENOTFOUND** nos logs Evolution — **corrigido** em 18/06/2026 (URI Chatwoot apontava para host inexistente).
5. **Frontend**: health check desabilitado com `configs.length > 15` para evitar flips no DB em orgs grandes.

---

## Diagnóstico de bloqueios (script robusto)

`scripts/diagnostico-bloqueios-evolution.py` — read-only. Cruza, por data, os **logs reais do servidor Evolution** (lidos via SSH direto no `json.log` do container, porque `docker logs` trava nesse host) com o **CRM/Supabase** (`instance_connection_events`, `broadcast_campaigns_2`, `broadcast_queue_2`, `evolution_config`).

Classifica cada chip pelo **motivo Baileys** (`DisconnectReason`): `device_removed` (conflict → WhatsApp removeu o dispositivo vinculado), `401 loggedOut`, `403 forbidden`, `428 connectionClosed`, `440 connectionReplaced`, etc., e dá veredito + recomendações.

```bash
python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18
python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18 --json --save
python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18 --no-evolution   # só DB
```

Pré-requisito: `scripts/.evolution-ssh-credentials` (gitignored) com `EVOLUTION_SSH_HOST`, `EVOLUTION_SSH_USER`, `EVOLUTION_SSH_PASSWORD`, `EVOLUTION_CONTAINER`. **Servidor Evolution é `62.72.8.186`** (≠ CRM `95.217.2.116`).

**Achado confirmado (18/06/2026):** logs registram **`conflict` com `type: device_removed`** no pico da campanha (12:11–12:13 BRT) — o WhatsApp **remove o dispositivo vinculado** (sessão Evolution/Baileys), por isso o celular continua logado mas a instância cai. Motivos predominantes: `401 loggedOut` e `403 forbidden`. Não é falso status do CRM; o webhook apenas espelha o `close` enviado pela Evolution.

---

## Como usar este doc em um novo chat

Sugestão de prompt:

> Leia `docs/INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md` e [descreva a tarefa]. Contexto: IClass, org `34086d07-9181-43fc-a3e8-6aa28974d68b`, Evolution em `api.ordemservico.com`.

---

*Última atualização: 18/06/2026 — diagnóstico de bloqueios via SSH (device_removed/401/403 confirmados nos logs Evolution) + script `diagnostico-bloqueios-evolution.py`.*
