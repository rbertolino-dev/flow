/**
 * Implementação de lock para o GoTrueClient que não usa Navigator.locks.
 * Evita "Lock broken by another request with the 'steal' option" quando várias
 * partes da app chamam getUser/getSession em paralelo (sincronização, templates, etc.).
 */
export async function immediateAuthLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  return fn();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Erros transitórios do mutex de sessão do Supabase (Navigator Lock / steal). */
export function isAuthStorageLockError(error: unknown): boolean {
  if (error == null) return false;
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'AbortError') return true;
  if (message.includes('Lock broken by another request')) return true;
  if (message.includes('stole it')) return true;
  if (message.includes('lock:sb-') && message.includes('auth-token')) return true;
  return false;
}
