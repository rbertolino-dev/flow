#!/usr/bin/env python3
"""
Diagnóstico ROBUSTO de bloqueios/desconexões — Evolution API + CRM (Disparador 2).

Cruza, para uma data:
  1. Logs reais do servidor Evolution (lidos via SSH direto no json.log do container,
     porque `docker logs` trava nesse host) — extrai motivos Baileys:
       - conflict / device_removed (WhatsApp removeu o dispositivo vinculado)
       - connection.update state=close + statusReason (401 loggedOut, 403 forbidden,
         440 connectionReplaced, 408 timedOut, 515 restartRequired, 500 badSession, 503)
       - Connection Closed (428) no envio
       - opened connection (reconexões)
  2. Supabase / CRM Disparador 2:
       - instance_connection_events (quedas registradas)
       - broadcast_campaigns_2 (campanha do dia, pool de chips, janela)
       - broadcast_queue_2 (envios ok/falha por chip + failure_code)
       - evolution_config (estado atual)

Saída: relatório por chip com MOTIVO do bloqueio (Baileys) + correlação com envio,
veredito e recomendações. Use --json para saída estruturada.

Somente leitura. Não chama a Evolution API (zero carga nos chips) — usa apenas logs + DB.

Uso:
  python3 scripts/diagnostico-bloqueios-evolution.py
  python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18
  python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18 --org ORG_ID --json
  python3 scripts/diagnostico-bloqueios-evolution.py --date 2026-06-18 --save

Pré-requisito: scripts/.evolution-ssh-credentials (gitignored) com:
  EVOLUTION_SSH_HOST, EVOLUTION_SSH_USER, EVOLUTION_SSH_PASSWORD, EVOLUTION_CONTAINER
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
EVO_CRED_FILE = os.path.join(ROOT, "scripts", ".evolution-ssh-credentials")

# Enum oficial Baileys (DisconnectReason) → significado e ação
BAILEYS_REASON = {
    "401": ("loggedOut", "Sessão deslogada/invalidada — re-scan QR", "NÃO reconectar sozinho"),
    "403": ("forbidden", "Acesso negado pelo WhatsApp à sessão (risco/restrição)", "Revisar chip"),
    "408": ("timedOut/connectionLost", "Timeout ou perda de rede", "Reconectar"),
    "411": ("multideviceMismatch", "Incompatibilidade multi-device", "Atualizar lib/Evolution"),
    "428": ("connectionClosed", "Socket fechou (geralmente durante envio)", "Reconectar"),
    "440": ("connectionReplaced", "Outra conexão assumiu a sessão (duplicidade)", "Evitar sessão dupla"),
    "500": ("badSession", "Sessão corrompida", "Re-autenticar (QR)"),
    "503": ("unavailableService", "WhatsApp indisponível temporariamente", "Reconectar"),
    "515": ("restartRequired", "WhatsApp pediu restart da sessão", "Reconectar"),
}


# ----------------------------- credenciais Evolution -----------------------------
def load_evo_credentials() -> dict:
    if not os.path.exists(EVO_CRED_FILE):
        raise SystemExit(
            f"❌ Credencial Evolution não encontrada: {EVO_CRED_FILE}\n"
            "Crie o arquivo com EVOLUTION_SSH_HOST / EVOLUTION_SSH_USER / "
            "EVOLUTION_SSH_PASSWORD / EVOLUTION_CONTAINER."
        )
    creds: dict[str, str] = {}
    with open(EVO_CRED_FILE) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            creds[k.strip()] = v
    for req in ("EVOLUTION_SSH_HOST", "EVOLUTION_SSH_USER", "EVOLUTION_SSH_PASSWORD"):
        if not creds.get(req):
            raise SystemExit(f"❌ {req} ausente em {EVO_CRED_FILE}")
    return creds


# ----------------------------- Supabase REST -----------------------------
def load_service_role_key() -> str:
    env = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if env:
        return env
    ref = open(REF_FILE).read().strip()
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", ref],
        capture_output=True, text=True, cwd=ROOT, timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError("Não foi possível obter service_role key (supabase CLI)")
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise RuntimeError("service_role key não encontrada")


def rest_get(path: str, key: str) -> list[dict]:
    import urllib.request

    ref = open(REF_FILE).read().strip()
    url = f"https://{ref}.supabase.co/rest/v1{path}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


# ----------------------------- parser remoto (roda no servidor Evolution) -----------------------------
# Recebe a data (YYYY-MM-DD) como argv[1] e o nome do container como argv[2] (opcional).
# Lê o json.log do container direto (docker logs trava neste host) e emite JSON em stdout.
REMOTE_PARSER = r'''
import sys, os, json, re, glob
from collections import Counter, defaultdict

date = sys.argv[1] if len(sys.argv) > 1 else ""
container_hint = sys.argv[2] if len(sys.argv) > 2 else ""

def find_container_id():
    # Tenta pelo hint (nome) primeiro, depois qualquer container com 'evolution' no nome.
    import subprocess
    names = []
    if container_hint:
        names.append(container_hint)
    try:
        out = subprocess.run(["docker","ps","--format","{{.Names}}"], capture_output=True, text=True, timeout=30).stdout
        for n in out.splitlines():
            if "evolution" in n.lower() and n not in names:
                names.append(n)
    except Exception:
        pass
    for n in names:
        try:
            cid = subprocess.run(["docker","inspect","-f","{{.Id}}",n], capture_output=True, text=True, timeout=30).stdout.strip()
            if cid:
                return cid, n
        except Exception:
            continue
    return None, None

cid, cname = find_container_id()
if not cid:
    print(json.dumps({"error":"container evolution não encontrado"})); sys.exit(0)

logfiles = sorted(glob.glob(f"/var/lib/docker/containers/{cid}/{cid}-json.log*"))
if not logfiles:
    print(json.dumps({"error":f"json.log não encontrado para {cid}"})); sys.exit(0)

inst_banner = re.compile(r"\[Evolution API\].*?\[([^\]]+)\]\s+v2")
inst_inline = re.compile(r"instance:\s*'([^']+)'")
reason_re   = re.compile(r"statusReason:\s*(\d+)")
statuscode_re = re.compile(r'"statusCode":(\d+)')

events = []          # cada: {ts, instance, kind, reason}
device_removed = []  # ts list (precisa retro p/ instância)
lines_cache = []     # buffer p/ inferir instância dos device_removed

# Para inferir instância dos eventos sem nome (conflict/device_removed),
# guardamos a última instância citada por proximidade.
def process_file(path):
    last_inst = None
    # janela de inferência retroativa simples: mantém últimas instâncias vistas
    for raw in open(path, "r", errors="replace"):
        try:
            o = json.loads(raw)
        except Exception:
            continue
        if not isinstance(o, dict):
            continue
        ts = o.get("time", "")
        if date and not ts.startswith(date):
            continue
        log = o.get("log", "")
        if not log:
            continue

        m = inst_banner.search(log)
        if m:
            last_inst = m.group(1).strip()
        else:
            m2 = inst_inline.search(log)
            if m2:
                last_inst = m2.group(1).strip()

        low = log.lower()

        # state=close + reason
        if "state: 'close'" in log or 'state: "close"' in log:
            mi = inst_inline.search(log)
            inst = mi.group(1).strip() if mi else last_inst
            mr = reason_re.search(log)
            reason = mr.group(1) if mr else "?"
            events.append({"ts": ts, "instance": inst, "kind": "close", "reason": reason})

        # device_removed (conflict)
        if "device_removed" in log or ('"tag":"conflict"' in log):
            mc = statuscode_re.search(log)
            reason = mc.group(1) if mc else "?"
            events.append({"ts": ts, "instance": last_inst, "kind": "device_removed", "reason": reason})

        # Connection Closed (428) no envio
        if '"message":"Connection Closed"' in log or "Connection Closed" in log:
            mc = statuscode_re.search(log)
            reason = mc.group(1) if mc else "428"
            events.append({"ts": ts, "instance": last_inst, "kind": "connection_closed", "reason": reason})

        # reconexão
        if "opened connection" in low or "connected to whatsapp" in low:
            events.append({"ts": ts, "instance": last_inst, "kind": "opened", "reason": ""})

        # stream:error genérico
        if '"tag":"stream:error"' in log and "device_removed" not in log:
            mc = statuscode_re.search(log)
            reason = mc.group(1) if mc else "?"
            events.append({"ts": ts, "instance": last_inst, "kind": "stream_error", "reason": reason})

for path in logfiles:
    process_file(path)

# resumo
by_kind = Counter(e["kind"] for e in events)
close_by_reason = Counter(e["reason"] for e in events if e["kind"] == "close")
by_minute = Counter(e["ts"][11:16] for e in events if e["kind"] in ("close","device_removed","connection_closed"))

print(json.dumps({
    "container": cname,
    "logfiles": logfiles,
    "events": events,
    "summary": {
        "by_kind": dict(by_kind),
        "close_by_reason": dict(close_by_reason),
        "by_minute_utc": dict(by_minute),
    }
}))
'''


def run_remote_parser(creds: dict, date: str) -> dict:
    container = creds.get("EVOLUTION_CONTAINER", "")
    cmd = [
        "sshpass", "-e", "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=20",
        f"{creds['EVOLUTION_SSH_USER']}@{creds['EVOLUTION_SSH_HOST']}",
        "python3", "-", date, container,
    ]
    env = {**os.environ, "SSHPASS": creds["EVOLUTION_SSH_PASSWORD"]}
    proc = subprocess.run(
        cmd, input=REMOTE_PARSER, env=env,
        capture_output=True, text=True, timeout=240,
    )
    if proc.returncode != 0:
        raise SystemExit(
            f"❌ SSH/parse Evolution falhou (rc={proc.returncode}).\n"
            f"stderr: {proc.stderr[:400]}"
        )
    out = proc.stdout.strip()
    # a última linha deve ser o JSON
    last = out.splitlines()[-1] if out else ""
    try:
        return json.loads(last)
    except json.JSONDecodeError:
        raise SystemExit(f"❌ Resposta remota inválida: {out[:400]}")


# ----------------------------- helpers -----------------------------
def brt(iso: str | None) -> str:
    if not iso:
        return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (dt - timedelta(hours=3)).strftime("%H:%M:%S")
    except Exception:
        return iso[11:19] if len(iso) >= 19 else iso


def classify_block(reasons: Counter, kinds: Counter) -> tuple[str, str]:
    """Retorna (severidade, motivo legível) priorizando o pior sinal."""
    if kinds.get("device_removed", 0) > 0:
        return ("CRÍTICO", "DISPOSITIVO REMOVIDO pelo WhatsApp (conflict device_removed) — provável banimento/limpeza de sessão")
    if reasons.get("401", 0) > 0:
        return ("ALTO", "Sessão deslogada (401 loggedOut) — precisa re-scan QR")
    if reasons.get("403", 0) > 0:
        return ("ALTO", "Acesso negado (403 forbidden) — restrição do WhatsApp à sessão")
    if reasons.get("440", 0) > 0:
        return ("MÉDIO", "Sessão substituída (440) — número conectado em outro lugar")
    if kinds.get("connection_closed", 0) > 0 or reasons.get("428", 0) > 0:
        return ("MÉDIO", "Socket fechou no envio (428 connectionClosed)")
    if reasons.get("515", 0) > 0:
        return ("BAIXO", "Restart de sessão (515) — normal após pareamento")
    if reasons.get("408", 0) > 0:
        return ("BAIXO", "Timeout/perda de rede (408)")
    if kinds.get("close", 0) > 0:
        return ("BAIXO", "Fechamento sem motivo claro")
    return ("—", "Sem evento de bloqueio nos logs")


# ----------------------------- main -----------------------------
def main() -> int:
    p = argparse.ArgumentParser(description="Diagnóstico robusto de bloqueios Evolution + CRM")
    p.add_argument("--org", default=ICLASS_ORG)
    p.add_argument("--date", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    p.add_argument("--json", action="store_true", help="Saída JSON estruturada")
    p.add_argument("--save", action="store_true", help="Salvar JSON em test-results/")
    p.add_argument("--no-evolution", action="store_true", help="Pular logs Evolution (só DB)")
    args = p.parse_args()

    org, day = args.org, args.date

    # ---- 1. Logs Evolution ----
    evo = {"events": [], "summary": {}, "error": "pulado (--no-evolution)"}
    if not args.no_evolution:
        creds = load_evo_credentials()
        print(f"🔌 Conectando ao servidor Evolution ({creds['EVOLUTION_SSH_HOST']})...", file=sys.stderr)
        evo = run_remote_parser(creds, day)
        if evo.get("error"):
            print(f"⚠️  Evolution: {evo['error']}", file=sys.stderr)

    evo_events = evo.get("events", [])
    # agrupa por instância
    evo_by_inst: dict[str, dict] = defaultdict(lambda: {"reasons": Counter(), "kinds": Counter(), "first": None, "events": []})
    for e in evo_events:
        inst = (e.get("instance") or "?").strip()
        slot = evo_by_inst[inst]
        slot["kinds"][e["kind"]] += 1
        if e["kind"] == "close":
            slot["reasons"][e.get("reason", "?")] += 1
        if e["kind"] in ("close", "device_removed", "connection_closed"):
            if slot["first"] is None or e["ts"] < slot["first"]:
                slot["first"] = e["ts"]
        slot["events"].append(e)

    # ---- 2. Supabase ----
    key = load_service_role_key()
    day_end = f"{day}T23:59:59.999"

    instances = rest_get(
        f"/evolution_config?organization_id=eq.{org}"
        "&select=id,instance_name,is_connected&order=instance_name.asc",
        key,
    )
    inst_by_name = {r["instance_name"]: r for r in instances}
    inst_by_id = {r["id"]: r for r in instances}

    events_db = rest_get(
        f"/instance_connection_events?organization_id=eq.{org}"
        f"&event_kind=eq.disconnect&occurred_at=gte.{day}T00:00:00&occurred_at=lte.{day_end}"
        "&select=instance_id,occurred_at&order=occurred_at.asc",
        key,
    )
    disc_by_id: dict[str, list[str]] = defaultdict(list)
    for e in events_db:
        disc_by_id[e["instance_id"]].append(e["occurred_at"])

    camps = rest_get(
        f"/broadcast_campaigns_2?organization_id=eq.{org}"
        "&select=id,name,status,started_at,sent_count,failed_count,total_contacts,instance_ids"
        "&order=started_at.desc.nullslast&limit=20",
        key,
    )
    camps_today = [c for c in camps if (c.get("started_at") or "").startswith(day) or c.get("status") == "running"]
    pool_source = next((c for c in camps_today if c.get("instance_ids")), None)
    pool_ids = set(pool_source.get("instance_ids") or []) if pool_source else set()
    camp_start = next((c["started_at"] for c in camps_today if c.get("started_at")), None)

    # fila do dia: envios ok/falha + failure_code
    queue = rest_get(
        f"/broadcast_queue_2?organization_id=eq.{org}"
        f"&sent_at=gte.{day}T00:00:00&sent_at=lte.{day_end}"
        "&select=instance_id,status,sent_at,failure_code&limit=8000",
        key,
    )
    sends_ok = Counter(q["instance_id"] for q in queue if q.get("status") == "sent")
    sends_fail = Counter(q["instance_id"] for q in queue if q.get("status") == "failed")
    fail_codes = Counter(q.get("failure_code") for q in queue if q.get("status") == "failed" and q.get("failure_code"))

    # ---- 3. Cruzamento por chip ----
    rows = []
    for name, slot in evo_by_inst.items():
        if name == "?":
            continue
        db = inst_by_name.get(name)
        iid = db["id"] if db else None
        sev, motivo = classify_block(slot["reasons"], slot["kinds"])
        rows.append({
            "chip": name,
            "no_pool": iid in pool_ids if iid else False,
            "agora": ("ON" if db.get("is_connected") else "OFF") if db else "?",
            "envios_ok": sends_ok.get(iid, 0) if iid else 0,
            "envios_falha": sends_fail.get(iid, 0) if iid else 0,
            "device_removed": slot["kinds"].get("device_removed", 0),
            "close_401": slot["reasons"].get("401", 0),
            "close_403": slot["reasons"].get("403", 0),
            "close_428": slot["kinds"].get("connection_closed", 0),
            "close_outros": sum(v for k, v in slot["reasons"].items() if k not in ("401", "403")),
            "reconexoes": slot["kinds"].get("opened", 0),
            "primeira_queda_brt": brt(slot["first"]),
            "severidade": sev,
            "motivo": motivo,
        })

    sev_order = {"CRÍTICO": 0, "ALTO": 1, "MÉDIO": 2, "BAIXO": 3, "—": 4}
    rows.sort(key=lambda r: (sev_order.get(r["severidade"], 9), -r["device_removed"], -r["close_401"] - r["close_403"], r["chip"]))

    # ---- veredito ----
    total_removed = sum(r["device_removed"] for r in rows)
    total_401 = sum(r["close_401"] for r in rows)
    total_403 = sum(r["close_403"] for r in rows)
    n_critico = sum(1 for r in rows if r["severidade"] == "CRÍTICO")

    if total_removed > 0:
        veredito = (
            f"BLOQUEIO/REMOÇÃO PELO WHATSAPP confirmado nos logs: {total_removed} evento(s) "
            f"device_removed afetando {n_critico} chip(s). O WhatsApp removeu o dispositivo "
            "vinculado (Evolution) — não é falso status do CRM."
        )
    elif total_401 + total_403 >= 3:
        veredito = (
            f"Sessões encerradas pelo WhatsApp: {total_401}× 401 (loggedOut) e {total_403}× 403 "
            "(forbidden). Padrão de estresse de sessão, não falso status do CRM."
        )
    elif evo_events:
        veredito = "Quedas presentes nos logs, mas sem padrão de bloqueio em massa."
    else:
        veredito = "Sem eventos de bloqueio nos logs Evolution na data."

    report = {
        "org": org,
        "date": day,
        "veredito": veredito,
        "evolution_container": evo.get("container"),
        "evolution_summary": evo.get("summary", {}),
        "totais": {
            "device_removed": total_removed,
            "close_401_loggedOut": total_401,
            "close_403_forbidden": total_403,
            "chips_criticos": n_critico,
            "envios_ok": sum(sends_ok.values()),
            "envios_falha": sum(sends_fail.values()),
        },
        "fila_failure_codes": dict(fail_codes),
        "campanha": {
            "nome": (pool_source or {}).get("name"),
            "status": (pool_source or {}).get("status"),
            "inicio_brt": brt(camp_start),
            "pool_chips": len(pool_ids),
        },
        "chips": rows,
    }

    if args.save:
        out_dir = os.path.join(ROOT, "test-results")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"diagnostico-bloqueios-{day}.json")
        with open(out_path, "w") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"💾 Salvo: {out_path}", file=sys.stderr)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0

    # ---- relatório texto ----
    print("=" * 78)
    print("DIAGNÓSTICO DE BLOQUEIOS — Evolution API + CRM (Disparador 2)")
    print(f"Org: {org}  |  Data: {day}  |  Container: {evo.get('container') or '?'}")
    print("=" * 78)
    print()
    print(f"VEREDITO: {veredito}")
    print()
    print("--- Totais ---")
    print(f"  device_removed (WhatsApp removeu vínculo): {total_removed}")
    print(f"  401 loggedOut (sessão deslogada):          {total_401}")
    print(f"  403 forbidden (acesso negado):             {total_403}")
    print(f"  Chips críticos:                            {n_critico}")
    print(f"  Envios OK / Falha (fila):                  {sum(sends_ok.values())} / {sum(sends_fail.values())}")
    if fail_codes:
        print(f"  Falhas por código:                         {dict(fail_codes)}")
    print()
    if pool_source:
        print(f"  Campanha: {pool_source.get('name')} ({pool_source.get('status')})")
        print(f"  Início (BRT): {brt(camp_start)} | Pool: {len(pool_ids)} chips")
        print()

    bm = evo.get("summary", {}).get("by_minute_utc", {})
    if bm:
        print("--- Eventos de queda por minuto (UTC) ---")
        for m in sorted(bm):
            if bm[m] > 0:
                print(f"  {m}  →  {bm[m]} evento(s)")
        print()

    print("--- Chips com bloqueio/queda (ordenado por severidade) ---")
    print(f"  {'Chip':<22}{'Sev':<9}{'Agora':<6}{'OK':<4}{'Fail':<5}{'dev_rm':<7}{'401':<4}{'403':<4}{'428':<4}{'1ª BRT':<9}")
    print("  " + "-" * 90)
    for r in rows:
        print(
            f"  {r['chip']:<22}{r['severidade']:<9}{r['agora']:<6}{r['envios_ok']:<4}"
            f"{r['envios_falha']:<5}{r['device_removed']:<7}{r['close_401']:<4}{r['close_403']:<4}"
            f"{r['close_428']:<4}{r['primeira_queda_brt']:<9}"
        )
    print()
    print("--- Motivos detalhados (chips críticos/altos) ---")
    for r in rows:
        if r["severidade"] in ("CRÍTICO", "ALTO"):
            print(f"  • {r['chip']}: {r['motivo']}")
    print()
    print("--- Recomendações ---")
    if total_removed > 0:
        print("  1. device_removed = WhatsApp removeu o vínculo. Verificar no celular do chip")
        print("     (Aparelhos conectados) e reconectar via QR só os necessários.")
    print("  2. Rampa na 1ª onda: máx. 1 envio/chip nos primeiros 10–15 min.")
    print("  3. Pausar campanha se 3+ chips caírem em poucos minutos (disjuntor).")
    print("  4. Ativar CACHE_REDIS_SAVE_INSTANCES=true no servidor Evolution (hoje false).")
    print("  5. Evitar reconectar chips em massa no mesmo dia de campanha grande.")
    print("=" * 78)
    return 0


if __name__ == "__main__":
    sys.exit(main())
