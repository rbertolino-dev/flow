-- =============================================================================
-- Diagnóstico: servidor Evolution vs campanha (IClass Sistemas)
-- Somente leitura — não chama Evolution API
-- Org: 34086d07-9181-43fc-a3e8-6aa28974d68b
-- =============================================================================

-- 1) Resumo do dia (desconexões por minuto — horário Brasília)
SELECT
  '1_quedas_por_minuto_brt' AS secao,
  date_trunc('minute', e.occurred_at AT TIME ZONE 'America/Sao_Paulo') AS minuto_brt,
  COUNT(*)::text AS total_quedas
FROM instance_connection_events e
WHERE e.organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
  AND e.event_kind = 'disconnect'
  AND e.occurred_at >= CURRENT_DATE
GROUP BY 2
ORDER BY 2;

-- 2) Outras organizações caíram no pico (~10:09 BRT = 13:09 UTC)?
SELECT
  '2_outras_orgs_mesmo_pico' AS secao,
  o.name AS organizacao,
  COUNT(*)::text AS quedas_no_pico
FROM instance_connection_events e
JOIN organizations o ON o.id = e.organization_id
WHERE e.event_kind = 'disconnect'
  AND e.occurred_at >= date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 8 minutes'
  AND e.occurred_at <  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 11 minutes'
GROUP BY o.name
ORDER BY COUNT(*) DESC;

-- 3) Campanhas Disparador 2 hoje
SELECT
  '3_campanhas_hoje' AS secao,
  c.name AS campanha,
  c.status,
  c.started_at AT TIME ZONE 'America/Sao_Paulo' AS inicio_brt,
  COALESCE(c.sent_count, 0)::text AS enviadas,
  COALESCE(c.failed_count, 0)::text AS falhas,
  COALESCE(c.total_contacts, 0)::text AS total_contatos,
  c.sending_method,
  COALESCE(array_length(c.instance_ids, 1), 0)::text AS chips_no_pool
FROM broadcast_campaigns_2 c
WHERE c.organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
  AND (
    c.started_at >= CURRENT_DATE
    OR c.updated_at >= CURRENT_DATE
    OR c.status IN ('running', 'paused')
  )
ORDER BY c.started_at DESC NULLS LAST;

-- 4) Cruzamento: chip × quedas hoje × envios hoje × status atual
WITH disc AS (
  SELECT
    instance_id,
    MIN(occurred_at) AS primeira_queda_utc,
    COUNT(*) AS vezes_caiu_hoje
  FROM instance_connection_events
  WHERE organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND event_kind = 'disconnect'
    AND occurred_at >= CURRENT_DATE
  GROUP BY instance_id
),
sends AS (
  SELECT
    q.instance_id,
    COUNT(*) FILTER (WHERE q.status = 'sent') AS envios_ok,
    COUNT(*) FILTER (WHERE q.status = 'failed') AS envios_falha
  FROM broadcast_queue_2 q
  WHERE q.organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND q.sent_at >= CURRENT_DATE
  GROUP BY q.instance_id
),
pool AS (
  SELECT unnest(instance_ids) AS instance_id
  FROM broadcast_campaigns_2
  WHERE organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND status = 'running'
  LIMIT 1
)
SELECT
  '4_chip_detalhe' AS secao,
  ec.instance_name AS chip,
  CASE WHEN ec.is_connected THEN 'ON' ELSE 'OFF' END AS agora,
  CASE WHEN p.instance_id IS NOT NULL THEN 'sim' ELSE 'nao' END AS no_pool_campanha,
  COALESCE(s.envios_ok, 0)::text AS envios_ok,
  COALESCE(s.envios_falha, 0)::text AS envios_falha,
  COALESCE(d.vezes_caiu_hoje, 0)::text AS quedas_hoje,
  (d.primeira_queda_utc AT TIME ZONE 'America/Sao_Paulo')::text AS primeira_queda_brt
FROM evolution_config ec
LEFT JOIN disc d ON d.instance_id = ec.id
LEFT JOIN sends s ON s.instance_id = ec.id
LEFT JOIN pool p ON p.instance_id = ec.id
WHERE ec.organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
ORDER BY COALESCE(s.envios_ok, 0) DESC, COALESCE(d.vezes_caiu_hoje, 0) DESC, ec.instance_name;

-- 5) Envios por hora (BRT) hoje
SELECT
  '5_envios_por_hora_brt' AS secao,
  date_trunc('hour', q.sent_at AT TIME ZONE 'America/Sao_Paulo') AS hora_brt,
  COUNT(*)::text AS envios
FROM broadcast_queue_2 q
WHERE q.organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
  AND q.status = 'sent'
  AND q.sent_at >= CURRENT_DATE
GROUP BY 2
ORDER BY 2;

-- 6) Veredito automático (heurística)
WITH pico AS (
  SELECT COUNT(*) AS n
  FROM instance_connection_events
  WHERE event_kind = 'disconnect'
    AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 8 minutes'
    AND occurred_at <  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 11 minutes'
),
pico_outras AS (
  SELECT COUNT(DISTINCT organization_id) AS orgs
  FROM instance_connection_events
  WHERE event_kind = 'disconnect'
    AND organization_id <> '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND occurred_at >= date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 8 minutes'
    AND occurred_at <  date_trunc('day', now() AT TIME ZONE 'UTC') + interval '13 hours 11 minutes'
),
camp AS (
  SELECT started_at
  FROM broadcast_campaigns_2
  WHERE organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND started_at >= CURRENT_DATE
  ORDER BY started_at ASC
  LIMIT 1
),
primeira_queda AS (
  SELECT MIN(occurred_at) AS t
  FROM instance_connection_events
  WHERE organization_id = '34086d07-9181-43fc-a3e8-6aa28974d68b'
    AND event_kind = 'disconnect'
    AND occurred_at >= CURRENT_DATE
)
SELECT
  '6_veredito' AS secao,
  (SELECT n FROM pico)::text AS quedas_pico_10h09_brt,
  (SELECT orgs FROM pico_outras)::text AS outras_orgs_no_pico,
  (SELECT started_at AT TIME ZONE 'America/Sao_Paulo' FROM camp)::text AS campanha_inicio_brt,
  (SELECT t AT TIME ZONE 'America/Sao_Paulo' FROM primeira_queda)::text AS primeira_queda_iclass_brt,
  CASE
    WHEN (SELECT orgs FROM pico_outras) > 0 THEN 'FORTE: servidor Evolution (várias orgs no mesmo minuto)'
    WHEN (SELECT n FROM pico) >= 5
     AND (SELECT started_at FROM camp) IS NOT NULL
     AND abs(extract(epoch FROM (SELECT t FROM primeira_queda) - (SELECT started_at FROM camp))) < 120
      THEN 'MISTO: pico coincide com início da campanha (servidor OU arranque do disparo)'
    WHEN (SELECT n FROM pico) >= 5 THEN 'POSSÍVEL: evento em massa na IClass (servidor ou 1ª onda campanha)'
    ELSE 'FRACO: quedas espalhadas — mais campanha/WhatsApp que servidor'
  END AS interpretacao;
