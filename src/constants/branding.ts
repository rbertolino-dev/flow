/** Logo no mesmo domínio da app — evita falha quando o DNS do cliente não resolve *.supabase.co */
export const AGILIZE_LOGO_URL = "/agilizeflow-logo.png";

/** Hostnames públicos (apex + www) — alinhar OAuth postMessage e redirects na dashboard Supabase */
export const AGILIZE_SITE_HOSTNAMES = ["agilizeflow.com.br", "www.agilizeflow.com.br"] as const;
