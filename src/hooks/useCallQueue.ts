/* eslint-disable @typescript-eslint/no-explicit-any -- hook legado com queries Supabase dinâmicas */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallQueueItem } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Evita query string gigante em `.in(...)` (502/400 no Nginx/PostgREST). */
const REST_IN_CHUNK = 20;

/** Update/delete em massa: sequencial para não sobrecarregar API/proxy. */
const BULK_MUTATION_CHUNK = 6;

/** Máximo de requisições `.in()` em paralelo por tipo de enriquecimento. */
const CHUNK_CONCURRENCY = 2;

const REALTIME_DEBOUNCE_MS = 900;
const MIN_FETCH_INTERVAL_MS = 2500;

type QueueListener = (queue: CallQueueItem[], loading: boolean) => void;

let sharedQueue: CallQueueItem[] = [];
let sharedLoading = true;
let sharedOrgId: string | null = null;
let sharedSnapshot = "";
const queueListeners = new Set<QueueListener>();

let fetchInFlight: Promise<void> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastFetchAt = 0;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeOrgId: string | null = null;
let realtimeSubscriberCount = 0;
let hydratedOrgId: string | null = null;

function chunkIds<T>(ids: T[], size: number): T[][] {
  if (ids.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

async function fetchChunksLimited<T>(
  chunks: T[][],
  fetcher: (chunk: T[]) => Promise<{ data?: any[]; error?: any }>,
  concurrency = CHUNK_CONCURRENCY
): Promise<any[]> {
  const rows: any[] = [];
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((chunk) => fetcher(chunk)));
    for (const result of results) {
      if (result.error) console.warn("call_queue enrichment:", result.error);
      if (result.data?.length) rows.push(...result.data);
    }
  }
  return rows;
}

function notifyQueueListeners() {
  queueListeners.forEach((listener) => listener(sharedQueue, sharedLoading));
}

function setSharedQueue(next: CallQueueItem[]) {
  const snapshot = JSON.stringify(next);
  if (snapshot === sharedSnapshot) return;
  sharedSnapshot = snapshot;
  sharedQueue = next;
  notifyQueueListeners();
}

function setSharedLoading(loading: boolean) {
  if (sharedLoading === loading) return;
  sharedLoading = loading;
  notifyQueueListeners();
}

function scheduleDebouncedFetch(orgId: string, delayMs = REALTIME_DEBOUNCE_MS) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSharedFetch(orgId, false);
  }, delayMs);
}

function ensureRealtimeSubscription(orgId: string) {
  if (realtimeChannel && realtimeOrgId === orgId) return;

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  realtimeOrgId = orgId;
  realtimeChannel = supabase
    .channel(`call-queue-org-${orgId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "call_queue",
        filter: `organization_id=eq.${orgId}`,
      },
      () => scheduleDebouncedFetch(orgId)
    )
    .subscribe();
}

function releaseRealtimeSubscription() {
  realtimeSubscriberCount = Math.max(0, realtimeSubscriberCount - 1);
  if (realtimeSubscriberCount === 0 && realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeOrgId = null;
  }
}

async function runSharedFetch(
  orgId: string,
  force = false,
  onError?: (message: string) => void
): Promise<void> {
  if (fetchInFlight) {
    if (!force) return fetchInFlight;
    await fetchInFlight.catch(() => undefined);
  }

  const now = Date.now();
  if (!force && now - lastFetchAt < MIN_FETCH_INTERVAL_MS) {
    scheduleDebouncedFetch(orgId, MIN_FETCH_INTERVAL_MS - (now - lastFetchAt));
    return;
  }

  const task = (async () => {
    sharedOrgId = orgId;
    setSharedLoading(true);

    try {
      const formatted = await loadCallQueueForOrg(orgId);
      setSharedQueue(formatted);
      hydratedOrgId = orgId;
      lastFetchAt = Date.now();
    } catch (error: any) {
      console.error("Erro ao buscar call_queue:", error);
      onError?.(error?.message || "Erro desconhecido");
    } finally {
      setSharedLoading(false);
    }
  })();

  fetchInFlight = task;
  try {
    await task;
  } finally {
    if (fetchInFlight === task) fetchInFlight = null;
  }
}

async function loadCallQueueForOrg(activeOrgId: string): Promise<CallQueueItem[]> {
  const { data, error: queryError } = await (supabase as any)
    .from("call_queue")
    .select("*, leads(id, name, phone, call_count, created_at, deleted_at)")
    .eq("organization_id", activeOrgId)
    .order("scheduled_for", { ascending: true });

  if (queryError) throw queryError;

  let queueData: any[] = data || [];
  const itemsToRemove: string[] = [];

  queueData = queueData.filter((item: any) => {
    if (!item.leads || item.leads.deleted_at) {
      if (item.leads?.deleted_at) itemsToRemove.push(item.id);
      return false;
    }
    return true;
  });

  if (itemsToRemove.length > 0) {
    void (supabase as any)
      .from("call_queue")
      .delete()
      .in("id", itemsToRemove)
      .then(() => {
        if (sharedOrgId) scheduleDebouncedFetch(sharedOrgId, 600);
      })
      .catch((err: any) => {
        console.error("Erro ao remover itens deletados da fila:", err);
      });
  }

  if (queueData.length > 0) {
    const hasAssignedField = queueData.some((q: any) => "assigned_to_user_id" in q);
    if (hasAssignedField) {
      const assignedUserIds = [...new Set(queueData.map((q: any) => q.assigned_to_user_id).filter(Boolean))];
      if (assignedUserIds.length > 0) {
        const profileRows = await fetchChunksLimited(
          chunkIds(assignedUserIds, REST_IN_CHUNK),
          (ids) =>
            (supabase as any)
              .from("profiles")
              .select("id, email, full_name")
              .in("id", ids)
        );
        const usersMap = new Map<string, any>();
        profileRows.forEach((profile: any) => usersMap.set(profile.id, profile));
        queueData = queueData.map((item: any) => ({
          ...item,
          assigned_user: item.assigned_to_user_id ? usersMap.get(item.assigned_to_user_id) : null,
        }));
      }
    }
  }

  const leadIds = [...new Set(queueData.map((q: any) => q.leads?.id).filter(Boolean))];
  const callQueueIds = [...new Set(queueData.map((q: any) => q.id).filter(Boolean))];

  const { data: orgTags } = await (supabase as any)
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", activeOrgId);
  const tagById = new Map<string, { id: string; name: string; color: string }>();
  (orgTags || []).forEach((tag: any) => {
    if (tag?.id) tagById.set(tag.id, tag);
  });

  const leadTagJunctions =
    leadIds.length > 0
      ? await fetchChunksLimited(chunkIds(leadIds, REST_IN_CHUNK), (chunk) =>
          (supabase as any).from("lead_tags").select("lead_id, tag_id").in("lead_id", chunk)
        )
      : [];

  const callQueueTagJunctions =
    callQueueIds.length > 0
      ? await fetchChunksLimited(chunkIds(callQueueIds, REST_IN_CHUNK), (chunk) =>
          (supabase as any)
            .from("call_queue_tags")
            .select("call_queue_id, tag_id")
            .in("call_queue_id", chunk)
        )
      : [];

  const leadTagsMap = new Map<string, any[]>();
  leadTagJunctions.forEach((row: any) => {
    const tag = tagById.get(row.tag_id);
    if (!row.lead_id || !tag) return;
    if (!leadTagsMap.has(row.lead_id)) leadTagsMap.set(row.lead_id, []);
    leadTagsMap.get(row.lead_id)!.push(tag);
  });

  const callQueueTagsMap = new Map<string, any[]>();
  callQueueTagJunctions.forEach((row: any) => {
    const tag = tagById.get(row.tag_id);
    if (!row.call_queue_id || !tag) return;
    if (!callQueueTagsMap.has(row.call_queue_id)) callQueueTagsMap.set(row.call_queue_id, []);
    callQueueTagsMap.get(row.call_queue_id)!.push(tag);
  });

  const queueWithTags = queueData.map((item: any) => {
    if (!item.leads?.id) return { ...item, tags: [], queueTags: [] };
    return {
      ...item,
      tags: (leadTagsMap.get(item.leads.id) || []).filter(Boolean),
      queueTags: (callQueueTagsMap.get(item.id) || []).filter(Boolean),
    };
  });

  return queueWithTags.map((item) => {
    const finalCount = item.leads?.call_count ?? item.call_count ?? 0;

    return {
      id: item.id,
      leadId: item.lead_id,
      leadName: item.leads?.name || "Nome não disponível",
      phone: item.leads?.phone || "",
      scheduledFor: item.scheduled_for ? new Date(item.scheduled_for) : undefined,
      priority: (item.priority || "medium") as "high" | "medium" | "low",
      status: (item.status || "pending") as "pending" | "completed" | "rescheduled",
      notes: item.notes || undefined,
      tags: item.tags || [],
      queueTags: item.queueTags || [],
      callNotes: item.call_notes || undefined,
      callCount: finalCount,
      completedBy: item.completed_by || undefined,
      completedAt: item.completed_at ? new Date(item.completed_at) : undefined,
      assignedToUserId: item.assigned_to_user_id || undefined,
      assignedToUserName: item.assigned_user?.full_name || undefined,
      assignedToUserEmail: item.assigned_user?.email || undefined,
      leadCreatedAt: item.leads?.created_at ? new Date(item.leads.created_at) : undefined,
    };
  }) as CallQueueItem[];
}

function patchSharedQueue(updater: (prev: CallQueueItem[]) => CallQueueItem[]) {
  setSharedQueue(updater(sharedQueue));
}

export type AddToCallQueueResult =
  | { success: true }
  | { success: false; message: string; code: "auth" | "duplicate" | "forbidden" | "not_found" | "unknown" };

/** Adiciona lead à fila sem montar o hook (evita subscription/fetch extra no modal). */
export async function addLeadToCallQueueItem(
  item: Omit<CallQueueItem, "id" | "status">,
  orgId?: string | null
): Promise<AddToCallQueueResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, code: "auth", message: "Faça login para adicionar à fila." };
  }

  const { error } = await supabase.rpc("add_to_call_queue_secure", {
    p_lead_id: item.leadId,
    p_scheduled_for: (item.scheduledFor ?? new Date()).toISOString(),
    p_priority: item.priority || "medium",
    p_notes: item.notes || null,
  });

  if (error) {
    const errorMsg = (error.message || "").toLowerCase();
    if (errorMsg.includes("já está na fila")) {
      return {
        success: false,
        code: "duplicate",
        message: "Este lead já possui uma ligação pendente ou reagendada.",
      };
    }
    if (errorMsg.includes("não pertence à organização")) {
      return {
        success: false,
        code: "forbidden",
        message: "Você não tem permissão para adicionar este lead à fila.",
      };
    }
    if (errorMsg.includes("não encontrado")) {
      return { success: false, code: "not_found", message: "O lead pode ter sido deletado." };
    }
    return { success: false, code: "unknown", message: error.message || "Erro desconhecido" };
  }

  if (orgId) {
    await runSharedFetch(orgId, true);
  } else if (sharedOrgId) {
    await runSharedFetch(sharedOrgId, true);
  }

  return { success: true };
}

export async function refreshSharedCallQueue(orgId: string, force = true): Promise<void> {
  await runSharedFetch(orgId, force);
}

export function useCallQueue() {
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>(sharedQueue);
  const [loading, setLoading] = useState(sharedLoading);
  const { toast } = useToast();
  const { activeOrgId, loading: orgLoading } = useActiveOrganization();

  useEffect(() => {
    const listener: QueueListener = (queue, isLoading) => {
      setCallQueue(queue);
      setLoading(isLoading);
    };
    queueListeners.add(listener);
    listener(sharedQueue, sharedLoading);
    return () => {
      queueListeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (orgLoading) return;

    realtimeSubscriberCount += 1;

    if (activeOrgId) {
      ensureRealtimeSubscription(activeOrgId);
      const orgChanged = hydratedOrgId !== activeOrgId;
      const needsInitialLoad = orgChanged || (hydratedOrgId === activeOrgId && sharedQueue.length === 0 && !fetchInFlight);
      if (needsInitialLoad) {
        void runSharedFetch(activeOrgId, true, (message) => {
          toast({
            title: "Erro ao carregar fila de ligações",
            description: message,
            variant: "destructive",
          });
        });
      }
    } else {
      sharedOrgId = null;
      hydratedOrgId = null;
      sharedSnapshot = "";
      sharedQueue = [];
      sharedLoading = false;
      notifyQueueListeners();
    }

    return () => {
      releaseRealtimeSubscription();
    };
  }, [activeOrgId, orgLoading, toast]);

  const fetchCallQueue = useCallback(
    async (force = true) => {
      if (!activeOrgId) {
        sharedOrgId = null;
        sharedSnapshot = "";
        sharedQueue = [];
        sharedLoading = false;
        notifyQueueListeners();
        return;
      }
      await runSharedFetch(activeOrgId, force, (message) => {
        toast({
          title: "Erro ao carregar fila de ligações",
          description: message,
          variant: "destructive",
        });
      });
    },
    [activeOrgId, toast]
  );

  const completeCall = async (callId: string, callNotes?: string) => {
    try {
      console.log('🔄 Iniciando conclusão da ligação:', callId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      console.log('👤 Usuário autenticado:', user.email);

      // Get the call queue item with lead data
      const { data: queueItem, error: fetchError } = await (supabase as any)
        .from('call_queue')
        .select('*, leads(id, name, phone, call_count, created_at)')
        .eq('id', callId)
        .maybeSingle();

      if (fetchError) {
        console.error('❌ Erro ao buscar item da fila:', fetchError);
        throw fetchError;
      }

      if (!queueItem) {
        throw new Error('Item da fila não encontrado');
      }
      
      console.log('✅ Item da fila encontrado:', queueItem);

      const newCallCount = (queueItem.leads?.call_count || 0) + 1;
      const now = new Date().toISOString();

      // ✅ CORREÇÃO: Determinar quem concluiu a ligação
      // Se houver responsável determinado (assigned_to_user_id), usar ele como quem concluiu
      // Se não houver responsável (null), manter como "Nenhum responsável atribuído"
      let completedByEmail: string | null = null;
      let completedByUserId: string | null = null;
      let completedByName: string = 'Nenhum responsável atribuído';

      if (queueItem.assigned_to_user_id) {
        // Buscar dados do responsável determinado
        const { data: assignedUser, error: userError } = await (supabase as any)
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', queueItem.assigned_to_user_id)
          .maybeSingle();

        if (!userError && assignedUser) {
          completedByEmail = assignedUser.email || null;
          completedByUserId = assignedUser.id;
          completedByName = assignedUser.full_name || assignedUser.email || 'Responsável não determinado';
          console.log('✅ Usando responsável determinado como quem concluiu:', completedByName);
        } else {
          console.log('⚠️ Responsável determinado não encontrado, mantendo como não atribuído');
          // Manter como não atribuído se o responsável não for encontrado
          completedByEmail = null;
          completedByUserId = null;
          completedByName = 'Nenhum responsável atribuído';
        }
      } else {
        console.log('ℹ️ Nenhum responsável determinado, mantendo como não atribuído');
        // Manter como não atribuído quando assigned_to_user_id é null
        completedByEmail = null;
        completedByUserId = null;
        completedByName = 'Nenhum responsável atribuído';
      }

      // Se o item não tiver organização, corrige antes de atualizar (evita falha por RLS)
      if (!queueItem.organization_id) {
        try {
          await supabase.functions.invoke('patch-call-queue-org', {
            body: { callQueueId: callId },
          });
        } catch (e) {
          // segue mesmo assim; o update abaixo pode falhar se não patchar
        }
      }

      // Optimistic UI update: move card to concluídas
      patchSharedQueue((prev) =>
        prev.map((c) =>
          c.id === callId
            ? {
                ...c,
                status: "completed" as const,
                completedAt: new Date(now),
                callNotes: callNotes || c.callNotes,
                callCount: newCallCount,
                completedBy: completedByName,
              }
            : c
        )
      );

      // Garantir organização e salvar histórico
      if (!activeOrgId) throw new Error('Organização não encontrada');
      await (supabase as any)
        .from('call_queue_history')
        .insert({
          lead_id: queueItem.lead_id,
          organization_id: activeOrgId,
          lead_name: queueItem.leads?.name || 'Nome não disponível',
          lead_phone: queueItem.leads?.phone || '',
          scheduled_for: queueItem.scheduled_for,
          completed_at: now,
          completed_by: completedByEmail,
          completed_by_user_id: completedByUserId,
          status: 'completed',
          priority: queueItem.priority,
          notes: queueItem.notes,
          call_notes: callNotes,
          call_count: newCallCount,
          action: 'completed',
          user_id: completedByUserId,
        });

      // Update lead call count
      await (supabase as any)
        .from('leads')
        .update({ call_count: newCallCount })
        .eq('id', queueItem.lead_id);

      // Criar atividade no histórico do lead
      const activityContent = callNotes 
        ? `Ligação realizada${callNotes ? `: ${callNotes}` : ''}`
        : 'Ligação realizada';
      
      await (supabase as any)
        .from('activities')
        .insert({
          lead_id: queueItem.lead_id,
          organization_id: activeOrgId,
          type: 'call',
          content: activityContent,
          user_name: completedByName,
          direction: 'outgoing',
        });

      // Update call queue item
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'completed',
          completed_at: now,
          call_notes: callNotes || null,
          call_count: newCallCount,
          completed_by: completedByEmail,
          completed_by_user_id: completedByUserId
        })
        .eq('id', callId);

      if (error) {
        console.error('❌ Erro ao atualizar call_queue:', error);
        throw error;
      }

      console.log('✅ Ligação concluída com sucesso!');
      toast({
        title: "Ligação concluída",
        description: "A ligação foi marcada como concluída e salva no histórico.",
      });

      // O realtime já vai atualizar automaticamente, não precisa refetch manual
    } catch (error: any) {
      console.error('❌ Erro geral ao completar ligação:', error);
      toast({
        title: "Erro ao completar ligação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const rescheduleCall = async (callId: string, newDate: Date) => {
    try {
      // Atualização otimista da UI - mudar status para 'rescheduled'
      patchSharedQueue((prev) =>
        prev.map((c) =>
          c.id === callId
            ? {
                ...c,
                scheduledFor: newDate,
                status: "rescheduled" as const,
              }
            : c
        )
      );

      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ 
          status: 'rescheduled',
          scheduled_for: newDate.toISOString(),
        })
        .eq('id', callId);

      if (error) throw error;

      toast({
        title: "Ligação reagendada",
        description: `Nova data: ${format(newDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Movida para seção Reagendadas.`,
      });

      // Forçar recarregamento para garantir sincronização
      await fetchCallQueue();
      return true;
    } catch (error: any) {
      // Reverter mudança otimista em caso de erro
      await fetchCallQueue();
      toast({
        title: "Erro ao reagendar ligação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const addToQueue = async (item: Omit<CallQueueItem, "id" | "status">) => {
    const result = await addLeadToCallQueueItem(item, activeOrgId);
    if (result.success) {
      toast({
        title: "Adicionado à fila",
        description: "Lead adicionado com sucesso. O contador de ligações foi atualizado.",
      });
      return true;
    }

    const failure = result;
    const titles: Record<string, string> = {
      auth: "Não autenticado",
      duplicate: "Lead já está na fila",
      forbidden: "Sem permissão",
      not_found: "Lead não encontrado",
      unknown: "Erro ao adicionar à fila",
    };
    toast({
      title: titles[failure.code] || "Erro ao adicionar à fila",
      description: failure.message,
      variant: failure.code === "duplicate" ? "default" : "destructive",
    });
    return false;
  };

  const addCallQueueTag = async (callQueueId: string, tagId: string) => {
    try {
      // Verificar se a etiqueta já existe para evitar duplicação
      const { data: existing } = await (supabase as any)
        .from('call_queue_tags')
        .select('id')
        .eq('call_queue_id', callQueueId)
        .eq('tag_id', tagId)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Etiqueta já adicionada",
          description: "Esta etiqueta já está vinculada a esta ligação",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await (supabase as any)
        .from('call_queue_tags')
        .insert({ call_queue_id: callQueueId, tag_id: tagId });

      if (error) throw error;

      await fetchCallQueue();
      toast({
        title: "Etiqueta adicionada",
        description: "Etiqueta vinculada à ligação com sucesso",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const removeCallQueueTag = async (callQueueId: string, tagId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue_tags')
        .delete()
        .eq('call_queue_id', callQueueId)
        .eq('tag_id', tagId);

      if (error) throw error;

      await fetchCallQueue();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao remover etiqueta",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const assignToUser = async (callQueueId: string, userId: string | null) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ assigned_to_user_id: userId })
        .eq('id', callQueueId);

      if (error) throw error;

      await fetchCallQueue();
      toast({
        title: userId ? "Lead atribuído" : "Atribuição removida",
        description: userId ? "Lead atribuído ao usuário com sucesso" : "Atribuição removida com sucesso",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir lead",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const updateCallStatus = async (callQueueId: string, newStatus: 'pending' | 'completed' | 'rescheduled') => {
    try {
      // Atualização otimista da UI
      patchSharedQueue((prev) =>
        prev.map((c) => (c.id === callQueueId ? { ...c, status: newStatus } : c))
      );

      const { error } = await (supabase as any)
        .from('call_queue')
        .update({ status: newStatus })
        .eq('id', callQueueId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Status alterado para ${newStatus === 'pending' ? 'Pendente' : newStatus === 'completed' ? 'Concluída' : 'Reagendada'}`,
      });

      // Forçar recarregamento para garantir sincronização
      await fetchCallQueue();
      return true;
    } catch (error: any) {
      // Reverter mudança otimista em caso de erro
      await fetchCallQueue();
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkUpdateStatus = async (callQueueIds: string[], newStatus: 'pending' | 'completed' | 'rescheduled') => {
    const uniqueIds = [...new Set(callQueueIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return true;
    }

    try {
      const chunks = chunkIds(uniqueIds, BULK_MUTATION_CHUNK);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const { error } = await (supabase as any)
          .from('call_queue')
          .update({ status: newStatus })
          .in('id', chunk);

        if (error) {
          console.error('bulkUpdateStatus: falha no lote', { batch: i + 1, totalBatches: chunks.length, error });
          throw error;
        }
      }

      toast({
        title: "Status atualizado",
        description: `${uniqueIds.length} ligação(ões) atualizada(s) para ${newStatus === 'pending' ? 'Pendente' : newStatus === 'completed' ? 'Concluída' : 'Reagendada'}`,
      });

      await fetchCallQueue();
      return true;
    } catch (error: any) {
      try {
        await fetchCallQueue();
      } catch {
        /* ignore: refetch best-effort para refletir lotes já aplicados */
      }
      toast({
        title: "Erro ao atualizar status",
        description: error?.message || 'Erro desconhecido',
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkDeleteCalls = async (callQueueIds: string[]) => {
    const uniqueIds = [...new Set(callQueueIds.filter(Boolean))];
    if (uniqueIds.length === 0) {
      return true;
    }

    try {
      const chunks = chunkIds(uniqueIds, BULK_MUTATION_CHUNK);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const { error } = await (supabase as any)
          .from('call_queue')
          .delete()
          .in('id', chunk);

        if (error) {
          console.error('bulkDeleteCalls: falha no lote', { batch: i + 1, totalBatches: chunks.length, error });
          throw error;
        }
      }

      toast({
        title: "Ligações excluídas",
        description: `${uniqueIds.length} ligação(ões) excluída(s) com sucesso`,
      });

      await fetchCallQueue();
      return true;
    } catch (error: any) {
      try {
        await fetchCallQueue();
      } catch {
        /* ignore: refetch best-effort para refletir lotes já aplicados */
      }
      toast({
        title: "Erro ao excluir ligações",
        description: error?.message || 'Erro desconhecido',
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCall = async (callQueueId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('call_queue')
        .delete()
        .eq('id', callQueueId);

      if (error) throw error;

      toast({
        title: "Ligação excluída",
        description: "Ligação excluída com sucesso",
      });

      await fetchCallQueue();
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir ligação",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { 
    callQueue, 
    loading, 
    completeCall, 
    rescheduleCall, 
    addToQueue, 
    refetch: fetchCallQueue,
    addCallQueueTag,
    removeCallQueueTag,
    assignToUser,
    updateCallStatus,
    bulkUpdateStatus,
    bulkDeleteCalls,
    deleteCall
  };
}
