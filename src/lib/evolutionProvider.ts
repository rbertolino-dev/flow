import { normalizeApiUrl } from "@/lib/evolutionStatus";

export type EvolutionProviderInfo = {
  provider_id: string;
  provider_name: string;
  api_url: string;
  api_key?: string;
};

export function urlsMatchEvolution(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeApiUrl(a) === normalizeApiUrl(b);
}

export function matchEvolutionProvider(
  apiUrl: string | null | undefined,
  providers: EvolutionProviderInfo[],
): EvolutionProviderInfo | null {
  if (!apiUrl) return null;
  return providers.find((p) => urlsMatchEvolution(p.api_url, apiUrl)) ?? null;
}

/** Rótulo visível quando não há provider cadastrado (hostname da URL). */
export function fallbackEvolutionLabel(apiUrl: string | null | undefined): string {
  if (!apiUrl) return "Evolution";
  try {
    const host = new URL(normalizeApiUrl(apiUrl)).hostname.replace(/^www\./i, "");
    if (host.includes("ordemservico")) return "api.ordemservico";
    const first = host.split(".")[0] || host;
    const withSpace = first.replace(/^(evo)(\d+)/i, "evo $2");
    return withSpace;
  } catch {
    return "Evolution";
  }
}

export function evolutionProviderLabel(
  apiUrl: string | null | undefined,
  providers: EvolutionProviderInfo[],
  storedName?: string | null,
): string {
  if (storedName?.trim()) return storedName.trim();
  const match = matchEvolutionProvider(apiUrl, providers);
  if (match) return match.provider_name;
  return fallbackEvolutionLabel(apiUrl);
}

const BADGE_TONES = [
  "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
  "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800",
  "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
  "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800",
  "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800",
] as const;

export function evolutionProviderBadgeClass(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return BADGE_TONES[hash % BADGE_TONES.length];
}
