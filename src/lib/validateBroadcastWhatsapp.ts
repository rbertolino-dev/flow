import { supabase } from "@/integrations/supabase/client";
import { parseContactList, type ParsedContact, type ValidationResult } from "@/lib/contactValidator";

function getSupabaseProjectRef(): string | null {
  const fromEnv = (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const parts = anon?.split(".") ?? [];
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { ref?: string };
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

function resolveFunctionsBaseUrl(): string {
  const configured = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
  if (!configured) return "";
  try {
    if (new URL(configured).hostname.endsWith(".supabase.co")) return configured;
  } catch {
    return configured;
  }
  const ref = getSupabaseProjectRef();
  return ref ? `https://${ref}.supabase.co` : configured;
}

/** Máx. números por chamada à edge (2 lotes Evolution × 50; cabe no timeout ~60s). */
export const BROADCAST_WHATSAPP_VALIDATION_BATCH_SIZE = 100;

/** Máx. chips no rodízio de validação (opção 2 — não usa todos os 28 de uma vez). */
export const BROADCAST_VALIDATION_ROTATOR_MAX = 6;

/** Pausa entre lotes quando há rodízio de chips (reduz pico na Evolution). */
export const BROADCAST_VALIDATION_INTER_BATCH_DELAY_MS = 1200;

export type BroadcastWhatsappValidationResponse = {
  ok: boolean;
  skippedApiValidation?: boolean;
  usedInstance?: string | null;
  usedInstanceId?: string | null;
  warning?: string;
  validatedNumbers?: string[];
  rejectedNumbers?: string[];
  error?: string;
};

export type BroadcastValidationProgress = {
  processed: number;
  total: number;
  batchIndex: number;
  batchCount: number;
  validatorInstanceId?: string;
  validatorInstanceName?: string;
};

export type ValidateBroadcastEdgeOptions = {
  preferredInstanceId?: string | null;
};

/**
 * Validação WhatsApp no servidor (Evolution), mesma rede do sync — evita CORS e Connection Closed falso no browser.
 */
export async function validateBroadcastWhatsappViaEdge(
  organizationId: string,
  instanceIds: string[],
  numbers: string[],
  useLatamValidator: boolean,
  edgeOptions?: ValidateBroadcastEdgeOptions,
): Promise<BroadcastWhatsappValidationResponse> {
  const baseUrl = resolveFunctionsBaseUrl();
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!baseUrl || !anon) {
    return { ok: false, error: "Configuração Supabase ausente" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Sessão expirada" };
  }

  const post = async (token: string) => {
    const res = await fetch(`${baseUrl}/functions/v1/validate-broadcast-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anon,
      },
      body: JSON.stringify({
        organizationId,
        instanceIds,
        numbers,
        useLatamValidator,
        ...(edgeOptions?.preferredInstanceId
          ? { preferredInstanceId: edgeOptions.preferredInstanceId }
          : {}),
      }),
    });
    const text = await res.text();
    let payload: BroadcastWhatsappValidationResponse = { ok: false };
    try {
      payload = JSON.parse(text) as BroadcastWhatsappValidationResponse;
    } catch {
      payload = {
        ok: false,
        error:
          res.status === 504
            ? "Validação expirou (muitos números de uma vez). Tente novamente — o sistema divide em lotes automaticamente."
            : text.slice(0, 200),
      };
    }
    if (!res.ok && !payload.error) {
      payload = {
        ...payload,
        ok: false,
        error:
          res.status === 504
            ? "Tempo esgotado na validação WhatsApp (504). Aguarde e tente de novo."
            : `HTTP ${res.status}`,
      };
    }
    return { res, payload };
  };

  let token = session.access_token;
  let { res, payload } = await post(token);
  if (res.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session?.access_token) {
      token = refreshed.session.access_token;
      ({ res, payload } = await post(token));
    }
  }

  if (!res.ok && payload.error) {
    return { ...payload, ok: false };
  }
  return payload;
}

/**
 * Pool de chips para rodízio na validação (opção 2).
 * Respeita a ordem da seleção; ignora chips explicitamente desconectados no DB.
 */
export function buildValidationRotatorPool(
  instanceIds: string[],
  instancesList: Array<{ id: string; instance_name?: string | null; is_connected?: boolean | null }>,
  maxChips: number = BROADCAST_VALIDATION_ROTATOR_MAX,
): string[] {
  const pool: string[] = [];
  const seen = new Set<string>();

  for (const rawId of instanceIds) {
    const id = String(rawId).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const inst = instancesList.find((i) => String(i.id) === id);
    if (inst?.is_connected === false) continue;
    pool.push(id);
    if (pool.length >= maxChips) break;
  }

  if (pool.length === 0) {
    const fallback = instanceIds.map((id) => String(id).trim()).find(Boolean);
    if (fallback) pool.push(fallback);
  }

  return pool;
}

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Valida listas grandes em várias chamadas curtas à edge (evita 504 do gateway Supabase).
 */
export async function validateBroadcastWhatsappBatched(
  organizationId: string,
  instanceIds: string[],
  numbers: string[],
  useLatamValidator: boolean,
  options?: {
    preferredInstanceId?: string | null;
    /** Opção 2: até 6 chips em rodízio (um chip por lote de números). */
    rotatorInstanceIds?: string[];
    onProgress?: (progress: BroadcastValidationProgress) => void;
    batchSize?: number;
    instanceIdToName?: Map<string, string>;
  },
): Promise<BroadcastWhatsappValidationResponse> {
  const batchSize = options?.batchSize ?? BROADCAST_WHATSAPP_VALIDATION_BATCH_SIZE;
  const batches = chunkArray(numbers, batchSize);
  const rotator = (options?.rotatorInstanceIds ?? []).map((id) => String(id).trim()).filter(Boolean);
  const useRotator = rotator.length > 1;

  const preferredForBatchIndex = (batchIndex: number): string | null => {
    if (useRotator) return rotator[batchIndex % rotator.length] ?? null;
    return options?.preferredInstanceId ?? rotator[0] ?? null;
  };

  const emitProgress = (batchIndex: number, processed: number) => {
    const validatorInstanceId = preferredForBatchIndex(batchIndex) ?? undefined;
    options?.onProgress?.({
      processed,
      total: numbers.length,
      batchIndex: batchIndex + 1,
      batchCount: batches.length,
      validatorInstanceId,
      validatorInstanceName: validatorInstanceId
        ? options?.instanceIdToName?.get(validatorInstanceId)
        : undefined,
    });
  };

  if (batches.length === 0) {
    return { ok: true, validatedNumbers: [], rejectedNumbers: [] };
  }

  if (batches.length === 1) {
    emitProgress(0, 0);
    const single = await validateBroadcastWhatsappViaEdge(
      organizationId,
      instanceIds,
      batches[0],
      useLatamValidator,
      { preferredInstanceId: preferredForBatchIndex(0) },
    );
    emitProgress(0, numbers.length);
    if (single.ok && useRotator) {
      single.warning =
        single.warning ??
        `Validação no chip ${single.usedInstance ?? "selecionado"} (rodízio ativo em listas maiores).`;
    }
    return single;
  }

  const validatedNumbers: string[] = [];
  const rejectedNumbers: string[] = [];
  let usedInstance: string | null = null;
  let usedInstanceId: string | null = null;
  let warning: string | undefined;
  const usedInstanceNames = new Set<string>();

  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b];
    const preferredForBatch = preferredForBatchIndex(b);

    if (b > 0 && useRotator) {
      await sleepMs(BROADCAST_VALIDATION_INTER_BATCH_DELAY_MS);
    }

    emitProgress(b, Math.min(b * batchSize, numbers.length));

    const edge = await validateBroadcastWhatsappViaEdge(
      organizationId,
      instanceIds,
      batch,
      useLatamValidator,
      { preferredInstanceId: preferredForBatch },
    );

    if (!edge.ok) {
      const partial = validatedNumbers.length + rejectedNumbers.length;
      const suffix =
        partial > 0
          ? ` (${partial} de ${numbers.length} já processados antes da falha)`
          : "";
      return {
        ok: false,
        error: (edge.error ?? "Falha na validação WhatsApp") + suffix,
        validatedNumbers,
        rejectedNumbers,
        usedInstance,
        usedInstanceId,
      };
    }

    validatedNumbers.push(...(edge.validatedNumbers ?? []));
    rejectedNumbers.push(...(edge.rejectedNumbers ?? []));
    if (edge.usedInstance) {
      usedInstance = edge.usedInstance;
      usedInstanceNames.add(edge.usedInstance);
    }
    if (edge.usedInstanceId) usedInstanceId = edge.usedInstanceId;
    if (edge.warning) warning = edge.warning;
  }

  emitProgress(batches.length - 1, numbers.length);

  if (useRotator && usedInstanceNames.size > 0) {
    const names = [...usedInstanceNames].slice(0, 6).join(", ");
    warning =
      warning ??
      `Validação distribuída em ${usedInstanceNames.size} chip(s): ${names}${usedInstanceNames.size > 6 ? "…" : ""}.`;
  }

  return {
    ok: true,
    skippedApiValidation: false,
    usedInstance,
    usedInstanceId,
    warning,
    validatedNumbers,
    rejectedNumbers,
  };
}

/** Monta ValidationResult a partir da lista parseada + resposta da edge. */
export function buildValidationResultFromEdge(
  text: string,
  edge: BroadcastWhatsappValidationResponse,
  useLatamValidator: boolean,
): ValidationResult {
  const parsed = parseContactList(text, useLatamValidator);
  const validSet = new Set(edge.validatedNumbers ?? []);
  const whatsappValidated: ParsedContact[] = [];
  const whatsappRejected: ParsedContact[] = [];

  for (const c of parsed) {
    if (!c.valid) continue;
    if (validSet.has(c.phone)) whatsappValidated.push(c);
    else whatsappRejected.push({ ...c, valid: false, error: "Sem WhatsApp" });
  }

  return {
    validContacts: parsed.filter((c) => c.valid),
    invalidContacts: parsed.filter((c) => !c.valid),
    whatsappValidated,
    whatsappRejected: [...parsed.filter((c) => !c.valid), ...whatsappRejected],
  };
}

export function isBroadcastValidationSkipped(edge: BroadcastWhatsappValidationResponse): boolean {
  return edge.skippedApiValidation === true;
}
