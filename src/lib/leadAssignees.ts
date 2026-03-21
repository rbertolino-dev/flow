import { supabase } from "@/integrations/supabase/client";

/** Atualiza leads.assigned_to com o e-mail do primeiro responsável (ordem created_at) para compatibilidade com fluxos/relatórios. */
export async function syncLeadPrimaryAssignedTo(leadId: string): Promise<void> {
  const { data, error } = await supabase
    .from("lead_assignees")
    .select("created_at, profiles(email)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const firstProfile = rows[0]?.profiles as { email?: string | null } | null | undefined;
  const email = firstProfile?.email ?? null;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      assigned_to: email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (updateError) throw updateError;
}
