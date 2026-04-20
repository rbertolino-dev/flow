import { supabase } from "@/integrations/supabase/client";

export type EvolutionConnectionStateResult = {
  evolutionOk: boolean;
  evolutionHttpStatus: number | null;
  body: unknown;
  proxyError?: string;
  proxyMessage?: string;
  edgeError?: string;
};

/**
 * Consulta GET /instance/connectionState via Edge Function (sem CORS no browser).
 */
export async function fetchEvolutionConnectionStateByConfigId(
  configId: string,
): Promise<EvolutionConnectionStateResult> {
  const { data, error } = await supabase.functions.invoke("evolution-connection-state", {
    body: { configId },
  });

  if (error) {
    return {
      evolutionOk: false,
      evolutionHttpStatus: null,
      body: null,
      edgeError: error.message,
    };
  }

  const d = data as Partial<EvolutionConnectionStateResult> | null;
  if (!d || typeof d !== "object") {
    return {
      evolutionOk: false,
      evolutionHttpStatus: null,
      body: null,
      edgeError: "Resposta vazia da edge",
    };
  }

  return {
    evolutionOk: Boolean(d.evolutionOk),
    evolutionHttpStatus:
      typeof d.evolutionHttpStatus === "number" ? d.evolutionHttpStatus : null,
    body: d.body ?? null,
    proxyError: d.proxyError,
    proxyMessage: d.proxyMessage,
  };
}
