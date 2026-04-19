import { isTransientSupabaseMessage } from "@/lib/utils";

type MinimalPostgrestError = { message: string; code?: string; details?: string };

function isTransientError(error: MinimalPostgrestError | null | undefined): boolean {
  return isTransientSupabaseMessage(error?.message);
}

/**
 * Reexecuta uma operação Supabase { data, error } quando o erro parece transitório
 * (502 HTML do nginx, timeout, falha de rede). Reduz falhas visíveis em picos curtos.
 */
export async function supabaseQueryWithRetry<T>(
  op: () => Promise<{ data: T | null; error: MinimalPostgrestError | null }>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<{ data: T | null; error: MinimalPostgrestError | null }> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 400;
  let last: { data: T | null; error: MinimalPostgrestError | null } | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await op();
    if (!last.error) return last;
    if (!isTransientError(last.error) || attempt === maxAttempts) return last;
    await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
  }
  return last!;
}
