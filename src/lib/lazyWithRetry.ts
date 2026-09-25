import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const RELOAD_KEY = "agilize:chunk-reload-at";
const RELOAD_WINDOW_MS = 15_000;

/** Chunk com hash antigo depois de um deploy: o ficheiro já não existe no servidor. */
export function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    message
  );
}

/**
 * Recarrega a página uma vez para buscar o index.html novo (hashes atuais).
 * Uma segunda falha dentro da janela mostra o erro em vez de entrar em loop.
 */
export function reloadOnceForStaleChunk(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

// Mesma assinatura de React.lazy: o componente importado pode ter qualquer props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isStaleChunkError(error) && reloadOnceForStaleChunk()) {
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    })
  );
}
