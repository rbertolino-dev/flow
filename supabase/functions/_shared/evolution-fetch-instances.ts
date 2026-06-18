import {
  connectionStateToBoolean,
  extractConnectionStateFromBody,
  extractConnectionStateFromBodyForBatchSync,
  extractConnectionStateFromBodyForPersist,
  normalizeApiUrl,
} from "./evolution-connection-parse.ts";

export type InstanceLiveStatus = {
  live: boolean | null;
  source: "fetchInstances" | "connectionState" | "none";
  httpStatus?: number | null;
  error?: string;
};

function normalizeInstanceKey(name: string): string {
  return name.trim().toLowerCase();
}

function statusFromFetchItem(item: unknown): boolean | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const inst = (row.instance as Record<string, unknown> | undefined) ?? row;
  const raw =
    inst.status ??
    inst.state ??
    inst.connectionStatus ??
    row.status ??
    row.state;
  if (raw == null) return null;
  return connectionStateToBoolean(String(raw));
}

/**
 * Uma chamada GET /instance/fetchInstances — mesma fonte do painel Evolution.
 * Retorna mapa instanceName (lowercase) -> conectado?
 */
export async function buildFetchInstancesStatusMap(
  apiUrl: string,
  apiKey: string,
  timeoutMs = 20000,
): Promise<Map<string, boolean | null>> {
  const baseUrl = normalizeApiUrl(apiUrl);
  const urls = [
    `${baseUrl}/instance/fetchInstances`,
  ];
  const map = new Map<string, boolean | null>();

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [data];
      for (const row of rows) {
        const o = row as Record<string, unknown>;
        const inst = (o.instance as Record<string, unknown> | undefined) ?? o;
        const name = String(
          inst.instanceName ?? inst.name ?? o.instanceName ?? "",
        ).trim();
        if (!name) continue;
        const live = statusFromFetchItem(row);
        if (live !== null) {
          map.set(normalizeInstanceKey(name), live);
        }
      }
      if (map.size > 0) return map;
    } catch {
      continue;
    }
  }

  return map;
}

export async function fetchConnectionStateSingle(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  timeoutMs = 12000,
  forPersist: boolean | "batchSync" = false,
): Promise<InstanceLiveStatus> {
  const baseUrl = normalizeApiUrl(apiUrl);
  const url =
    `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`;
  try {
    const res = await fetch(url, {
      headers: { apikey: apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { _raw: text.slice(0, 200) };
      }
    }
    if (!res.ok) {
      return {
        live: null,
        source: "connectionState",
        httpStatus: res.status,
        error: `HTTP_${res.status}`,
      };
    }
    const live =
      forPersist === "batchSync"
        ? extractConnectionStateFromBodyForBatchSync(parsed)
        : forPersist
          ? extractConnectionStateFromBodyForPersist(parsed)
          : extractConnectionStateFromBody(parsed);
    return {
      live,
      source: "connectionState",
      httpStatus: res.status,
    };
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : "";
    return {
      live: null,
      source: "connectionState",
      error: name === "AbortError" ? "timeout" : "fetch_failed",
    };
  }
}

/**
 * Fonte mais direta por instância: GET /instance/connectionState/{nome}
 * (mesmo endpoint que o painel usa ao abrir um chip).
 * fetchInstances só entra se connectionState não responder — lista pode ficar desatualizada (open + Connection Closed no envio).
 */
export async function resolveInstanceLiveStatus(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  fetchMap?: Map<string, boolean | null>,
): Promise<InstanceLiveStatus> {
  const direct = await fetchConnectionStateSingle(apiUrl, apiKey, instanceName);
  if (direct.live !== null) {
    const key = normalizeInstanceKey(instanceName);
    const fromList = fetchMap?.get(key);
    if (fromList !== undefined && fromList !== null && fromList !== direct.live) {
      return {
        ...direct,
        error: `mismatch_fetchInstances_${fromList}_connectionState_${direct.live}`,
      };
    }
    return direct;
  }

  const key = normalizeInstanceKey(instanceName);
  if (fetchMap?.has(key)) {
    const v = fetchMap.get(key)!;
    if (v !== null) {
      return { live: v, source: "fetchInstances" };
    }
  }

  return direct;
}

/**
 * Sincronização CRM: connectionState é a fonte real (open/connecting/close).
 * fetchInstances só como fallback quando connectionState não responder (timeout/HTTP).
 */
export async function resolveInstanceLiveStatusForSync(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  fetchMap?: Map<string, boolean | null>,
): Promise<InstanceLiveStatus> {
  const key = normalizeInstanceKey(instanceName);
  const direct = await fetchConnectionStateSingle(
    apiUrl,
    apiKey,
    instanceName,
    12000,
    "batchSync",
  );

  if (direct.live === true) {
    return direct;
  }
  if (direct.live === false) {
    const fromList = fetchMap?.get(key);
    if (fromList === true) {
      return {
        ...direct,
        error: "fetchInstances_open_connectionState_not_open",
      };
    }
    return direct;
  }

  let fromList: boolean | null | undefined = fetchMap?.get(key);
  if (fromList === undefined) {
    const map = fetchMap ?? await buildFetchInstancesStatusMap(apiUrl, apiKey, 20000);
    fromList = map.get(key);
  }

  if (fromList === true) {
    return {
      live: true,
      source: "fetchInstances",
      error: "connectionState_indisponivel_lista_open",
    };
  }
  if (fromList === false) {
    return { live: false, source: "fetchInstances" };
  }

  return direct;
}

/** Pronto para disparo: exige connectionState = open (fonte direta). */
export async function isInstanceReadyToSend(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<{ ready: boolean; source: string; detail?: string; persistDisconnected?: boolean }> {
  const status = await fetchConnectionStateSingle(apiUrl, apiKey, instanceName, 12000, "batchSync");
  if (status.live === true) {
    return { ready: true, source: "connectionState" };
  }
  if (status.live === false) {
    return {
      ready: false,
      source: "connectionState",
      detail: status.error ?? "state_not_open",
      persistDisconnected: true,
    };
  }
  // Fail closed para disparo em massa: estado inconclusivo nao deve enviar.
  // Nao persiste desconexao para evitar falsos negativos por timeout/transitorio.
  if (status.live === null) {
    return {
      ready: false,
      source: "connectionState_transient",
      detail: status.error ?? "transient",
      persistDisconnected: false,
    };
  }
  const map = await buildFetchInstancesStatusMap(apiUrl, apiKey, 15000);
  const key = normalizeInstanceKey(instanceName);
  const fromList = map.get(key);
  if (fromList === true) {
    return {
      ready: false,
      source: "fetchInstances_only",
      detail: "connectionState_indisponivel_lista_open",
      persistDisconnected: false,
    };
  }
  return {
    ready: false,
    source: status.source,
    detail: status.error ?? "unknown",
    persistDisconnected: false,
  };
}

/**
 * Pronto para validação em lote (Disparador 2): aceita chip OPEN na lista fetchInstances
 * ou connectionState open — mais permissivo que isInstanceReadyToSend (disparo).
 */
export async function isInstanceReadyForValidation(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  fetchMap?: Map<string, boolean | null>,
): Promise<{ ready: boolean; source: string; detail?: string }> {
  const key = normalizeInstanceKey(instanceName);

  let fromList: boolean | null | undefined = fetchMap?.get(key);
  if (fromList === undefined) {
    const map = fetchMap ?? (await buildFetchInstancesStatusMap(apiUrl, apiKey, 20000));
    fromList = map.get(key);
  }

  if (fromList === true) {
    return { ready: true, source: "fetchInstances" };
  }

  const status = await fetchConnectionStateSingle(apiUrl, apiKey, instanceName, 12000, true);
  if (status.live === true) {
    return { ready: true, source: "connectionState" };
  }

  return {
    ready: false,
    source: status.source,
    detail: status.error ?? "not_ready",
  };
}
