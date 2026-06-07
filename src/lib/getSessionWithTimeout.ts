import { supabase } from "@/integrations/supabase/client";

/** Limite por chamada — evita UI presa se a API Auth do Supabase não responder */
export const GET_SESSION_TIMEOUT_MS = 6_000;

/** Sessão já em localStorage — falha mais rápido em rede degradada */
export const GET_SESSION_TIMEOUT_CACHED_MS = 3_000;

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
