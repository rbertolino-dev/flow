import { supabase } from "@/integrations/supabase/client";

/** Limite por chamada — evita UI presa se a API Auth do Supabase não responder */
export const GET_SESSION_TIMEOUT_MS = 6_000;

/** Sessão já em localStorage — falha mais rápido em rede degradada */
export const GET_SESSION_TIMEOUT_CACHED_MS = 3_000;

/** JWT/refresh morto: o funil não deve ficar em skeleton à espera de um token que o servidor já revogou. */
export function isInvalidAuthError(error: unknown): boolean {
  if (error == null) return false;
  const e = error as { message?: string; code?: string; status?: number; name?: string };
  const msg = String(e.message || "").toLowerCase();
  const code = String(e.code || "");
  return (
    e.status === 401 ||
    code === "401" ||
    code === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid jwt") ||
    msg.includes("invalid claim") ||
    msg.includes("not authenticated") ||
    msg.includes("session from session_id claim in jwt does not exist") ||
    msg.includes("refresh_token_not_found") ||
    msg.includes("invalid refresh token") ||
    msg.includes("auth session missing")
  );
}

/** Limpa só o storage local — o servidor já pode não ter sessão/refresh. */
export async function clearDeadLocalSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // storage já pode estar inconsistente
  }
}

export type GetSessionWithTimeoutResult = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>;

export type GetSessionWithTimeoutOptions = {
  timeoutMs?: number;
};

/**
 * Envolve getSession com timeout. Em timeout devolve session null e error GETSESSION_TIMEOUT.
 */
export async function getSessionWithTimeout(
  options?: GetSessionWithTimeoutOptions
): Promise<GetSessionWithTimeoutResult> {
  const timeoutMs = options?.timeoutMs ?? GET_SESSION_TIMEOUT_MS;
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<GetSessionWithTimeoutResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: { session: null },
            error: { message: "GETSESSION_TIMEOUT" } as GetSessionWithTimeoutResult["error"],
          }),
        timeoutMs
      )
    ),
  ]);
}
