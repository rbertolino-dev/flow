# Monitor de conexões WhatsApp — todas as organizações (sem QR)

Documento operacional para o time técnico. Monitora e alerta desconexões de **todas** as empresas. **Não** gera QR Code nem chama `/instance/connect`.

---

## Objetivo

Detectar quando uma sessão WhatsApp (Evolution) cai, atualizar o CRM (`evolution_config.is_connected`) e abrir alerta no Super Admin — em qualquer organização, não só em um cliente específico.

## O que NÃO faz

- Não gera QR Code
- Não chama `/instance/connect`
- Não envia link de reconexão
- Não substitui o alerta com QR das Settings do cliente (fluxo separado)

## Componentes

| Peça | Onde |
|------|------|
| Edge cron | `supabase/functions/monitor-evolution-connections-cron` |
| Tabela de alertas | `platform_connection_alerts` |
| Snapshot Super Admin | RPC `get_platform_whatsapp_connection_snapshot()` |
| Painel | Super Admin → **Monitor Conexões WhatsApp** |
| Cron | `monitor-evolution-connections` a cada **10 minutos** |

## Fluxo

1. `pg_cron` chama a edge com service role.
2. A edge carrega todas as linhas de `evolution_config`.
3. Agrupa por servidor Evolution (`api_url` + `api_key`).
4. Para cada instância, consulta `connectionState` (fonte de verdade; `fetchInstances` só como apoio).
5. Atualiza `is_connected` (throttle 45s, igual ao sync por org).
6. Se passou de **conectado → desconectado**: cria linha em `platform_connection_alerts` (sem QR).
7. Se voltou a **conectado**: marca alertas abertos com `resolved_at`.

## Painel Super Admin

Mostra:

- Totais: instâncias / conectadas / desconectadas / alertas abertos
- Tabela de desconectadas (todas as orgs)
- Alertas abertos com botão **Acknowledge** (só marca lido)
- **Atualizar agora (live)** — executa a edge na hora

## Deploy / ativação

1. Aplicar migration `20261009202000_platform_connection_alerts.sql`
2. Deploy da edge `monitor-evolution-connections-cron` (`verify_jwt = false`)
3. Agendar cron:
   - Isolado: `scripts/configurar-cron-monitor-evolution-connections.sql`
   - Ou conjunto: `scripts/configurar-cron-jobs-completo.sql` (job #10)
4. Confirmar: `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'monitor-evolution-connections';`

## Exemplo de incidente (Four Capital, 09/10/2026)

- Sintoma: mensagens do dia não chegavam no Chatwoot
- Causa: sessão WhatsApp `four capital anuncio` (evo 20) com `connectionState = close`
- Config Chatwoot estava OK; o gap era a sessão desconectada
- Este monitor existe para surfacer esse tipo de queda em **qualquer** org no Super Admin, sem depender de alguém abrir a org

## Runbook rápido

1. Abrir Super Admin → Monitor Conexões WhatsApp
2. Ver desconectadas / alertas abertos
3. Se necessário, clicar **Atualizar agora (live)**
4. Tratar reconexão operacionalmente na Evolution/CRM da org (fora deste painel)
5. Acknowledge no alerta após ciência
