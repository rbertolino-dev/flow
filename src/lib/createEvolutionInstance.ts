import { supabase } from "@/integrations/supabase/client";

/**
 * Usa proxy same-origin em qualquer origem que não seja localhost (evita CORS).
 * Em dev (localhost/127.0.0.1) usa invoke; em produção usa /api/create-evolution-instance.
 */
function shouldUseProxy(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h !== "localhost" && h !== "127.0.0.1" && !h.endsWith(".local");
}

export async function callCreateEvolutionInstance(
  body: Record<string, unknown>
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { data: null, error: { message: "Usuário não autenticado" } };

  if (shouldUseProxy()) {
    try {
      const res = await fetch("/api/create-evolution-instance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const contentType = res.headers.get("Content-Type") || "";
      if (!contentType.includes("application/json")) {
        return { data: null, error: { message: "Resposta inválida do servidor. Verifique se o proxy está configurado." } };
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: { message: (data as { error?: string }).error || res.statusText || "Erro ao criar instância" } };
      }
      return { data: data as Record<string, unknown>, error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { data: null, error: { message: msg } };
    }
  }

  const { data, error } = await supabase.functions.invoke("create-evolution-instance", { body });
  return { data: data as Record<string, unknown> | null, error: error ? { message: error.message } : null };
}
