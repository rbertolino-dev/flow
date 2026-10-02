const STORAGE_KEY = 'agilize_auth_return';

function safeReturnPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return null;
  return value;
}

export function rememberAuthReturnPath() {
  if (typeof window === 'undefined') return;
  const path = `${window.location.pathname}${window.location.search}`;
  const safe = safeReturnPath(path);
  if (!safe) return;
  sessionStorage.setItem(STORAGE_KEY, safe);
}

let takenPath: string | null = null;

/** Mesmo destino para os dois redirecionamentos do login nesta carga da página. */
export function takeAuthReturnPath(): string {
  if (takenPath) return takenPath;
  const stored = typeof window === 'undefined' ? null : sessionStorage.getItem(STORAGE_KEY);
  if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
  takenPath = safeReturnPath(stored) || '/';
  return takenPath;
}
