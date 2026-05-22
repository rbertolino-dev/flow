import { supabase } from "@/integrations/supabase/client";
import { extractConnectionState } from "@/lib/evolutionStatus";
import { fetchEvolutionConnectionStateByConfigId } from "@/lib/evolutionConnectionStateProxy";

export type InstanceRowForDisconnect = {
  id: string;
  instance_name?: string | null;
  is_connected?: boolean | null;
};

export type DisconnectedInstanceInfo = { id: string; name: string };

/** Lista preliminar: apenas is_connected === false (null/unknown não bloqueia). */
export function getExplicitlyDisconnected(
  ids: string[],
  instancesList: InstanceRowForDisconnect[],
): DisconnectedInstanceInfo[] {
  const out: DisconnectedInstanceInfo[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const id = String(rawId).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const inst = instancesList.find((i) => String(i.id) === id);
    if (!inst) {
      out.push({
        id,
        name: "Instância não encontrada (removida ou indisponível)",
      });
      continue;
    }
    if (inst.is_connected === false) {
      out.push({
        id: String(inst.id),
        name: String(inst.instance_name ?? "Instância"),
      });
    }
  }
  return out;
}

const LIVE_CHECK_CONCURRENCY = 5;

/**
 * Revalida na Evolution API instâncias marcadas desconectadas no DB.
 * Se a API confirmar open, atualiza is_connected e remove da lista de bloqueio.
 */
export async function resolveDisconnectedWithLiveCheck(
  ids: string[],
  instancesList: InstanceRowForDisconnect[],
): Promise<{
  disconnected: DisconnectedInstanceInfo[];
  liveRecheckCount: number;
  reconciledConnected: number;
}> {
  const preliminary = getExplicitlyDisconnected(ids, instancesList);
  if (preliminary.length === 0) {
    return { disconnected: [], liveRecheckCount: 0, reconciledConnected: 0 };
  }

  const stillDisconnected: DisconnectedInstanceInfo[] = [];
  let reconciledConnected = 0;

  for (let i = 0; i < preliminary.length; i += LIVE_CHECK_CONCURRENCY) {
    const batch = preliminary.slice(i, i + LIVE_CHECK_CONCURRENCY);
    await Promise.all(
      batch.map(async (entry) => {
        if (entry.name.includes("não encontrada")) {
          stillDisconnected.push(entry);
          return;
        }

        const result = await fetchEvolutionConnectionStateByConfigId(entry.id);
        // Falha de rede/edge não confirma desconexão — não bloquear campanha por isso
        if (result.edgeError || result.proxyError || !result.evolutionOk) {
          return;
        }

        const live = extractConnectionState(result.body);
        if (live === true) {
          reconciledConnected += 1;
          const { error } = await supabase
            .from("evolution_config")
            .update({
              is_connected: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", entry.id);
          if (error) {
            console.error("Erro ao reconciliar is_connected:", entry.id, error);
            stillDisconnected.push(entry);
          }
          return;
        }

        if (live === false) {
          stillDisconnected.push(entry);
          return;
        }

        // Estado transitório / formato desconhecido: não bloquear campanha
      }),
    );
  }

  return {
    disconnected: stillDisconnected,
    liveRecheckCount: preliminary.length,
    reconciledConnected,
  };
}
