/**
 * GoTrue usa um lock no storage do token; com várias abas ou requests em paralelo
 * pode ocorrer: "Lock ... auth-token ... was released because another request stole it".
 * Não é falha de permissão — é transitório; um retry curto costuma resolver.
 */
export function isAuthStorageLockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /stole it/i.test(msg) ||
    (/lock:.*auth-token/i.test(msg) && /released/i.test(msg))
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
