/**
 * Relatório de quedas por instância dentro de uma campanha do Disparador 2.
 * Fonte preferencial: RPC get_broadcast_campaign_instance_fall_report.
 * Fallback: agrega linhas da fila já carregadas no cliente.
 */

export type CampaignInstanceFallRow = {
  instance_id: string;
  instance_name: string;
  sent_count: number;
  failed_count: number;
  disconnect_fail_count: number;
  pending_or_scheduled_count: number;
  first_disconnect_at: string | null;
  last_sent_at: string | null;
  sent_before_disconnect: number;
  fell: boolean;
  sample_disconnect_error: string | null;
  is_connected: boolean | null;
};

export function isDisconnectFailureMessage(
  errorMessage?: string | null,
  failureCode?: string | null,
): boolean {
  const code = String(failureCode ?? "").toUpperCase();
  if (code === "INSTANCE_UNAVAILABLE" || code === "CONNECTION_CLOSED") return true;
  const msg = String(errorMessage ?? "").toLowerCase();
  if (!msg) return false;
  return (
    /desconect/.test(msg) ||
    /connection closed/.test(msg) ||
    /connectionstate/.test(msg) ||
    /precondition required/.test(msg) ||
    /sess[aã]o.*(fech|closed)/.test(msg) ||
    /chip.*(off|caiu)/.test(msg) ||
    /falso positivo/.test(msg)
  );
}

type QueueLogLike = {
  instance_id?: string | null;
  status?: string | null;
  sent_at?: string | null;
  failed_at?: string | null;
  last_attempt_at?: string | null;
  error_message?: string | null;
  failure_code?: string | null;
  instance?: { id?: string; instance_name?: string | null; is_connected?: boolean | null } | null;
};

export function aggregateInstanceFallReportFromLogs(
  logs: QueueLogLike[],
): CampaignInstanceFallRow[] {
  type Acc = {
    instance_id: string;
    instance_name: string;
    is_connected: boolean | null;
    sent: { at: string }[];
    failed: number;
    disconnectFails: { at: string; error: string | null }[];
    pendingOrScheduled: number;
  };

  const byId = new Map<string, Acc>();

  for (const log of logs) {
    const id = String(log.instance_id || log.instance?.id || "").trim();
    if (!id) continue;
    let acc = byId.get(id);
    if (!acc) {
      acc = {
        instance_id: id,
        instance_name: String(log.instance?.instance_name ?? "Instância"),
        is_connected: log.instance?.is_connected ?? null,
        sent: [],
        failed: 0,
        disconnectFails: [],
        pendingOrScheduled: 0,
      };
      byId.set(id, acc);
    }
    if (log.instance?.instance_name) acc.instance_name = String(log.instance.instance_name);
    if (typeof log.instance?.is_connected === "boolean") acc.is_connected = log.instance.is_connected;

    const status = String(log.status ?? "");
    if (status === "sent") {
      if (log.sent_at) acc.sent.push({ at: log.sent_at });
      else acc.sent.push({ at: "" });
    } else if (status === "failed") {
      acc.failed += 1;
      if (isDisconnectFailureMessage(log.error_message, log.failure_code)) {
        acc.disconnectFails.push({
          at: String(log.failed_at || log.last_attempt_at || ""),
          error: log.error_message ?? null,
        });
      }
    } else if (status === "pending" || status === "scheduled") {
      acc.pendingOrScheduled += 1;
    }
  }

  const rows: CampaignInstanceFallRow[] = [];
  for (const acc of byId.values()) {
    const disconnectSorted = [...acc.disconnectFails].sort((a, b) =>
      String(a.at).localeCompare(String(b.at)),
    );
    const firstDisconnectAt = disconnectSorted[0]?.at || null;
    const sentBefore =
      !firstDisconnectAt
        ? acc.sent.length
        : acc.sent.filter((s) => s.at && s.at <= firstDisconnectAt).length;
    const lastSent = [...acc.sent]
      .map((s) => s.at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    rows.push({
      instance_id: acc.instance_id,
      instance_name: acc.instance_name,
      sent_count: acc.sent.length,
      failed_count: acc.failed,
      disconnect_fail_count: acc.disconnectFails.length,
      pending_or_scheduled_count: acc.pendingOrScheduled,
      first_disconnect_at: firstDisconnectAt || null,
      last_sent_at: lastSent,
      sent_before_disconnect: sentBefore,
      fell: acc.disconnectFails.length > 0,
      sample_disconnect_error: disconnectSorted[0]?.error ?? null,
      is_connected: acc.is_connected,
    });
  }

  return rows.sort((a, b) => {
    if (a.fell !== b.fell) return a.fell ? -1 : 1;
    if (b.sent_before_disconnect !== a.sent_before_disconnect) {
      return b.sent_before_disconnect - a.sent_before_disconnect;
    }
    return b.sent_count - a.sent_count || a.instance_name.localeCompare(b.instance_name, "pt-BR");
  });
}

export function mapRpcFallReportRow(row: Record<string, unknown>): CampaignInstanceFallRow {
  return {
    instance_id: String(row.instance_id ?? ""),
    instance_name: String(row.instance_name ?? "Instância"),
    sent_count: Number(row.sent_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    disconnect_fail_count: Number(row.disconnect_fail_count ?? 0),
    pending_or_scheduled_count: Number(row.pending_or_scheduled_count ?? 0),
    first_disconnect_at: row.first_disconnect_at ? String(row.first_disconnect_at) : null,
    last_sent_at: row.last_sent_at ? String(row.last_sent_at) : null,
    sent_before_disconnect: Number(row.sent_before_disconnect ?? 0),
    fell: Boolean(row.fell),
    sample_disconnect_error: row.sample_disconnect_error
      ? String(row.sample_disconnect_error)
      : null,
    is_connected:
      typeof row.is_connected === "boolean" ? row.is_connected : null,
  };
}
