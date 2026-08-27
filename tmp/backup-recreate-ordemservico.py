#!/usr/bin/env python3
"""
Backup + recreate instâncias close/connecting em api.ordemservico.com.
NÃO mexe em instâncias open.
Preserva token, Setting, Chatwoot, Webhook, Proxy.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

BASE = "https://api.ordemservico.com"
API_KEY = "737c110ab9534622b093bf1199d04396"
OUT_DIR = "/root/kanban-buzz-95241/tmp/backups-ordemservico"
OPEN_STATES = {"open"}
TODO_STATES = {"close", "closed", "connecting"}


def api(method: str, path: str, body: dict | None = None, timeout: int = 60):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={"apikey": API_KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors="ignore")
        try:
            parsed = json.loads(raw) if raw else raw
        except json.JSONDecodeError:
            parsed = raw[:500]
        return e.code, parsed


def enc(name: str) -> str:
    return urllib.parse.quote(name, safe="")


def fetch_extra(name: str) -> dict:
    extras = {}
    for key, path in [
        ("webhook", f"/webhook/find/{enc(name)}"),
        ("settings_api", f"/settings/find/{enc(name)}"),
        ("chatwoot_api", f"/chatwoot/find/{enc(name)}"),
        ("proxy_api", f"/proxy/find/{enc(name)}"),
    ]:
        code, body = api("GET", path, timeout=30)
        extras[key] = body if code == 200 else None
        extras[f"{key}_http"] = code
    return extras


def has_qr(name: str) -> bool:
    code, body = api("GET", f"/instance/connect/{enc(name)}", timeout=25)
    if code != 200 or not isinstance(body, dict):
        return False
    return bool(body.get("base64") or body.get("code"))


def build_chatwoot_payload(cw: dict) -> dict:
    return {
        "enabled": bool(cw.get("enabled", True)),
        "accountId": str(cw.get("accountId") or "1"),
        "token": cw.get("token") or "",
        "url": cw.get("url") or "",
        "nameInbox": cw.get("nameInbox") or "",
        "signMsg": bool(cw.get("signMsg", False)),
        "signDelimiter": cw.get("signDelimiter") or None,
        "reopenConversation": bool(cw.get("reopenConversation", False)),
        "conversationPending": bool(cw.get("conversationPending", False)),
        "mergeBrazilContacts": bool(cw.get("mergeBrazilContacts", False)),
        "importContacts": bool(cw.get("importContacts", False)),
        "importMessages": bool(cw.get("importMessages", False)),
        "daysLimitImportMessages": cw.get("daysLimitImportMessages") or 7,
        "organization": cw.get("organization") or "",
        "logo": cw.get("logo") or "",
        "ignoreJids": cw.get("ignoreJids") if cw.get("ignoreJids") is not None else [],
    }


def build_webhook_payload(wh: dict) -> dict:
    events = wh.get("events")
    if not events:
        events = [
            "APPLICATION_STARTUP",
            "QRCODE_UPDATED",
            "MESSAGES_SET",
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONTACTS_SET",
            "CONTACTS_UPSERT",
            "CONTACTS_UPDATE",
            "PRESENCE_UPDATE",
            "CHATS_SET",
            "CHATS_UPSERT",
            "CHATS_UPDATE",
            "CHATS_DELETE",
            "GROUPS_UPSERT",
            "GROUP_UPDATE",
            "GROUP_PARTICIPANTS_UPDATE",
            "CONNECTION_UPDATE",
            "CALL",
            "NEW_JWT_TOKEN",
        ]
    return {
        "url": wh.get("url") or "",
        "enabled": bool(wh.get("enabled", True)),
        "webhookByEvents": bool(wh.get("webhookByEvents", False)),
        "webhookBase64": bool(wh.get("webhookBase64", False)),
        "events": events,
    }


def build_settings_payload(st: dict) -> dict:
    return {
        "rejectCall": bool(st.get("rejectCall", False)),
        "msgCall": st.get("msgCall") or "",
        "groupsIgnore": bool(st.get("groupsIgnore", False)),
        "alwaysOnline": bool(st.get("alwaysOnline", False)),
        "readMessages": bool(st.get("readMessages", False)),
        "readStatus": bool(st.get("readStatus", False)),
        "syncFullHistory": bool(st.get("syncFullHistory", False)),
    }


def recreate_one(item: dict) -> dict:
    name = item["name"]
    token = item.get("token") or ""
    result = {"name": name, "ok": False, "steps": {}, "qr_ready": False}

    # 1) logout (safe) + delete
    code, body = api("DELETE", f"/instance/logout/{enc(name)}", timeout=20)
    result["steps"]["logout"] = {"http": code}
    time.sleep(1)
    code, body = api("DELETE", f"/instance/delete/{enc(name)}", timeout=30)
    result["steps"]["delete"] = {"http": code, "body": body if code >= 400 else "ok"}
    if code not in (200, 201) and code != 404:
        # try continue if already gone
        if not (isinstance(body, dict) and "not exist" in str(body).lower()):
            result["error"] = f"delete failed http={code}"
            return result
    time.sleep(2)

    # 2) create with same token
    create_body = {
        "instanceName": name,
        "integration": "WHATSAPP-BAILEYS",
        "qrcode": True,
    }
    if token:
        create_body["token"] = token
    code, body = api("POST", "/instance/create", create_body, timeout=60)
    result["steps"]["create"] = {
        "http": code,
        "has_qr": bool(isinstance(body, dict) and ((body.get("qrcode") or {}).get("base64") or (body.get("qrcode") or {}).get("code"))),
    }
    if code not in (200, 201):
        result["error"] = f"create failed http={code} body={str(body)[:200]}"
        return result
    time.sleep(2)

    # 3) settings
    st = item.get("settings_api") or item.get("Setting") or {}
    if isinstance(st, dict) and st:
        code, body = api("POST", f"/settings/set/{enc(name)}", build_settings_payload(st), timeout=30)
        result["steps"]["settings"] = {"http": code}

    # 4) chatwoot
    cw = item.get("chatwoot_api") or item.get("Chatwoot")
    if isinstance(cw, dict) and cw.get("token") and cw.get("url"):
        payload = build_chatwoot_payload(cw)
        code, body = api("POST", f"/chatwoot/set/{enc(name)}", payload, timeout=45)
        result["steps"]["chatwoot"] = {"http": code, "inbox": payload.get("nameInbox")}
    else:
        result["steps"]["chatwoot"] = {"http": None, "skipped": True}

    # 5) webhook
    wh = item.get("webhook")
    if isinstance(wh, dict) and wh.get("url"):
        code, body = api("POST", f"/webhook/set/{enc(name)}", build_webhook_payload(wh), timeout=30)
        result["steps"]["webhook"] = {"http": code}
    else:
        result["steps"]["webhook"] = {"http": None, "skipped": True}

    # 6) proxy (only if originally enabled with host)
    px = item.get("proxy_api") or item.get("Proxy")
    if isinstance(px, dict) and px.get("enabled") and px.get("host"):
        code, body = api(
            "POST",
            f"/proxy/set/{enc(name)}",
            {
                "enabled": True,
                "host": px.get("host") or "",
                "port": str(px.get("port") or ""),
                "protocol": px.get("protocol") or "http",
                "username": px.get("username") or "",
                "password": px.get("password") or "",
            },
            timeout=30,
        )
        result["steps"]["proxy"] = {"http": code}
    else:
        result["steps"]["proxy"] = {"http": None, "skipped": True}

    time.sleep(2)
    result["qr_ready"] = has_qr(name)
    # retry connect once
    if not result["qr_ready"]:
        time.sleep(3)
        result["qr_ready"] = has_qr(name)

    result["ok"] = result["qr_ready"] or result["steps"]["create"].get("http") in (200, 201)
    return result


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    print("=== 1) Fetch instances ===")
    code, instances = api("GET", "/instance/fetchInstances", timeout=90)
    if code != 200 or not isinstance(instances, list):
        raise SystemExit(f"fetchInstances failed: {code} {instances}")

    open_list = [i for i in instances if (i.get("connectionStatus") or "").lower() in OPEN_STATES]
    todo = [i for i in instances if (i.get("connectionStatus") or "").lower() in TODO_STATES]

    print(f"Total={len(instances)} OPEN(skip)={len(open_list)} TODO={len(todo)}")
    print("OPEN:", ", ".join(sorted(i.get("name") or "?" for i in open_list)))

    print("\n=== 2) Backup completo (extras webhook/chatwoot) ===")
    backup_items = []
    for i, inst in enumerate(todo, 1):
        name = inst.get("name") or f"unknown-{i}"
        print(f"  backup {i}/{len(todo)}: {name} [{inst.get('connectionStatus')}]")
        extras = fetch_extra(name)
        item = {**inst, **extras}
        backup_items.append(item)
        time.sleep(0.15)

    backup_path = os.path.join(OUT_DIR, f"ordemservico-backup-{ts}.json")
    latest_path = os.path.join(OUT_DIR, "ordemservico-backup-latest.json")
    payload = {
        "meta": {
            "source": BASE,
            "exported_at_utc": datetime.now(timezone.utc).isoformat(),
            "total": len(instances),
            "open_skipped": [i.get("name") for i in open_list],
            "todo_count": len(todo),
            "note": "Backup antes de delete+recreate. OPEN não alteradas.",
        },
        "open_instances": open_list,
        "instances": backup_items,
    }
    with open(backup_path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
    with open(latest_path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
    print(f"Backup salvo: {backup_path}")

    print("\n=== 3) Delete + recreate (somente TODO) ===")
    results = []
    ok = fail = 0
    for i, item in enumerate(backup_items, 1):
        name = item.get("name")
        # safety: never touch open
        if (item.get("connectionStatus") or "").lower() in OPEN_STATES:
            print(f"  SKIP OPEN {name}")
            continue
        print(f"  recreate {i}/{len(backup_items)}: {name} ...", flush=True)
        r = recreate_one(item)
        results.append(r)
        status = "OK" if r.get("qr_ready") else ("CREATED" if r.get("ok") else "FAIL")
        print(
            f"    -> {status} qr={r.get('qr_ready')} chatwoot={r.get('steps', {}).get('chatwoot')} webhook={r.get('steps', {}).get('webhook')}"
        )
        if r.get("qr_ready"):
            ok += 1
        else:
            fail += 1
        time.sleep(1)

    # final status
    code, final = api("GET", "/instance/fetchInstances", timeout=90)
    from collections import Counter

    st = Counter((i.get("connectionStatus") or "?") for i in (final or []))
    open_now = sorted(i.get("name") for i in (final or []) if i.get("connectionStatus") == "open")

    summary = {
        "exported_at_utc": ts,
        "todo": len(backup_items),
        "qr_ok": ok,
        "qr_fail": fail,
        "final_status": dict(st),
        "open_still": open_now,
        "open_before": sorted(i.get("name") for i in open_list),
        "open_untouched": sorted(open_now) == sorted(i.get("name") for i in open_list)
        or set(i.get("name") for i in open_list).issubset(set(open_now)),
        "results": results,
    }
    log_path = os.path.join(OUT_DIR, f"ordemservico-recreate-log-{ts}.json")
    with open(log_path, "w") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    with open(os.path.join(OUT_DIR, "ordemservico-recreate-log-latest.json"), "w") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)

    print("\n=== RESUMO ===")
    print(json.dumps({k: summary[k] for k in summary if k != "results"}, ensure_ascii=False, indent=2))
    print(f"Log: {log_path}")
    fails = [r["name"] for r in results if not r.get("qr_ready")]
    if fails:
        print("Sem QR ainda:", ", ".join(fails))


if __name__ == "__main__":
    main()
