import { supabase } from "@/integrations/supabase/client";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

const PATH_FEATURES: Array<[prefix: string, feature: string]> = [
  ["/crm", "leads"],
  ["/post-sale", "post_sale"],
  ["/calendar", "calendar"],
  ["/broadcast-2", "broadcast"],
  ["/broadcast", "broadcast"],
  ["/automation-flows", "automations"],
  ["/workflows", "automations"],
  ["/form-builder", "form_builder"],
  ["/contracts", "contracts"],
  ["/budgets", "budgets"],
  ["/pdv", "pos"],
  ["/nota-fiscal", "nota_fiscal"],
  ["/service-orders", "service_orders"],
  ["/financeiro", "finance"],
  ["/relatorios", "reports"],
  ["/employees", "employees"],
  ["/admin/landing-page", "landing_page"],
  ["/wordpress-conteudo", "wordpress_content"],
];

export function featureFromLocation(pathname: string, state: unknown): string | null {
  if (pathname === "/") {
    const view = state && typeof state === "object" && "view" in state ? state.view : null;
    return view === "calls" ? "call_queue" : "leads";
  }
  const match = PATH_FEATURES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : null;
}

export function recordModuleUse(organizationId: string, feature: string | null): void {
  if (!organizationId || !feature) return;
  const storageKey = `module_use_at:${organizationId}:${feature}`;
  const previous = Number(localStorage.getItem(storageKey) || 0);
  if (Number.isFinite(previous) && Date.now() - previous < SIX_HOURS_MS) return;
  localStorage.setItem(storageKey, String(Date.now()));

  const client = supabase as unknown as {
    rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  void client.rpc("record_module_use", { _organization_id: organizationId, _feature: feature }).then(({ error }) => {
    if (error) localStorage.removeItem(storageKey);
  });
}
