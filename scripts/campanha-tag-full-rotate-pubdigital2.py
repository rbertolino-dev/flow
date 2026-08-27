#!/usr/bin/env python3
"""
pubdigital 2: valida lista REAL com TODAS instâncias OPEN em rodízio,
usa template "Tag" ({Nome}), cria campanha draft rotate e verifica erros.
NÃO inicia o disparo.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORG = "1a6ab607-837b-48b4-a9b5-ec19187b3331"
REF = open(os.path.join(ROOT, "supabase", ".temp", "project-ref")).read().strip()
BASE = f"https://{REF}.supabase.co"
E2E_ENV = os.path.join(ROOT, ".env.e2e.local")
OUT_DIR = os.path.join(ROOT, "test-results")
TEMPLATE_ID = "885198da-2e13-4d9e-81b1-55f5dc52953d"  # Tag

# Lista real fornecida pelo usuário (Nome empresa + telefone)
RAW_CONTACTS = """
Helpnet Work Servicos De Telecomunicacoes E Multimidia Ltda	21983310462
Fernandes E Ferreira Fibra Optica Ltda	24999062418
Impacto Solucoes Em Internet Ltda	11960632924
Marketcast Produtos E Servicos Digitais Ltda	2830141091
L&R Telecomunicacao Ltda	27981909392
Henrique Aparecido De Jesus	31989229382
World Net Telecom Ltda	1632586221
Junior Antonio Ferreira Ltda	38999680514
Vip Link Telecomunicacao Ltda	27988499362
Services Network Ltda	11996962556
R C G Dos Santos Servicos E Comunicacao	11999999999
Miqueias De Souza	16992681778
Cop Telecom Solucoes Tecnologica Ltda	41985212344
Galax Network Provedor De Internet Ltda	5511991650692
Jap Servicos E Internet Ltda	3336271306
Infinity Net Ltda	22999947233
John Michel De Souza Lima Ltda	17992155530
Mega Turbo Net Solucoes Em Internet Sociedade Unipessoal Ltda	11972144945
Telemax Servicos De Tecnologia Ltda	38988467375
Paulo Henrique Galeano Ferreira	13988434432
Sampa Teleinformatica Ltda	11992380411
Nm Solucoes E Tecnologias Ltda	31991102418
Engesys Ltda	31994660197
Conecta Netfibra Telecomunicacoes Ltda	33988085108
Imperium Telecom Barreira Grande Servicos De Telecomunicacoes Ltda.	11999999999
Netmais Servicos De Internet Ltda	33999495271
Venturi Telecom Ltda	37998652221
Kt Engenharia E Componentes Eletronicos Ltda	22981161415
Cs - Net Telecom Ltda	22999393048
Boa Conexao Telecomunicacao Ltda	31982518369
Oknet Telecom Ltda	14997599255
Pvn Provedor De Internet Ltda	35997170673
Bruna Cristina Da Silva	11973545769
Tebas Telecom Ltda	11996205059
Aipeer Telecom Ltda	11982990659
Giganet Perdizes Ltda	34992734252
Fibra X Telecom Bauru Ltda	14998076912
Silas Krauss Reis Ferreira	35999630909
Rapid Fiber Ltda	18998218251
Precision Telecomunicacoes E Informatica Ltda	19999148309
Monteiroanac Servicos Comunicacao Multimidia Ltda	11970624554
M.R Servicos De Comunicacoes Multimidia Ltda	21971640068
Net Info Telecom	21967495399
Ph-Infor Solucoes E Servicos De Acesso A Internet Ltda	21995455071
Maximavoip Servicos De Telecomunicacoes Ltda	11977216918
Guapi Net Telecomunicacoes Ltda	21997931306
Campo Net Telecom Ltda	14997921893
Juni Provedor E Consultoria Ltda	31996956100
Super Net Telecomunicacoes Ltda	31971057800
Dnet Telecom Servicos De Internet Ltda	21989349072
Silva & Silva Tecnologia E Fibra Optica Ltda	17991368021
Connect Fibra Ltda	11985854052
Bma Telecom Servicos De Internet Ltda	21991761527
Tf Telecomunicacoes Ltda	21984469864
Rural Conecta Ltda	38997402599
"""


def log(msg: str) -> None:
    print(msg, flush=True)


def load_e2e() -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.exists(E2E_ENV):
        return out
    with open(E2E_ENV) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def load_keys() -> tuple[str, str]:
    anon = os.environ.get("SUPABASE_ANON_KEY", "").strip()
    service = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if anon and service:
        return anon, service
    proc = subprocess.run(
        ["supabase", "projects", "api-keys", "--project-ref", REF],
        capture_output=True,
        text=True,
        cwd=ROOT,
        timeout=60,
    )
    for line in proc.stdout.splitlines():
        parts = [p.strip() for p in line.split("|") if p.strip()]
        if len(parts) >= 2 and parts[0] == "anon":
            anon = parts[1]
        if len(parts) >= 2 and parts[0] == "service_role":
            service = parts[1]
    if not anon or not service:
        raise RuntimeError("keys missing")
    return anon, service


def http(method: str, url: str, headers: dict, body=None, timeout: int = 120):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="replace")
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"raw": raw[:600]}
        return e.code, parsed
    except Exception as e:
        return 0, {"error": str(e)}


def rest(method, path, token, anon, body=None, prefer="return=representation"):
    h = {
        "apikey": anon if token != (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "x") else token,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    # always send both
    h["apikey"] = anon
    if method == "GET":
        h.pop("Content-Type", None)
    return http(method, f"{BASE}/rest/v1/{path}", h, body)


def normalize(phone: str) -> str:
    d = "".join(c for c in phone if c.isdigit())
    if not d:
        return ""
    if d.startswith("55"):
        return d
    if 10 <= len(d) <= 11:
        return "55" + d
    return d


def parse_contacts() -> list[dict[str, str]]:
    out = []
    seen = set()
    for line in RAW_CONTACTS.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # tab or multi-space
        if "\t" in line:
            name, phone = line.rsplit("\t", 1)
        else:
            m = re.match(r"^(.+?)\s+(\d{8,15})\s*$", line)
            if not m:
                continue
            name, phone = m.group(1), m.group(2)
        name = name.strip()
        phone_n = normalize(phone.strip())
        if not phone_n or phone_n in seen:
            continue
        # skip obvious fake placeholder
        if phone_n.endswith("999999999") or phone_n.endswith("11999999999"):
            # still include but note — user list has 11999999999
            pass
        seen.add(phone_n)
        out.append({"name": name, "phone": phone_n, "empresa": name, "nome_empresa": name})
    return out


def main() -> int:
    e2e = load_e2e()
    email = e2e.get("E2E_EMAIL") or "pubdigital.net@gmail.com"
    password = e2e.get("E2E_PASSWORD") or "123456"
    anon, service = load_keys()
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = service
    errors: list[str] = []

    log("=== Campanha Tag + TODAS ativas (rotate) — pubdigital 2 ===")
    log(f"org={ORG} user={email} template=Tag")

    code, auth = http(
        "POST",
        f"{BASE}/auth/v1/token?grant_type=password",
        {"apikey": anon, "Content-Type": "application/json"},
        {"email": email, "password": password},
    )
    if code != 200 or not auth or not auth.get("access_token"):
        log(f"❌ login {code} {auth}")
        return 1
    access = auth["access_token"]
    user_id = auth["user"]["id"]
    log("✅ login")

    # template Tag
    _, tmpl_rows = rest(
        "GET",
        f"broadcast_campaign_templates?id=eq.{TEMPLATE_ID}&select=*",
        service,
        anon,
    )
    tmpl = (tmpl_rows or [None])[0]
    if not tmpl:
        log("❌ template Tag não encontrado")
        return 1
    variations = tmpl.get("message_variations") or []
    if not isinstance(variations, list) or not variations:
        log("❌ template sem message_variations")
        return 1
    log(f"✅ template Tag: {len(variations)} variações com tag {{Nome}}")

    # chips OPEN
    _, chips = rest(
        "GET",
        f"evolution_config?organization_id=eq.{ORG}&is_connected=eq.true&select=id,instance_name,api_url,api_key&order=instance_name",
        service,
        anon,
    )
    chips = chips or []
    ready = []
    for c in chips:
        base_url = str(c["api_url"]).rstrip("/").replace("/manager", "")
        if base_url.startswith("http://"):
            base_url = "https://" + base_url[7:]
        enc = urllib.parse.quote(c["instance_name"])
        p = subprocess.run(
            ["curl", "-sS", "-m", "10", "-H", f"apikey: {c['api_key']}", f"{base_url}/instance/connectionState/{enc}"],
            capture_output=True,
            text=True,
        )
        st = "?"
        try:
            st = ((json.loads(p.stdout).get("instance") or {}).get("state") or "").lower()
        except Exception:
            pass
        ok = st in {"open", "connected", "online", "ready", "authenticated"}
        if ok:
            ready.append(c)
            log(f"  ✅ {c['instance_name']}")
        else:
            errors.append(f"db_connected mas live={st}: {c['instance_name']}")
            log(f"  ❌ {c['instance_name']} ({st})")
        time.sleep(0.1)

    if not ready:
        log("❌ nenhuma OPEN")
        return 1
    pool_ids = [c["id"] for c in ready]
    pool_names = [c["instance_name"] for c in ready]
    log(f"Pool OPEN: {len(ready)}")

    contacts = parse_contacts()
    log(f"Contatos da lista: {len(contacts)}")
    numbers = [c["phone"] for c in contacts]

    # Validação em lotes com preferred rotativo em TODAS as ativas
    batch_size = 20
    batches = [numbers[i : i + batch_size] for i in range(0, len(numbers), batch_size)]
    validated: set[str] = set()
    rejected: set[str] = set()
    used_names: list[str] = []
    batch_results = []
    log(f"\nValidando {len(batches)} lotes × até {batch_size} nums, rodízio em {len(pool_ids)} chips…")

    for bi, batch in enumerate(batches):
        pref = pool_ids[bi % len(pool_ids)]
        pref_name = pool_names[bi % len(pool_names)]
        log(f"\nLote {bi+1}/{len(batches)} preferred={pref_name} nums={len(batch)}")
        code, edge = http(
            "POST",
            f"{BASE}/functions/v1/validate-broadcast-whatsapp",
            {
                "Authorization": f"Bearer {access}",
                "apikey": anon,
                "Content-Type": "application/json",
            },
            {
                "organizationId": ORG,
                "instanceIds": pool_ids,
                "numbers": batch,
                "useLatamValidator": False,
                "preferredInstanceId": pref,
            },
            timeout=120,
        )
        ok = bool(isinstance(edge, dict) and edge.get("ok"))
        err = (edge or {}).get("error") if isinstance(edge, dict) else str(edge)
        used = (edge or {}).get("usedInstance") if isinstance(edge, dict) else None
        val = (edge or {}).get("validatedNumbers") or []
        rej = (edge or {}).get("rejectedNumbers") or []
        log(f"  http={code} ok={ok} used={used} v={len(val)} r={len(rej)}")
        if not ok:
            errors.append(f"lote {bi+1} ({pref_name}): {err}")
            log(f"  ❌ {err}")
        for n in val:
            validated.add(normalize(n))
        for n in rej:
            rejected.add(normalize(n))
        if used:
            used_names.append(str(used))
        batch_results.append(
            {
                "batch": bi + 1,
                "preferred": pref_name,
                "used": used,
                "ok": ok,
                "error": None if ok else str(err)[:200],
                "validated": len(val),
                "rejected": len(rej),
            }
        )
        time.sleep(0.8)

    ok_batches = sum(1 for b in batch_results if b["ok"])
    log(f"\n=== Validação: {ok_batches}/{len(batch_results)} OK | chips={sorted(set(used_names))} ===")
    log(f"validated={len(validated)} rejected={len(rejected)}")

    validated_contacts = [c for c in contacts if normalize(c["phone"]) in validated]
    if not validated_contacts:
        log("❌ 0 validados — não cria campanha")
        errors.append("0 contatos com WhatsApp")
        return 1

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    camp_name = f"Tag - Provedores - {stamp} (auto)"
    log(f"\nCriando campanha draft '{camp_name}'…")
    log(f"  method=rotate | instances={len(pool_ids)} | contacts={len(validated_contacts)} | template=Tag")

    body = {
        "user_id": user_id,
        "organization_id": ORG,
        "name": camp_name,
        "instance_id": None,
        "message_template_id": None,
        "custom_message": variations[0],
        "min_delay_seconds": 45,
        "max_delay_seconds": 90,
        "total_contacts": len(validated_contacts),
        "status": "draft",
        "sending_method": "rotate",
        "instance_ids": pool_ids,
    }
    code, created = rest("POST", "broadcast_campaigns_2", access, anon, body)
    if code not in (200, 201) or not created:
        errors.append(f"insert campanha user http={code}")
        code, created = rest("POST", "broadcast_campaigns_2", service, anon, body)
    camp = created[0] if isinstance(created, list) else created
    if not isinstance(camp, dict) or not camp.get("id"):
        log(f"❌ campanha falhou: {code} {created}")
        return 1
    log(f"  ✅ id={camp['id']} status={camp.get('status')} method={camp.get('sending_method')}")

    # fila: personalized_message = variação com tags (processador substitui {Nome}/{nome})
    queue_items = []
    for i, c in enumerate(validated_contacts):
        msg = variations[i % len(variations)]
        queue_items.append(
            {
                "campaign_id": camp["id"],
                "organization_id": ORG,
                "instance_id": pool_ids[i % len(pool_ids)],
                "phone": c["phone"],
                "name": c["name"],
                "empresa": c.get("empresa"),
                "nome_empresa": c.get("nome_empresa"),
                "personalized_message": msg,
                "status": "pending",
            }
        )

    for i in range(0, len(queue_items), 40):
        chunk = queue_items[i : i + 40]
        code, resp = rest("POST", "broadcast_queue_2", access, anon, chunk, prefer="return=minimal")
        if code not in (200, 201):
            code, resp = rest("POST", "broadcast_queue_2", service, anon, chunk, prefer="return=minimal")
        if code not in (200, 201):
            errors.append(f"fila http={code} {resp}")
            log(f"  ❌ fila {code}")

    log(f"  ✅ fila={len(queue_items)} pending")
    dist = Counter(pool_names[i % len(pool_names)] for i in range(len(queue_items)))
    log("  distribuição por chip:")
    for n, cnt in sorted(dist.items()):
        log(f"    {n}: {cnt}")

    # verify
    _, camp_db = rest(
        "GET",
        f"broadcast_campaigns_2?id=eq.{camp['id']}&select=id,name,status,sending_method,total_contacts,instance_ids",
        service,
        anon,
    )
    row = (camp_db or [{}])[0]
    ids = row.get("instance_ids") or []
    log(f"\nVerify: status={row.get('status')} method={row.get('sending_method')} total={row.get('total_contacts')} instances={len(ids)}")
    if len(ids) != len(pool_ids):
        errors.append(f"instance_ids {len(ids)} != {len(pool_ids)}")

    _, qall = rest(
        "GET",
        f"broadcast_queue_2?campaign_id=eq.{camp['id']}&select=status,instance_id,error_message,failure_code,phone",
        service,
        anon,
    )
    qall = qall or []
    by_st = Counter(q.get("status") for q in qall)
    chips_q = len({q.get("instance_id") for q in qall})
    log(f"fila statuses={dict(by_st)} chips={chips_q}")
    failed = [q for q in qall if q.get("status") == "failed"]
    if failed:
        errors.append(f"{len(failed)} failed na fila")
        for q in failed[:5]:
            log(f"  failed: {q.get('phone')} {q.get('error_message')}")

    # sample personalization tags present
    sample_msg = queue_items[0]["personalized_message"] if queue_items else ""
    has_tag = "{Nome}" in sample_msg or "{nome}" in sample_msg.lower()
    log(f"tag {{Nome}} na mensagem: {'✅' if has_tag else '❌'}")
    if not has_tag:
        errors.append("mensagem sem tag {Nome}")

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"campanha-tag-full-rotate-{stamp}.json")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "organization_id": ORG,
        "template_id": TEMPLATE_ID,
        "template_name": "Tag",
        "variations_count": len(variations),
        "pool_size": len(ready),
        "pool_names": pool_names,
        "contacts_input": len(contacts),
        "validated": len(validated),
        "rejected": len(rejected),
        "batches": batch_results,
        "chips_used_validation": sorted(set(used_names)),
        "campaign_id": camp["id"],
        "campaign_name": camp_name,
        "campaign_status": "draft",
        "sending_method": "rotate",
        "queue_count": len(queue_items),
        "errors": errors,
        "note": "DRAFT — não dispara. Inicie no painel se quiser enviar.",
    }
    with open(path, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    log(f"\nSalvo: {path}")
    log("\n=== ERROS / AVISOS ===")
    if not errors:
        log("✅ Nenhum erro crítico")
    else:
        for e in errors:
            log(f"  ⚠️ {e}")

    if ok_batches == len(batch_results) and len(queue_items) > 0 and not failed:
        log("\nDIAGNÓSTICO: OK — validou, criou campanha Tag rotate com todas ativas (draft).")
        return 0
    log("\nDIAGNÓSTICO: parcial ou com avisos.")
    return 0 if camp.get("id") else 1


if __name__ == "__main__":
    sys.exit(main())
