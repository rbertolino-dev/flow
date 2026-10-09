# Monitor de conexões WhatsApp — todas as organizações (sem QR)

Documento operacional para o time técnico. Monitora, tenta **auto-reconnect silencioso** e alerta desconexões de **todas** as empresas. **Não** gera nem exibe QR Code.

---

## Objetivo

Detectar quando uma sessão WhatsApp (Evolution) cai, tentar restaurar via `/instance/connect` sem QR, atualizar o CRM (`evolution_config.is_connected`) e, se não recuperar, abrir alerta no Super Admin — em qualquer organização.

## O que faz

- Consulta `connectionState` (fonte de verdade; evita falso `open` do `fetchInstances`)
- Atualiza `is_connected` no CRM
- Auto-reconnect silencioso: chama `/instance/connect` e **descarta** o QR da resposta
- Se voltar `open`: marca CRM conectado e resolve o alerta
- Se continuar `close` (precisa escanear): mantém alerta no Super Admin
- Cooldown de **30 minutos** entre tentativas na mesma instância
- Até **10** tentativas de reconnect por execução do cron (as demais ficam para o próximo ciclo)

## O que NÃO faz

- Não gera/exibe/salva QR Code
- Não envia link de reconexão para o cliente
- Não substitui o alerta com QR das Settings do cliente (fluxo separado)
- Não impede 100% quedas do WhatsApp (causa externa)

## Componentes

| Peça | Onde |
|------|------|
| Edge cron | `supabase/functions/monitor-evolution-connections-cron` |
| Tabela de alertas | `platform_connection_alerts` (+ `last_auto_reconnect_at`, `auto_reconnect_result`) |
| Snapshot Super Admin | RPC `get_platform_whatsapp_connection_snapshot()` |
| Painel | Super Admin → **Monitor Conexões WhatsApp** |
| Cron | `monitor-evolution-connections` a cada **10 minutos** |

## Fluxo

1. `pg_cron` chama a edge com service role.
2. A edge carrega todas as linhas de `evolution_config`.
3. Agrupa por servidor Evolution (`api_url` + `api_key`).
4. Para cada instância, consulta `connectionState`.
5. Se **open**: atualiza CRM e resolve alertas abertos.
6. Se **close**:
   - Marca CRM desconectado / garante alerta
   - Se fora do cooldown: `GET /instance/connect/{nome}` (ignora QR)
   - Poll `connectionState` ~15s
   - `restored` → CRM open + alerta resolvido
   - `needs_scan` / `error` → alerta permanece; grava resultado

## Painel Super Admin

Mostra:

- Totais: instâncias / conectadas / desconectadas / alertas abertos
- Tabela de desconectadas (todas as orgs)
- Alertas abertos com resultado do auto-reconnect e botão **Acknowledge**
- **Atualizar agora (live)** — executa a edge na hora

## Deploy / ativação

1. Migrations:
   - `20261009202000_platform_connection_alerts.sql`
   - `20261009213000_platform_alerts_auto_reconnect.sql`
2. Deploy da edge `monitor-evolution-connections-cron` (`verify_jwt = false`)
3. Cron: `scripts/configurar-cron-monitor-evolution-connections.sql` (a cada 10 min)
4. Confirmar: `SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'monitor-evolution-connections';`

## Runbook rápido

1. Abrir Super Admin → Monitor Conexões WhatsApp
2. Ver alertas com `needs_scan` — esses precisam de intervenção humana (escanear no celular)
3. Se necessário, clicar **Atualizar agora (live)** (respeita cooldown de 30 min)
4. Acknowledge após ciência
