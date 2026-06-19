# Checklist — Campanha WhatsApp (Disparador 2)

Use **antes** e **depois** de campanhas grandes (rotate, 10+ chips). Sem quarentena automática de chips.

Relacionado: [INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md](INCIDENTE-ICLASS-EVOLUTION-DESCONEXOES.md) | [INCIDENTE-EVOLUTION-RUNBOOK-OPERACIONAL.md](INCIDENTE-EVOLUTION-RUNBOOK-OPERACIONAL.md)

---

## Antes da campanha

### Servidor Evolution

- [ ] Nenhum deploy / `stack deploy` programado nas próximas horas
- [ ] `CACHE_REDIS_SAVE_INSTANCES=false` confirmado no serviço
- [ ] API responde 200: `https://api.ordemservico.com/`
- [ ] Contagem `open` no Postgres aceitável para o pool planejado

### Diagnóstico (recomendado)

```bash
cd /root/kanban-buzz-95241
python3 scripts/diagnostico-bloqueios-evolution.py --date $(date +%Y-%m-%d) --save
```

- [ ] Sem pico recente de `device_removed` / 401 / 403
- [ ] Relatório salvo em `test-results/diagnostico-bloqueios-*.json`

### Pool de chips (CRM → Disparador 2)

- [ ] Sincronizar status (botão ou sync automático em orgs grandes)
- [ ] Remover do pool chips `close` ou com QR pendente
- [ ] Preferir chips estáveis (conectados há dias, sem queda recente)
- [ ] **Não** incluir chips recém-reconectados no mesmo dia de campanha grande
- [ ] Pool rotate: rampa conservadora ativa (automática com 10+ chips)

### Parâmetros da campanha

- [ ] Delay mínimo ≥ 1200s recomendado para pools > 20 chips
- [ ] Janela de horário comercial respeitada
- [ ] Mensagem com identificação clara + opt-in quando aplicável
- [ ] Failover desligado (padrão atual D2)

### Arranque

- [ ] Confirmar dialog de instâncias desconectadas (se aparecer)
- [ ] 1ª onda: máximo **1 envio por chip** nos primeiros ~15 min (rampa automática)
- [ ] Monitorar primeiros 10 min: se 3+ chips caírem, **pausar campanha manualmente**

---

## Durante a campanha

- [ ] Observar painel de instâncias (open / connecting / close)
- [ ] Se rajada de quedas: pausar campanha e investigar antes de retomar
- [ ] Não reconectar dezenas de chips em massa enquanto campanha roda

---

## Depois da campanha

### Diagnóstico pós-campanha

```bash
python3 scripts/diagnostico-bloqueios-evolution.py --date $(date +%Y-%m-%d) --save
```

- [ ] Comparar `open` antes vs depois
- [ ] Listar chips que caíram (`instance_connection_events`)
- [ ] Registrar envios OK vs falha na fila (`broadcast_queue_2`)

### Ações pós-campanha

- [ ] Reconectar QR **apenas** nos chips realmente `close` (lista do diagnóstico)
- [ ] Não iniciar nova campanha no mesmo dia se houve rajada de quedas
- [ ] Documentar incidente se 5+ chips caíram no arranque

---

## Comandos úteis

| Comando | O que faz |
|---------|-----------|
| `diagnostico-bloqueios-evolution.py --date YYYY-MM-DD` | Cruza logs Evolution + CRM |
| `diagnostico-bloqueios-evolution.py --no-evolution` | Só dados CRM/Supabase |
| `relatorio-servidor-vs-campanha-iclass.py` | Relatório org IClass |

---

## Sinais de alerta (pausar campanha)

| Sinal | Ação |
|-------|------|
| 3+ `disconnect` em 5 min | Pausar campanha |
| `device_removed` nos logs | Pausar; revisar pool |
| Muitos chips `connecting` > 15 min | Verificar Evolution (runbook) |
| Envios falhando com Connection Closed | Pausar; sync status |

*Última atualização: 2026-06-18*
