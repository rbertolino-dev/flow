/** URL pública da API Supabase no browser (auth, REST, functions). Em produção com proxy same-origin, use o mesmo host da app. */
const DEFAULT_DEV_DIRECT_URL = 'https://ogeljmbhqxpfjbpnbwog.supabase.co';

export function getSupabasePublicBaseUrl(): string {
  const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (raw && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '');
  }
  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return DEFAULT_DEV_DIRECT_URL;
}
