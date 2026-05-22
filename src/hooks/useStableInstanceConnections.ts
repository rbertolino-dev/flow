import { useEffect, useRef, useState } from "react";
import {
  flushStableStatuses,
  normalizeConnectionBool,
  upsertPending,
  type StableConnectionPending,
} from "@/lib/stableConnectionStatus";

type RowWithConnection = {
  id: string;
  is_connected?: boolean | null;
};

function mapStableList<T extends RowWithConnection>(
  list: T[],
  displayed: Record<string, boolean | null>,
): T[] {
  return list.map((inst) => {
    const stable = displayed[inst.id];
    if (stable === undefined || stable === null) return inst;
    return { ...inst, is_connected: stable };
  });
}

/**
 * Camada de exibição/bloqueio conservador: is_connected do Supabase pode oscilar;
 * o disparador e o painel usam este valor estabilizado para não piscar nem bloquear à toa.
 */
export function useStableInstanceConnections<T extends RowWithConnection>(
  instances: T[],
): T[] {
  const pendingRef = useRef<Record<string, StableConnectionPending>>({});
  const displayedRef = useRef<Record<string, boolean | null>>({});
  const initializedRef = useRef<Set<string>>(new Set());
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const [stableList, setStableList] = useState<T[]>(() =>
    mapStableList(instances, displayedRef.current),
  );

  useEffect(() => {
    const list = instancesRef.current;
    for (const inst of list) {
      const next = normalizeConnectionBool(inst.is_connected);
      if (next === null) continue;

      if (!initializedRef.current.has(inst.id)) {
        initializedRef.current.add(inst.id);
        displayedRef.current[inst.id] = next;
        continue;
      }

      pendingRef.current = upsertPending(pendingRef.current, inst.id, next);
    }
    setStableList(mapStableList(list, displayedRef.current));
  }, [instances]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const list = instancesRef.current;
      const { pending, displayed, changed } = flushStableStatuses(
        pendingRef.current,
        displayedRef.current,
      );
      pendingRef.current = pending;
      if (!changed) return;
      displayedRef.current = displayed;
      setStableList(mapStableList(list, displayed));
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  return stableList;
}
