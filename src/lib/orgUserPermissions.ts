import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { AVAILABLE_FEATURES, type FeatureKey } from "@/hooks/useOrganizationFeatures";

export type PermissionAction = "view" | "edit" | "delete";

type FeaturePermissionSpec = {
  feature: FeatureKey;
  view: string;
  edit: string;
  delete: string;
  editAlso?: string[];
  readAliases?: Partial<Record<PermissionAction, string[]>>;
};

const SPECIAL: Partial<Record<FeatureKey, Omit<FeaturePermissionSpec, "feature">>> = {
  leads: {
    view: "view_leads",
    edit: "edit_leads",
    delete: "delete_leads",
    editAlso: ["create_leads"],
    readAliases: { edit: ["create_leads"] },
  },
  call_queue: {
    view: "view_call_queue",
    edit: "edit_call_queue",
    delete: "delete_call_queue",
    readAliases: { edit: ["manage_call_queue"] },
  },
  broadcast: {
    view: "view_broadcast",
    edit: "edit_broadcast",
    delete: "delete_broadcast",
    readAliases: { edit: ["create_broadcast"] },
  },
  whatsapp_messages: {
    view: "view_whatsapp_messages",
    edit: "edit_whatsapp_messages",
    delete: "delete_whatsapp_messages",
    readAliases: { view: ["view_whatsapp"], edit: ["send_whatsapp"] },
  },
  reports: {
    view: "view_reports",
    edit: "edit_reports",
    delete: "delete_reports",
  },
};

const EXISTING_APP_PERMISSIONS = new Set([
  "view_leads",
  "create_leads",
  "edit_leads",
  "delete_leads",
  "view_call_queue",
  "manage_call_queue",
  "view_broadcast",
  "create_broadcast",
  "view_whatsapp",
  "send_whatsapp",
  "view_templates",
  "manage_templates",
  "view_pipeline",
  "manage_pipeline",
  "view_settings",
  "manage_settings",
  "manage_users",
  "view_reports",
]);

function specFor(feature: FeatureKey): FeaturePermissionSpec {
  const special = SPECIAL[feature];
  if (special) return { feature, ...special };
  return {
    feature,
    view: `view_${feature}`,
    edit: `edit_${feature}`,
    delete: `delete_${feature}`,
  };
}

export function messageFromUnknown(error: unknown, fallback = "Erro desconhecido"): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}

export function specActions(feature: FeatureKey): Array<{ action: PermissionAction; label: string; value: string }> {
  const spec = specFor(feature);
  return [
    { action: "view", label: "Ler", value: spec.view },
    { action: "edit", label: "Editar", value: spec.edit },
    { action: "delete", label: "Excluir", value: spec.delete },
  ];
}

export function permissionKeysForAction(feature: FeatureKey, action: PermissionAction): string[] {
  const spec = specFor(feature);
  return [spec[action], ...(spec.readAliases?.[action] ?? [])];
}

export function hasPermissionAction(
  stored: string[],
  feature: FeatureKey,
  action: PermissionAction,
): boolean {
  const keys = permissionKeysForAction(feature, action);
  return keys.some((key) => stored.includes(key));
}

export function managedPermissionKeys(features: FeatureKey[]): string[] {
  const keys = new Set<string>();
  for (const feature of features) {
    const spec = specFor(feature);
    keys.add(spec.view);
    keys.add(spec.edit);
    keys.add(spec.delete);
    spec.editAlso?.forEach((key) => keys.add(key));
    (["view", "edit", "delete"] as PermissionAction[]).forEach((action) => {
      spec.readAliases?.[action]?.forEach((key) => keys.add(key));
    });
  }
  return Array.from(keys);
}

export function canonicalPermissionsFromStored(stored: string[], features: FeatureKey[]): string[] {
  const selected: string[] = [];
  for (const feature of features) {
    const spec = specFor(feature);
    (["view", "edit", "delete"] as PermissionAction[]).forEach((action) => {
      if (hasPermissionAction(stored, feature, action)) {
        selected.push(spec[action]);
      }
    });
  }
  return selected;
}

export function permissionsToPersist(selectedCanonical: string[], features: FeatureKey[]): string[] {
  const selected = new Set(selectedCanonical);
  const toInsert = new Set<string>();
  for (const feature of features) {
    const spec = specFor(feature);
    (["view", "edit", "delete"] as PermissionAction[]).forEach((action) => {
      if (selected.has(spec[action])) {
        toInsert.add(spec[action]);
        if (action === "edit") {
          spec.editAlso?.forEach((key) => toInsert.add(key));
        }
      }
    });
  }
  return Array.from(toInsert);
}

export function newAppPermissionValues(): string[] {
  const values = new Set<string>();
  for (const feature of AVAILABLE_FEATURES) {
    const spec = specFor(feature.value);
    [spec.view, spec.edit, spec.delete].forEach((key) => {
      if (!EXISTING_APP_PERMISSIONS.has(key)) values.add(key);
    });
  }
  return Array.from(values);
}

export function resolveReleasedFeatureKeys(input: {
  planFeatures: string[];
  enabledFeatures: string[];
  disabledFeatures: string[];
  isInTrial: boolean;
}): FeatureKey[] {
  const known = new Set<string>(AVAILABLE_FEATURES.map((feature) => feature.value));
  if (input.isInTrial) {
    return AVAILABLE_FEATURES.map((feature) => feature.value).filter(
      (feature) => !input.disabledFeatures.includes(feature),
    );
  }

  const features = new Set([...input.planFeatures, ...input.enabledFeatures]);
  input.disabledFeatures.forEach((feature) => features.delete(feature));

  return AVAILABLE_FEATURES.map((feature) => feature.value).filter(
    (feature) => features.has(feature) && known.has(feature),
  );
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (value && typeof value === "object") {
    return Object.values(value).filter((item): item is string => typeof item === "string");
  }
  return [];
}

export async function fetchReleasedFeatureKeys(organizationId: string): Promise<FeatureKey[]> {
  const { data: limitsData, error } = await supabase
    .from("organization_limits")
    .select(`
      trial_ends_at,
      enabled_features,
      disabled_features,
      plans:plan_id (
        features
      )
    `)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!limitsData) return [];

  const planData = limitsData.plans as { features: unknown } | null;
  const trialEndsAt = limitsData.trial_ends_at ? new Date(limitsData.trial_ends_at) : null;

  return resolveReleasedFeatureKeys({
    planFeatures: asStringArray(planData?.features),
    enabledFeatures: asStringArray(limitsData.enabled_features),
    disabledFeatures: asStringArray(limitsData.disabled_features),
    isInTrial: trialEndsAt !== null && trialEndsAt > new Date(),
  });
}

type AppPermission = Database["public"]["Enums"]["app_permission"];

export async function saveUserFeaturePermissions(params: {
  userId: string;
  organizationId: string;
  selectedCanonical: string[];
  visibleFeatures: FeatureKey[];
}): Promise<void> {
  const managed = managedPermissionKeys(params.visibleFeatures);
  if (managed.length > 0) {
    const { error: deleteError } = await supabase
      .from("user_permissions")
      .delete()
      .eq("user_id", params.userId)
      .eq("organization_id", params.organizationId)
      .in("permission", managed as unknown as AppPermission[]);

    if (deleteError) throw deleteError;
  }

  const toInsert = permissionsToPersist(params.selectedCanonical, params.visibleFeatures);
  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase.from("user_permissions").insert(
    toInsert.map((permission) => ({
      user_id: params.userId,
      organization_id: params.organizationId,
      permission: permission as unknown as AppPermission,
    })),
  );

  if (insertError) throw insertError;
}
