import { supabase } from "@/integrations/supabase/client";

/** Limite por chamada — evita UI presa se a API Auth do Supabase não responder */
export const GET_SESSION_TIMEOUT_MS = 6_000;

export type GetSessionWithTimeoutResult = Awaited<
  ReturnType<typeof supabase.auth.getSession>
>;

/**
 * Envolve getSession com timeout. Em timeout devolve session null e error GETSESSION_TIMEOUT.
 */
export async function getSessionWithTimeout(): Promise<GetSessionWithTimeoutResult> {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<GetSessionWithTimeoutResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: { session: null },
            error: { message: "GETSESSION_TIMEOUT" } as GetSessionWithTimeoutResult["error"],
          }),
        GET_SESSION_TIMEOUT_MS
      )
    ),
  ]);
}
