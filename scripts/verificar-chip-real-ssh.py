#!/usr/bin/env python3
"""
Verificação REAL de chips Evolution via SSH + API connectionState.

Cruza, por chip:
  - CRM (Supabase evolution_config.is_connected)
  - Postgres Evolution (Instance.connectionStatus) — o que o Manager usa
  - API ao vivo GET /instance/connectionState — o que o Disparador usa
  - Sessão Baileys no Postgres (Session.creds)

Marca FANTASMA quando Postgres/CRM diz conectado mas connectionState != open.

Somente leitura.

Uso:
  ./scripts/verificar-chip-real-ssh.sh
  ./scripts/verificar-chip-real-ssh.sh --org 34086d07-9181-43fc-a3e8-6aa28974d68b
  ./scripts/verificar-chip-real-ssh.sh --chips "Fatima,Ana Iclass,Silvia"
  ./scripts/verificar-chip-real-ssh.sh --json --save
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ICLASS_ORG = "34086d07-9181-43fc-a3e8-6aa28974d68b"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_FILE = os.path.join(ROOT, "supabase", ".temp", "project-ref")
EVO_CRED_FILE = os.path.join(ROOT, "scripts", ".evolution-ssh-credentials")
OUT_DIR = os.path.join(ROOT, "test-results")

POSTGRES_CONTAINER = "postgres_postgres.1.mzh6iioeiyn40wokomoq0ifxg"
POSTGRES_DB = "evolution"

OPEN_STATES = {"open", "connected", "online", "up", "ready", "authenticated", "logged", "active"}
TRANSIENT_STATES = {"pairing", "connecting", "qr", "waiting", "timeout", "syncing", "loading"}

REASON_LABEL = {
    401: "loggedOut",
    403: "forbidden",
    408: "timeout",
    428: "connectionClosed",
    440: "connectionReplaced",
    500: "badSession",
    503: "unavailable",
    515: "restartRequired",
}


def load_evo_credentials() -> dict[str, str]:
    if not os.path.exists(EVO_CRED_FILE):
        raise SystemExit(
            f"❌ Credencial Evolution não encontrada: {EVO_CRED_FILE}\n"
            "Crie com EVOLUTION_SSH_HOST, EVOLUTION_SSH_USER, EVOLUTION_SSH_PASSWORD."
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
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "service_role":
            return parts[1]
    raise SystemExit("❌ service_role key não encontrada (supabase CLI)")


def rest_get(path: str, key: str) -> list[dict]:
    ref = open(REF_FILE).read().strip()
    req = urllib.request.Request(
        f"https://{ref}.supabase.co/rest/v1{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read())


def ssh_run(creds: dict[str, str], remote_cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    host = creds["EVOLUTION_SSH_USER"] + "@" + creds["EVOLUTION_SSH_HOST"]
    proc = subprocess.run(
        [
            "sshpass",
            "-p",
            creds["EVOLUTION_SSH_PASSWORD"],
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=20",
            host,
            remote_cmd,
        ],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def curl_connection_state(base: str, api_key: str, instance_name: str) -> tuple[str, object]:
    enc = urllib.parse.quote(instance_name, safe="")
    proc = subprocess.run(
        ["curl", "-sS", "-m", "15", "-H", f"apikey: {api_key}", f"{base}/instance/connectionState/{enc}"],
        capture_output=True,
        text=True,
    )
    try:
        body = json.loads(proc.stdout) if proc.stdout else {}
        state = str(body.get("instance", {}).get("state", "?"))
        return state, body
    except json.JSONDecodeError:
        return "?", proc.stdout[:120]


def fetch_postgres_status(creds: dict[str, str], names: list[str]) -> dict[str, dict]:
    if not names:
        return {}
    literals = ",".join("'" + n.replace("'", "''") + "'" for n in names)
    sql = f"""
SELECT i.name,
       i."connectionStatus",
       i."disconnectionReasonCode",
       i."disconnectionAt",
       (s.id IS NOT NULL) AS tem_session,
       COALESCE(length(s.creds::text), 0) AS creds_bytes
FROM public."Instance" i
LEFT JOIN public."Session" s ON s."sessionId" = i.id
WHERE i.name IN ({literals})
ORDER BY i.name;
"""
    remote = (
        f"docker exec {POSTGRES_CONTAINER} psql -U postgres -d {POSTGRES_DB} "
        f"-t -A -F '|' -c {shlex.quote(sql)}"
    )
    code, out, err = ssh_run(creds, remote, timeout=90)
    if code != 0:
        raise SystemExit(f"❌ Erro Postgres via SSH: {err or out}")

    result: dict[str, dict] = {}
    for line in out.splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        parts = line.split("|")
        if len(parts) < 6:
            continue
        name, status, reason, disc_at, tem_sess, creds_bytes = parts[:6]
        result[name] = {
            "postgres_status": status or "?",
            "disconnection_reason_code": int(reason) if reason.isdigit() else None,
            "disconnection_at": disc_at or None,
            "tem_session": tem_sess.lower() in ("t", "true", "1"),
            "creds_bytes": int(creds_bytes) if creds_bytes.isdigit() else 0,
        }
    return result


def classify(state: str, crm_on: bool, pg_open: bool) -> dict[str, object]:
    st = state.strip().lower()
    pode_disparar = st in OPEN_STATES
    fantasma = (crm_on or pg_open) and not pode_disparar
    if pode_disparar:
        acao = "OK — pode disparar"
    elif st in TRANSIENT_STATES:
        acao = "RECONECTAR — travado em " + st
    elif st in ("close", "closed", "disconnected", "offline", "down"):
        acao = "QR — sessão fechada"
    else:
        acao = "INVESTIGAR — estado " + state
    return {"pode_disparar": pode_disparar, "fantasma": fantasma, "acao": acao}


def main() -> int:
    p = argparse.ArgumentParser(description="Verificação real chips Evolution (SSH Postgres + connectionState)")
    p.add_argument("--org", default=ICLASS_ORG, help="organization_id UUID")
    p.add_argument("--chips", default="", help="Lista separada por vírgula (default: todas da org)")
    p.add_argument("--json", action="store_true")
    p.add_argument("--save", action="store_true")
    p.add_argument("--delay", type=float, default=0.12, help="Segundos entre chamadas connectionState")
    args = p.parse_args()

    creds = load_evo_credentials()
    key = load_service_role_key()

    rows = rest_get(
        f"/evolution_config?organization_id=eq.{args.org}"
        "&select=id,instance_name,is_connected,api_url,api_key"
        "&order=instance_name.asc",
        key,
    )
    if not rows:
        raise SystemExit(f"❌ Nenhuma instância para org {args.org}")

    if args.chips.strip():
        wanted = {c.strip().lower() for c in args.chips.split(",") if c.strip()}
        rows = [r for r in rows if r["instance_name"].lower() in wanted]
        if not rows:
            raise SystemExit("❌ Nenhum chip encontrado com os nomes informados")

    base = (
        rows[0]["api_url"]
        .rstrip("/")
        .replace("/manager", "")
        .replace("/dashboard", "")
        .replace("/app", "")
    )

    names = [r["instance_name"] for r in rows]
    print(f"🔌 SSH → {creds['EVOLUTION_SSH_HOST']} (Postgres Evolution)")
    pg_map = fetch_postgres_status(creds, names)

    results = []
    for inst in rows:
        name = inst["instance_name"]
        pg = pg_map.get(name, {})
        state, body = curl_connection_state(base, inst["api_key"], name)
        crm_on = inst.get("is_connected") is True
        pg_st = pg.get("postgres_status", "?")
        pg_open = str(pg_st).lower() in OPEN_STATES
        meta = classify(state, crm_on, pg_open)
        reason = pg.get("disconnection_reason_code")
        item = {
            "instance_name": name,
            "instance_id": inst["id"],
            "crm_is_connected": crm_on,
            "postgres_connectionStatus": pg_st,
            "postgres_tem_session": pg.get("tem_session"),
            "postgres_creds_bytes": pg.get("creds_bytes", 0),
            "postgres_last_disconnect_code": reason,
            "postgres_last_disconnect_label": REASON_LABEL.get(reason, "") if reason else "",
            "connectionState": state,
            "pode_disparar": meta["pode_disparar"],
            "fantasma": meta["fantasma"],
            "acao": meta["acao"],
            "connectionState_body": body if isinstance(body, dict) else str(body),
        }
        results.append(item)
        time.sleep(args.delay)

    ok = [r for r in results if r["pode_disparar"]]
    fantasma = [r for r in results if r["fantasma"]]
    travados = [r for r in results if str(r["connectionState"]).lower() in TRANSIENT_STATES]
    fechados = [
        r
        for r in results
        if str(r["connectionState"]).lower() in ("close", "closed", "disconnected", "offline", "down")
    ]

    summary = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": args.org,
        "api_base": base,
        "total": len(results),
        "pode_disparar": len(ok),
        "fantasma": len(fantasma),
        "travados_connecting": len(travados),
        "fechados": len(fechados),
    }

    if args.json:
        print(json.dumps({"summary": summary, "chips": results}, indent=2, ensure_ascii=False))
    else:
        print()
        print("=" * 88)
        print("VERIFICAÇÃO REAL — Postgres (Manager) × connectionState (Disparador)")
        print(f"Org: {args.org}  |  Chips: {len(results)}  |  {summary['checked_at'][:19]} UTC")
        print("=" * 88)
        print(
            f"{'CHIP':22} {'CRM':4} {'PG':10} {'REAL':12} {'SESS':5} {'DISPARO':8} {'AÇÃO'}"
        )
        print("-" * 88)
        for r in results:
            flag = " ⚠️" if r["fantasma"] else ""
            sess = "sim" if r["postgres_tem_session"] else "não"
            disp = "SIM" if r["pode_disparar"] else "NÃO"
            print(
                f"{r['instance_name']:22} "
                f"{'ON' if r['crm_is_connected'] else 'OFF':4} "
                f"{str(r['postgres_connectionStatus']):10} "
                f"{str(r['connectionState']):12} "
                f"{sess:5} "
                f"{disp:8} "
                f"{r['acao'][:28]}{flag}"
            )
        print("-" * 88)
        print(
            f"Resumo: {summary['pode_disparar']} prontos | "
            f"{summary['fantasma']} fantasma (PG/CRM ≠ real) | "
            f"{summary['travados_connecting']} connecting | "
            f"{summary['fechados']} close"
        )
        if fantasma:
            print("\n⚠️  FANTASMA (Manager/CRM diz conectado, socket real NÃO está open):")
            for r in fantasma:
                print(
                    f"   • {r['instance_name']}: CRM={'ON' if r['crm_is_connected'] else 'OFF'}, "
                    f"Postgres={r['postgres_connectionStatus']}, real={r['connectionState']}"
                )
        print("\nLegenda:")
        print("  PG   = Postgres Instance.connectionStatus (o que o Manager Evolution usa)")
        print("  REAL = GET /instance/connectionState (o que o Disparador 2 exige = open)")
        print("  SESS = credenciais Baileys salvas no Postgres (existir ≠ socket aberto)")

    if args.save:
        os.makedirs(OUT_DIR, exist_ok=True)
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        path = os.path.join(OUT_DIR, f"verificar-chip-real-ssh-{ts}.json")
        with open(path, "w") as f:
            json.dump({"summary": summary, "chips": results}, f, indent=2, ensure_ascii=False)
        if not args.json:
            print(f"\n💾 Salvo: {path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
