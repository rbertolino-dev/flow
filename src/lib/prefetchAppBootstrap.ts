import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { seedOrgCache } from "@/lib/organizationUtils";

const STORAGE_KEY = "active_organization_id";
const PREFETCH_TIMEOUT_MS = 900;

/**
 * Após login, aquece org ativa + queries leves do menu/funil antes do redirect.
 * Falhas são ignoradas — a app refaz o fetch no mount.
 */
export async function prefetchAppBootstrap(session: Session): Promise<string | null> {
  const userId = session.user.id;

  try {
    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `
        organization_id,
        role,
        organizations (
          id,
          name
        )
      `
      )
      .eq("user_id", userId);

    if (error || !data?.length) {
      return null;
    }

    const orgIds = data.map((row: { organization_id: string }) => row.organization_id);
    let orgId = localStorage.getItem(STORAGE_KEY);
    if (!orgId || !orgIds.includes(orgId)) {
      orgId = orgIds[0];
    }

    seedOrgCache(orgId, userId);

    await Promise.allSettled([
      supabase
        .from("organization_limits")
        .select(
          `
          *,
          plans:plan_id (
            id,
            name,
            features
          )
        `
        )
        .eq("organization_id", orgId)
        .maybeSingle(),
      supabase
        .from("pipeline_stages")
        .select("id, name, color, position")
        .eq("organization_id", orgId)
        .order("position", { ascending: true }),
    ]);

    return orgId;
  } catch (err) {
    console.warn("[prefetchAppBootstrap] ignorado:", err);
    return null;
  }
}

/** Aguarda prefetch até timeout — não bloqueia redirect por muito tempo. */
export async function prefetchAppBootstrapWithTimeout(
  session: Session,
  timeoutMs = PREFETCH_TIMEOUT_MS
): Promise<void> {
  await Promise.race([
    prefetchAppBootstrap(session),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
