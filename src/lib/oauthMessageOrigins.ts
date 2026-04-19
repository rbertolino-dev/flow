import { AGILIZE_SITE_HOSTNAMES } from "@/constants/branding";

/**
 * Origins permitidas para validar `event.origin` em postMessage (OAuth popup → app).
 * Inclui variante www/apex quando o host é o site Agilize, para o caso de VITE_SUPABASE_URL
 * estar num host e o utilizador abrir no outro.
 */
export function getOAuthMessageAllowedOrigins(): string[] {
  const set = new Set<string>();
  const hosts = AGILIZE_SITE_HOSTNAMES as readonly string[];

  const addOrigin = (urlLike: string) => {
    if (!urlLike?.trim()) return;
    try {
      const u = new URL(urlLike.includes("://") ? urlLike : `https://${urlLike}`);
      set.add(u.origin);
      const h = u.hostname;
      if (hosts.includes(h)) {
        const otherHost = h.startsWith("www.") ? h.slice(4) : `www.${h}`;
        const port = u.port ? `:${u.port}` : "";
        set.add(`${u.protocol}//${otherHost}${port}`);
      }
    } catch {
      /* ignore */
    }
  };

  if (typeof window !== "undefined") {
    addOrigin(window.location.origin);
  }
  addOrigin(import.meta.env.VITE_SUPABASE_URL || "");

  return [...set];
}
