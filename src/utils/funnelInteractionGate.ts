/** Janela curta em que atualizações pesadas em background ficam adiadas após exibir o funil. */
const DEFAULT_PAUSE_MS = 4000;

let pauseUntil = 0;

export function markFunnelKanbanInteraction(extraMs = DEFAULT_PAUSE_MS): void {
  pauseUntil = Math.max(pauseUntil, Date.now() + extraMs);
}

export function isFunnelKanbanInteractionWindow(): boolean {
  return Date.now() < pauseUntil;
}

/** Milissegundos restantes na janela de interação (0 se já expirou). */
export function funnelInteractionDelayExtra(): number {
  return Math.max(0, pauseUntil - Date.now());
}

/** Executa após a janela de interação (ou imediatamente se já expirou). */
export function runAfterFunnelInteractionWindow(
  fn: () => void,
  maxWaitMs = 12_000
): () => void {
  const delay = Math.max(0, pauseUntil - Date.now());
  if (delay <= 0) {
    fn();
    return () => {};
  }
  const wait = Math.min(delay, maxWaitMs);
  const timerId = window.setTimeout(fn, wait);
  return () => window.clearTimeout(timerId);
}
