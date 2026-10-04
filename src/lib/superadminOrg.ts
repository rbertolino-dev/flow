import { supabase } from "@/integrations/supabase/client";

export type OrgAdminMeta = {
  id: string;
  is_active: boolean;
  admin_notes: string | null;
  vigencia_ends_at: string | null;
  updated_at: string;
};

type RpcError = { message: string; code?: string };

async function callRpc<T>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }> {
  const client = supabase as unknown as {
    rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError | null }>;
  };
  return client.rpc(name, args);
}

export type OrgModuleUsage = {
  feature: string;
  last_used_at: string;
};

export async function fetchOrgModuleUsage(orgId: string): Promise<OrgModuleUsage[]> {
  const { data, error } = await callRpc<OrgModuleUsage[]>("superadmin_list_module_usage", { _org_id: orgId });
  if (error) {
    console.warn("Uso de módulos indisponível:", error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function fetchOrgAdminMeta(): Promise<OrgAdminMeta[]> {
  const { data, error } = await callRpc<OrgAdminMeta[]>("superadmin_list_org_meta");
  if (error) {
    console.warn("Metadados do painel de organizações indisponíveis:", error.message);
    return [];
  }
  return data ?? [];
}

export async function updateOrgAdminMeta(args: {
  orgId: string;
  name?: string | null;
  isActive?: boolean | null;
  notes?: string | null;
  setNotes?: boolean;
  vigencia?: string | null;
  setVigencia?: boolean;
}): Promise<void> {
  const { error } = await callRpc<null>("superadmin_update_org_meta", {
    _org_id: args.orgId,
    _name: args.name ?? null,
    _is_active: args.isActive ?? null,
    _admin_notes: args.notes ?? null,
    _set_notes: args.setNotes ?? false,
    _vigencia: args.vigencia ?? null,
    _set_vigencia: args.setVigencia ?? false,
  });
  if (error) throw new Error(error.message);
}

export async function purgeFinancialEntries(orgId: string, direction: "receber" | "pagar"): Promise<number> {
  const { data, error } = await callRpc<number>("superadmin_purge_financial_entries", {
    _org_id: orgId,
    _direction: direction,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function posSalesAdmin(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Não autenticado");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pos-sales${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string; total?: number; deleted?: number };
  if (!response.ok) throw new Error(result.error || `Erro ${response.status}`);
  return result;
}

export async function fetchMonthInvoiceCount(): Promise<number | null> {
  try {
    const result = await posSalesAdmin("?action=admin_month_invoices");
    return Number(result.total ?? 0);
  } catch (error) {
    console.warn("Contagem de notas indisponível:", error);
    return null;
  }
}

export async function deleteAllOrgSales(organizationId: string): Promise<number> {
  const result = await posSalesAdmin("?action=admin_delete_org_sales", {
    method: "POST",
    body: JSON.stringify({ organization_id: organizationId }),
  });
  return Number(result.deleted ?? 0);
}

export function suggestVigencia(createdAt: string, billingPeriod: string | null, from = new Date()): string {
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) {
    const fallback = new Date(from);
    fallback.setMonth(fallback.getMonth() + 1);
    return fallback.toISOString().slice(0, 10);
  }
  const step = billingPeriod && /anual|annual|year/i.test(billingPeriod) ? 12 : 1;
  const next = new Date(start);
  let guard = 0;
  while (next <= from && guard < 240) {
    next.setMonth(next.getMonth() + step);
    guard += 1;
  }
  return next.toISOString().slice(0, 10);
}
