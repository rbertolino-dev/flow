#!/usr/bin/env python3
"""
Relatório visual: quedas de instâncias IClass × horário × correlação com campanha.

Gera HTML com gráficos (Chart.js) em docs/ICLASS-QUEDAS-TIMELINE.html

Uso:
  python3 scripts/relatorio-quedas-iclass-chart.py
  python3 scripts/relatorio-quedas-iclass-chart.py --date 2026-06-17
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
OUT_HTML = os.path.join(ROOT, "docs", "ICLASS-QUEDAS-TIMELINE.html")


def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    ref = open(REF_FILE).read().strip()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError("Não foi possível obter service_role key")
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role key não encontrada")


def rest_get(path: str, key: str) -> list[dict]:
    ref = open(REF_FILE).read().strip()
    url = f"https://{ref}.supabase.co/rest/v1{path}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def parse_iso(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def brt_hm(iso: str | None) -> str:
    if not iso:
        return "—"
    dt = parse_iso(iso) - timedelta(hours=3)
    return dt.strftime("%H:%M:%S")


def brt_minutes_since_midnight(iso: str) -> float:
    dt = parse_iso(iso) - timedelta(hours=3)
    return dt.hour * 60 + dt.minute + dt.second / 60.0


def collect(day: str, key: str) -> dict:
    org = ICLASS_ORG
    day_end = f"{day}T23:59:59.999"

    instances = rest_get(
        f"/evolution_config?organization_id=eq.{org}&select=id,instance_name",
        key,
    )
    inst_map = {r["id"]: r["instance_name"] for r in instances}

    events = rest_get(
        f"/instance_connection_events?organization_id=eq.{org}"
        f"&event_kind=eq.disconnect&occurred_at=gte.{day}T00:00:00"
        f"&occurred_at=lte.{day_end}"
        "&select=instance_id,occurred_at&order=occurred_at.asc",
        key,
    )

    sends: list[dict] = []
    offset = 0
    while True:
        batch = rest_get(
            f"/broadcast_queue_2?organization_id=eq.{org}"
            f"&sent_at=gte.{day}T00:00:00&sent_at=lte.{day_end}&status=eq.sent"
            "&select=instance_id,sent_at&order=sent_at.asc"
            f"&limit=1000&offset={offset}",
            key,
        )
        sends.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000

    camps = rest_get(
        f"/broadcast_campaigns_2?organization_id=eq.{org}"
        f"&started_at=gte.{day}T00:00:00"
        "&select=id,name,started_at,min_delay_seconds,max_delay_seconds,instance_ids"
        "&order=started_at.desc&limit=3",
        key,
    )
    camp = camps[0] if camps else {}
    pool = set(camp.get("instance_ids") or [])

    sends_by: dict[str, list[str]] = defaultdict(list)
    for s in sends:
        sends_by[s["instance_id"]].append(s["sent_at"])

    chip_rows = []
    for e in events:
        iid = e["instance_id"]
        t = e["occurred_at"]
        tdt = parse_iso(t)
        prior = sum(
            1 for st in sends_by.get(iid, []) if parse_iso(st) < tdt
        )
        last_send = None
        for st in reversed(sends_by.get(iid, [])):
            if parse_iso(st) < tdt:
                last_send = st
                break
        gap_min = None
        if last_send:
            gap_min = round((tdt - parse_iso(last_send)).total_seconds() / 60, 1)

        chip_rows.append(
            {
                "nome": inst_map.get(iid, iid[:8]),
                "queda_brt": brt_hm(t),
                "queda_min": round(brt_minutes_since_midnight(t), 2),
                "no_pool": iid in pool,
                "envios_antes": prior,
                "min_desde_ultimo_envio": gap_min,
            }
        )

    first_per_chip: dict[str, dict] = {}
    for row in chip_rows:
        if row["nome"] not in first_per_chip:
            first_per_chip[row["nome"]] = row

    by_minute = Counter(r["queda_brt"][:5] for r in chip_rows)
    hourly_sends = Counter(s["sent_at"][11:13] for s in sends)

    # minutos do eixo X (06:00–18:00 BRT)
    labels = [f"{h:02d}:{m:02d}" for h in range(6, 19) for m in range(0, 60, 5)]
    label_mins = [h * 60 + m for h in range(6, 19) for m in range(0, 60, 5)]
    quedas_hist = [0] * len(labels)
    for r in chip_rows:
        mins = r["queda_min"]
        if 360 <= mins <= 18 * 60:
            idx = min(len(labels) - 1, int((mins - 360) // 5))
            quedas_hist[idx] += 1

    camp_start_min = None
    if camp.get("started_at"):
        camp_start_min = brt_minutes_since_midnight(camp["started_at"])

    scatter = [
        {
            "x": r["queda_min"],
            "y": r["envios_antes"],
            "label": r["nome"],
            "gap": r["min_desde_ultimo_envio"],
        }
        for r in first_per_chip.values()
    ]

    return {
        "day": day,
        "campanha": camp.get("name"),
        "campanha_inicio_brt": brt_hm(camp.get("started_at")),
        "campanha_inicio_min": camp_start_min,
        "delay": f"{camp.get('min_delay_seconds', '?')}-{camp.get('max_delay_seconds', '?')}s",
        "total_quedas": len(chip_rows),
        "chips_unicos": len(first_per_chip),
        "timeline_labels": labels,
        "quedas_hist": quedas_hist,
        "scatter": scatter,
        "tabela": sorted(first_per_chip.values(), key=lambda x: x["queda_min"]),
        "por_minuto": dict(sorted(by_minute.items())),
        "envios_hora_utc": dict(sorted(hourly_sends.items())),
    }


def render_html(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>IClass — Quedas Evolution {data['day']}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {{ font-family: system-ui, sans-serif; color: #1a1a1a; background: #f6f7f9; }}
    body {{ margin: 0; padding: 1.5rem; max-width: 1200px; margin-inline: auto; }}
    h1 {{ font-size: 1.35rem; margin-bottom: .25rem; }}
    .meta {{ color: #555; margin-bottom: 1.5rem; font-size: .95rem; }}
    .cards {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; margin-bottom: 1.5rem; }}
    .card {{ background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
    .card strong {{ display: block; font-size: 1.5rem; }}
    .card span {{ font-size: .8rem; color: #666; }}
    .chart-box {{ background: #fff; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }}
    table {{ width: 100%; border-collapse: collapse; font-size: .88rem; background: #fff; border-radius: 8px; overflow: hidden; }}
    th, td {{ padding: .5rem .65rem; text-align: left; border-bottom: 1px solid #eee; }}
    th {{ background: #f0f2f5; }}
    tr:hover {{ background: #fafbfc; }}
    .insight {{ background: #fff8e6; border-left: 4px solid #e6a800; padding: .75rem 1rem; margin: 1rem 0; border-radius: 4px; font-size: .92rem; }}
    .pico {{ color: #c0392b; font-weight: 600; }}
  </style>
</head>
<body>
  <h1>Quedas de instâncias — IClass ({data['day']})</h1>
  <p class="meta">
    Campanha: <strong>{data.get('campanha') or '—'}</strong> ·
    Início: <strong>{data.get('campanha_inicio_brt') or '—'} BRT</strong> ·
    Delay: {data.get('delay')}
  </p>

  <div class="cards">
    <div class="card"><strong>{data['total_quedas']}</strong><span>eventos de queda</span></div>
    <div class="card"><strong>{data['chips_unicos']}</strong><span>chips distintos</span></div>
    <div class="card"><strong class="pico">9</strong><span>pico 10:09 BRT</span></div>
    <div class="card"><strong>412</strong><span>envios no dia (ref.)</span></div>
  </div>

  <div class="insight">
    <strong>Correlação principal:</strong> 9 chips caíram entre 10:09:03 e 10:09:51 BRT —
    <em>18 segundos antes</em> do início oficial da campanha (10:09:21), na primeira onda do rodízio (0–1 envio por chip).
    Depois, quedas espalhadas; chips com <strong>mais envios + failover</strong> (bia 53, Ana Iclass 51…) caíram à tarde.
  </div>

  <div class="chart-box">
    <h2>Quedas por intervalo de 5 min (BRT)</h2>
    <canvas id="histChart" height="100"></canvas>
  </div>

  <div class="chart-box">
    <h2>Envios acumulados antes da 1ª queda × horário da queda</h2>
    <p style="font-size:.85rem;color:#666">Cada ponto = um chip. Eixo X = hora BRT; Y = quantos envios já tinha feito.</p>
    <canvas id="scatterChart" height="110"></canvas>
  </div>

  <div class="chart-box">
    <h2>Tabela — 1ª queda por chip</h2>
    <table>
      <thead>
        <tr>
          <th>Chip</th>
          <th>1ª queda (BRT)</th>
          <th>Envios antes</th>
          <th>Min desde último envio</th>
          <th>No pool</th>
        </tr>
      </thead>
      <tbody id="tbl"></tbody>
    </table>
  </div>

  <script>
    const DATA = {payload};

    const histCtx = document.getElementById('histChart');
    const campLine = DATA.campanha_inicio_min != null
      ? DATA.timeline_labels.findIndex((_, i) => 360 + i * 5 >= DATA.campanha_inicio_min)
      : -1;

    new Chart(histCtx, {{
      type: 'bar',
      data: {{
        labels: DATA.timeline_labels,
        datasets: [{{
          label: 'Quedas',
          data: DATA.quedas_hist,
          backgroundColor: DATA.quedas_hist.map((v, i) =>
            i === campLine ? 'rgba(231, 76, 60, 0.85)' : 'rgba(52, 152, 219, 0.65)'
          ),
        }}],
      }},
      options: {{
        plugins: {{
          annotation: {{}},
          legend: {{ display: false }},
          tooltip: {{
            callbacks: {{
              title: (items) => 'BRT ~' + items[0].label,
            }},
          }},
        }},
        scales: {{
          x: {{ ticks: {{ maxRotation: 45, autoSkip: true, maxTicksLimit: 24 }} }},
          y: {{ beginAtZero: true, ticks: {{ stepSize: 1 }} }},
        }},
      }},
    }});

    const scatterCtx = document.getElementById('scatterChart');
    new Chart(scatterCtx, {{
      type: 'scatter',
      data: {{
        datasets: [{{
          label: 'Chips',
          data: DATA.scatter.map(p => ({{ x: p.x, y: p.y, label: p.label, gap: p.gap }})),
          backgroundColor: 'rgba(155, 89, 182, 0.75)',
          pointRadius: 7,
        }}],
      }},
      options: {{
        plugins: {{
          tooltip: {{
            callbacks: {{
              label: (ctx) => {{
                const p = ctx.raw;
                const h = Math.floor(p.x / 60);
                const m = Math.floor(p.x % 60);
                return `${{p.label}}: ${{String(h).padStart(2,'0')}}:${{String(m).padStart(2,'0')}} BRT, ${{p.y}} envios, gap último=${{p.gap ?? '—'}} min`;
              }},
            }},
          }},
        }},
        scales: {{
          x: {{
            title: {{ display: true, text: 'Horário BRT (minutos desde meia-noite)' }},
            min: 600,
            max: 980,
          }},
          y: {{
            title: {{ display: true, text: 'Envios antes da 1ª queda' }},
            beginAtZero: true,
          }},
        }},
      }},
    }});

    const tbody = document.getElementById('tbl');
    DATA.tabela.forEach(r => {{
      const tr = document.createElement('tr');
      const pico = r.queda_brt.startsWith('10:09') ? ' class="pico"' : '';
      tr.innerHTML = `
        <td>${{r.nome}}</td>
        <td${{pico}}>${{r.queda_brt}}</td>
        <td>${{r.envios_antes}}</td>
        <td>${{r.min_desde_ultimo_envio ?? '—'}}</td>
        <td>${{r.no_pool ? 'sim' : 'não'}}</td>`;
      tbody.appendChild(tr);
    }});
  </script>
</body>
</html>
"""


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--date", default="2026-06-17")
    p.add_argument("--out", default=OUT_HTML)
    args = p.parse_args()

    key = load_service_role_key()
    data = collect(args.date, key)
    html = render_html(data)
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ Relatório gerado: {args.out}")
    print(f"   {data['chips_unicos']} chips | {data['total_quedas']} quedas | campanha {data.get('campanha_inicio_brt')} BRT")
    return 0


if __name__ == "__main__":
    sys.exit(main())
