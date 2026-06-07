import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, Activity, LeadAssignee, type Tag } from "@/types/lead";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import {
  forceRefreshAfterMutation,
  broadcastRefreshEvent,
  LEAD_NOTES_SAVED_EVENT,
  type LeadNotesSavedDetail,
} from "@/utils/forceRefreshAfterMutation";
import {
  LEAD_TAGS_CHANGED_EVENT,
  applyLeadTagsPatch,
  type LeadTagsChangedDetail,
} from "@/utils/leadTagsSync";
import {
  buildBudgetSummaryByLeadId,
  buildBudgetPreviewsByLeadId,
  sumApprovedBudgetTotalsByLeadId,
  type BudgetRowForLeadCard,
} from "@/lib/leadBudgetSummary";
import {
  funnelInteractionDelayExtra,
  isFunnelKanbanInteractionWindow,
  runAfterFunnelInteractionWindow,
} from "@/utils/funnelInteractionGate";

/**
 * Executa uma query por lote de lead_ids com no máximo `parallel` pedidos HTTP em voo.
 * Evita Promise.all em todos os lotes (Chrome: net::ERR_INSUFFICIENT_RESOURCES).
 */
async function mapBatchesWithConcurrency<T>(
  batches: string[][],
  parallel: number,
  fn: (batch: string[]) => Promise<T>,
): Promise<T[]> {
  if (batches.length === 0) return [];
  const results: T[] = new Array(batches.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= batches.length) break;
      results[i] = await fn(batches[i]);
    }
  };
  const workers = Math.max(1, Math.min(Math.max(1, parallel), batches.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Erros de rede/gateway: não devem derrubar o carregamento do funil inteiro. */
function isTransientSupabaseError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; code?: string; name?: string };
  const msg = String(e.message || "").toLowerCase();
  return (
    e.name === "TypeError" ||
    msg.includes("failed to fetch") ||
    msg.includes("load failed") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("bad gateway") ||
    msg.includes("gateway timeout") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  );
}

const EMPTY_BUDGET_SUMMARY = { kind: "none" as const, count: 0 };
const EMPTY_BUDGET_PREVIEW = { previews: [], totalCount: 0 };

function mapAssigneesToDisplay(assignees: LeadAssignee[], fallback?: string | null): string {
  if (assignees.length > 0) {
    return assignees.map((a) => a.fullName || a.email).join(", ");
  }
  return fallback?.trim() ? fallback : "Não atribuído";
}

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const fetchGenerationRef = useRef(0);
  const notesTouchRef = useRef<Record<string, number>>({});
  /** Evita refetch global duplicado logo após hidratação progressiva na 1ª carga */
  const globalRefreshAllowedAfterRef = useRef(0);
  const initialHydrationRef = useRef(true);

  const fetchLeads = useCallback(async () => {
    const fetchStartedAt = Date.now();
    const myGeneration = ++fetchGenerationRef.current;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLeads([]);
        toast({
          title: "Você não está autenticado",
          description: "Faça login para visualizar seus leads conectados.",
        });
        setLoading(false);
        return;
      }

      // Usar a organização ativa do contexto
      if (!activeOrgId) {
        setLeads([]);
        setLoading(false);
        return;
      }

      // ✅ RESILIENTE: Tenta query completa, se falhar usa fallback sem colunas opcionais
      let leadsData: any[] | null = null;
      let leadsError: any = null;

      // Primeira tentativa: query completa com excluded_from_funnel
      const result1 = await (supabase as any)
        .from('leads')
        .select('*')
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .eq('excluded_from_funnel', false)
        .order('created_at', { ascending: false });

      if (result1.error) {
        // Se erro de coluna não existir, tenta sem o filtro
        if (result1.error.message?.includes('does not exist') || 
            result1.error.code === '42703') {
          console.warn('⚠️ Coluna excluded_from_funnel não existe, usando fallback...');
          const result2 = await (supabase as any)
            .from('leads')
            .select('*')
            .eq('organization_id', activeOrgId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
          
          leadsData = result2.data;
          leadsError = result2.error;
        } else {
          leadsError = result1.error;
        }
      } else {
        leadsData = result1.data;
      }

      if (leadsError) throw leadsError;

      // ✅ OTIMIZAÇÃO: Buscar activities e tags em batch (evita N+1 queries)
      const leadIds = (leadsData || []).map(l => l.id);
      
      if (leadIds.length === 0) {
        if (myGeneration === fetchGenerationRef.current) {
          setLeads([]);
        }
        setLoading(false);
        return;
      }
      
      // ✅ CORREÇÃO: Dividir lead IDs em lotes para evitar URL/cabeçalho muito longo (400/502 no proxy)
      // Lotes maiores = menos round-trips; paralelismo por tipo limitado em 3 (seguro)
      // Os 5 tipos de queries (activities/tags/assignees/budgets/attachments) rodam em PARALELO entre si.
      const BATCH_SIZE = 36;
      const BATCH_PARALLEL = 3;
      const leadIdBatches: string[][] = [];
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        leadIdBatches.push(leadIds.slice(i, i + BATCH_SIZE));
      }

      // ✅ RENDER PROGRESSIVO: Mostrar leads básicos imediatamente (sem tags/budgets/activities)
      // Usuário vê o funil preenchido em <500ms em vez de esperar TODAS as queries secundárias.
      // Tags/orçamentos/anexos aparecem logo a seguir, sem bloquear a UI.
      if (myGeneration === fetchGenerationRef.current) {
        globalRefreshAllowedAfterRef.current = Date.now() + 8000;
        const initialLeads: Lead[] = (leadsData || []).map((lead) => {
          const statusRaw = (lead.status || '').toLowerCase();
          const statusMap: Record<string, LeadStatus> = { new: 'novo' };
          const mappedStatus = statusMap[statusRaw] || (statusRaw as LeadStatus);
          return {
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email || undefined,
            company: lead.company || undefined,
            value: lead.value != null && lead.value !== "" ? Number(lead.value) : undefined,
            estimatedValueStored: lead.value != null && lead.value !== "" ? Number(lead.value) : undefined,
            status: mappedStatus,
            source: lead.source || 'WhatsApp',
            assignees: [],
            assignedTo: lead.assigned_to?.trim() || "Não atribuído",
            lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
            createdAt: new Date(lead.created_at!),
            returnDate: lead.return_date ? (() => {
              try {
                const d = new Date(lead.return_date);
                return isNaN(d.getTime()) ? undefined : d;
              } catch { return undefined; }
            })() : undefined,
            sourceInstanceId: lead.source_instance_id || undefined,
            sourceInstanceName: lead.source_instance_name || undefined,
            notes: lead.notes || undefined,
            stageId: lead.stage_id || undefined,
            excluded_from_funnel: lead.excluded_from_funnel ?? false,
            cpf_cnpj: lead.cpf_cnpj || undefined,
            birthDate: lead.birth_date || undefined,
            address: lead.address || undefined,
            neighborhood: lead.neighborhood || undefined,
            city: lead.city || undefined,
            postalCode: lead.postal_code || undefined,
            activities: [],
            tags: [],
            budgetSummary: { kind: "none" as const, count: 0 },
            budgetsPreview: { previews: [], totalCount: 0 },
            attachmentCount: 0,
          } as Lead;
        });
        setLeads(initialLeads);
        setLoading(false); // ← libera a UI AGORA
      }

      // Deixa a renderização inicial respirar antes das consultas secundárias.
      await new Promise<void>((resolve) => {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(() => resolve(), { timeout: 800 });
          return;
        }
        setTimeout(resolve, 120);
      });

      // ✅ OTIMIZAÇÃO: Limitar activities carregadas (apenas últimas 5 por lead)
      // ✅ CORREÇÃO: Limitar a máximo de 1000 activities para evitar erro 400
      const maxActivitiesLimit = Math.min(leadIds.length * 5, 1000);
      
      const loadBudgetRowsForLeads = async (): Promise<any[]> => {
        const fetchBudgetSummaryBatches = (select: string) =>
          mapBatchesWithConcurrency(leadIdBatches, BATCH_PARALLEL, (batch) =>
            (supabase as any)
              .from("budgets")
              .select(select)
              .eq("organization_id", activeOrgId)
              .in("lead_id", batch),
          );

        let batches = await fetchBudgetSummaryBatches(
          "id, lead_id, budget_number, total, created_at, expires_at, approved, rejected"
        );
        let budgetErr = batches.find((r) => r.error)?.error;

        // Migration 20260321120000_add_budget_rejected pode não estar aplicada no Supabase:
        // PostgREST devolve 400; a mensagem nem sempre menciona "rejected".
        if (budgetErr) {
          console.warn(
            "⚠️ Batch budgets (com rejected) falhou; tentando sem coluna rejected:",
            budgetErr
          );
          const retry = await fetchBudgetSummaryBatches(
            "id, lead_id, budget_number, total, created_at, expires_at, approved"
          );
          const err2 = retry.find((r) => r.error)?.error;
          if (!err2) {
            return retry.flatMap((r) =>
              (r.data || []).map((row: any) => ({ ...row, rejected: false }))
            );
          }
          console.warn("⚠️ Orçamentos não carregados para selo no funil:", budgetErr, err2);
          return [];
        }

        return batches.flatMap((r) => r.data || []);
      };

      const loadAttachmentCountsByLead = async (): Promise<Record<string, number>> => {
        const batches = await mapBatchesWithConcurrency(
          leadIdBatches,
          BATCH_PARALLEL,
          (batch) =>
            (supabase as any)
              .from("lead_attachments")
              .select("lead_id")
              .eq("organization_id", activeOrgId)
              .in("lead_id", batch),
        );
        const attachErr = batches.find((r) => r.error)?.error;
        if (attachErr) {
          const msg = attachErr.message || "";
          if (
            msg.includes("does not exist") ||
            attachErr.code === "42P01" ||
            attachErr.code === "PGRST205"
          ) {
            console.warn(
              "⚠️ Tabela lead_attachments indisponível; selo de anexos desativado até a migration."
            );
            return {};
          }
          if (isTransientSupabaseError(attachErr)) {
            console.warn(
              "⚠️ lead_attachments: falha transitória (rede/gateway). Funil carregado sem selo de anexos."
            );
            return {};
          }
          throw attachErr;
        }
        const rows = batches.flatMap((r) => r.data || []);
        const counts: Record<string, number> = {};
        for (const row of rows) {
          const lid = row.lead_id as string | undefined;
          if (lid) counts[lid] = (counts[lid] || 0) + 1;
        }
        return counts;
      };

      // ✅ PARALELO: Os 5 tipos de queries rodam simultaneamente (máx 5×3 = 15 HTTP em voo — seguro).
      // Antes: sequencial (5 waves) = 500-1500ms. Agora: 1 wave paralela = 100-300ms.
      const [
        activitiesResults,
        tagsResults,
        assigneesResults,
        allBudgetRows,
        attachmentCountByLead,
      ] = await Promise.all([
        mapBatchesWithConcurrency(leadIdBatches, BATCH_PARALLEL, (batch) =>
          (supabase as any)
            .from("activities")
            .select("*")
            .in("lead_id", batch)
            .order("created_at", { ascending: false })
            .limit(Math.min(batch.length * 5, 200)),
        ),
        mapBatchesWithConcurrency(leadIdBatches, BATCH_PARALLEL, (batch) =>
          (supabase as any)
            .from("lead_tags")
            .select("lead_id, tag_id, tags(id, name, color)")
            .in("lead_id", batch)
            .limit(500),
        ),
        mapBatchesWithConcurrency(leadIdBatches, BATCH_PARALLEL, (batch) =>
          supabase
            .from("lead_assignees")
            .select("lead_id, user_id, created_at")
            .in("lead_id", batch),
        ),
        loadBudgetRowsForLeads(),
        loadAttachmentCountsByLead(),
      ]);

      // Combinar resultados de todos os lotes
      const allActivities = activitiesResults.flatMap(r => r.data || []).slice(0, maxActivitiesLimit);
      let allLeadTags = tagsResults.flatMap(r => r.data || []);

      let allLeadAssigneeRows: any[] = assigneesResults.flatMap((r) => r.data || []);
      const failedAssignee = assigneesResults.find((r) => r.error);
      if (failedAssignee?.error) {
        const err = failedAssignee.error as { message?: string; code?: string; name?: string };
        const msg = String(err.message || "");
        if (
          msg.includes("does not exist") ||
          err.code === "42P01" ||
          err.code === "PGRST205"
        ) {
          console.warn("⚠️ Tabela lead_assignees indisponível, ignorando responsáveis múltiplos.");
          allLeadAssigneeRows = [];
        } else if (isTransientSupabaseError(failedAssignee.error)) {
          console.warn(
            "⚠️ lead_assignees: falha de rede/gateway. Funil carregado; responsáveis podem estar incompletos."
          );
        } else {
          throw failedAssignee.error;
        }
      }

      // Hidratar profiles em pedidos à parte (URLs curtas) — evita 502/CORS por query string gigante com embed
      if (allLeadAssigneeRows.length > 0) {
        const userIds = [
          ...new Set(
            allLeadAssigneeRows
              .map((r: { user_id?: string }) => r.user_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        const profileById = new Map<
          string,
          { full_name?: string | null; email?: string | null }
        >();
        const PROFILE_IN_CHUNK = 12;
        try {
          const profileChunks: string[][] = [];
          for (let i = 0; i < userIds.length; i += PROFILE_IN_CHUNK) {
            profileChunks.push(userIds.slice(i, i + PROFILE_IN_CHUNK));
          }
          const profileRes = await mapBatchesWithConcurrency(
            profileChunks,
            BATCH_PARALLEL,
            (ids) => supabase.from("profiles").select("id, full_name, email").in("id", ids),
          );
          const profErr = profileRes.find((r) => r.error)?.error;
          if (profErr) {
            console.warn("⚠️ Perfis (responsáveis):", profErr.message || profErr);
          }
          for (const pr of profileRes) {
            for (const p of pr.data || []) {
              profileById.set(p.id, {
                full_name: p.full_name,
                email: p.email,
              });
            }
          }
        } catch (e) {
          console.warn("⚠️ Falha ao carregar perfis para responsáveis:", e);
        }
        for (const row of allLeadAssigneeRows) {
          const p = profileById.get(row.user_id);
          row.profiles = p
            ? { full_name: p.full_name, email: p.email ?? "" }
            : null;
        }
      }

      // ✅ FALLBACK: Se tags falharam, tentar buscar individualmente para alguns leads
      if (allLeadTags.length === 0 && leadIds.length > 0) {
        console.warn('⚠️ Nenhuma tag encontrada em batch, tentando fallback...');
        // Tentar buscar tags para os primeiros 50 leads individualmente
        const fallbackLeadIds = leadIds.slice(0, 50);
        try {
          const fallbackResult = await (supabase as any)
            .from('lead_tags')
            .select('lead_id, tag_id, tags(id, name, color)')
            .in('lead_id', fallbackLeadIds);
          
          if (fallbackResult.data) {
            allLeadTags = fallbackResult.data;
            console.log(`✅ Fallback encontrou ${allLeadTags.length} tags`);
          }
        } catch (fallbackError) {
          console.error('❌ Erro no fallback de tags:', fallbackError);
        }
      }

      // ✅ OTIMIZAÇÃO: Group by lead_id e limitar a 5 activities por lead
      const activitiesByLead = allActivities.reduce((acc, act) => {
        if (!acc[act.lead_id]) acc[act.lead_id] = [];
        if (acc[act.lead_id].length < 5) {
          acc[act.lead_id].push(act);
        }
        return acc;
      }, {} as Record<string, any[]>);

      const tagsByLead = allLeadTags.reduce((acc, lt) => {
        if (!acc[lt.lead_id]) acc[lt.lead_id] = [];
        acc[lt.lead_id].push(lt);
        return acc;
      }, {} as Record<string, any[]>);

      const assigneesByLead = allLeadAssigneeRows.reduce((acc, row) => {
        if (!acc[row.lead_id]) acc[row.lead_id] = [];
        acc[row.lead_id].push(row);
        return acc;
      }, {} as Record<string, any[]>);

      for (const lid of Object.keys(assigneesByLead)) {
        assigneesByLead[lid].sort(
          (a: any, b: any) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
      }

      const budgetRowsNormalized: BudgetRowForLeadCard[] = (allBudgetRows || []).map(
        (row: any) => ({
          id: row.id,
          lead_id: row.lead_id ?? null,
          budget_number: row.budget_number ?? "",
          total: Number(row.total) || 0,
          created_at: row.created_at,
          expires_at: row.expires_at ?? null,
          approved: row.approved ?? null,
          rejected: row.rejected ?? null,
        })
      );

      const budgetSummaryByLead = buildBudgetSummaryByLeadId(
        budgetRowsNormalized.map((row) => ({
          lead_id: row.lead_id,
          expires_at: row.expires_at,
          approved: row.approved,
          rejected: row.rejected,
        }))
      );

      const budgetPreviewsByLead = buildBudgetPreviewsByLeadId(budgetRowsNormalized);
      const approvedTotalsByLeadId = sumApprovedBudgetTotalsByLeadId(budgetRowsNormalized);

      // Map leads with their activities and tags
      const leadsWithActivities = (leadsData || []).map((lead) => {
        const activities = activitiesByLead[lead.id] || [];
        const leadTags = tagsByLead[lead.id] || [];
        const assigneeRows = assigneesByLead[lead.id] || [];

        const statusRaw = (lead.status || '').toLowerCase();
        const statusMap: Record<string, LeadStatus> = { new: 'novo' };
        const mappedStatus = statusMap[statusRaw] || (statusRaw as LeadStatus);
        
        // ✅ CORREÇÃO: Processar tags corretamente (lt.tags pode ser null)
        const processedTags = (leadTags || [])
          .map((lt: any) => lt.tags)
          .filter((tag: any) => tag && tag.id && tag.name); // Filtrar tags válidas

        const assignees: LeadAssignee[] = (assigneeRows || [])
          .map((row: any) => ({
            userId: row.user_id,
            fullName: row.profiles?.full_name ?? null,
            email: row.profiles?.email ?? "",
          }))
          .filter((a: LeadAssignee) => a.userId);

        const assignedTo =
          assignees.length > 0
            ? assignees.map((a) => a.fullName || a.email).join(", ")
            : lead.assigned_to?.trim()
              ? lead.assigned_to
              : "Não atribuído";

        const storedEstimate =
          lead.value != null && lead.value !== ""
            ? Number(lead.value)
            : undefined;
        const approvedSum = approvedTotalsByLeadId[lead.id] || 0;
        const funnelValue =
          approvedSum > 0 ? approvedSum : storedEstimate;

        return {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          email: lead.email || undefined,
          company: lead.company || undefined,
          value: funnelValue,
          estimatedValueStored: storedEstimate,
          status: mappedStatus,
          source: lead.source || 'WhatsApp',
          assignees,
          assignedTo,
          lastContact: lead.last_contact ? new Date(lead.last_contact) : new Date(),
          createdAt: new Date(lead.created_at!),
          returnDate: lead.return_date ? (() => {
            try {
              const date = new Date(lead.return_date);
              return isNaN(date.getTime()) ? undefined : date;
            } catch {
              return undefined;
            }
          })() : undefined,
          sourceInstanceId: lead.source_instance_id || undefined,
          sourceInstanceName: lead.source_instance_name || undefined,
          notes: lead.notes || undefined,
          stageId: lead.stage_id || undefined,
          excluded_from_funnel: lead.excluded_from_funnel ?? false,
          cpf_cnpj: lead.cpf_cnpj || undefined,
          birthDate: lead.birth_date || undefined,
          address: lead.address || undefined,
          neighborhood: lead.neighborhood || undefined,
          city: lead.city || undefined,
          postalCode: lead.postal_code || undefined,
          activities: (activities || []).map((a) => ({
            id: a.id,
            type: a.type as Activity['type'],
            content: a.content,
            timestamp: new Date(a.created_at!),
            user: a.user_name || 'Sistema',
            user_name: a.user_name ?? undefined,
          })),
          tags: processedTags, // ✅ Usar tags processadas
          budgetSummary: budgetSummaryByLead[lead.id] ?? { kind: "none" as const, count: 0 },
          budgetsPreview: budgetPreviewsByLead[lead.id] ?? { previews: [], totalCount: 0 },
          attachmentCount: attachmentCountByLead[lead.id] ?? 0,
        } as Lead;
      });

      if (myGeneration !== fetchGenerationRef.current) {
        return;
      }

      const mergeLeadsPreservingRecentNotes = (prev: Lead[], incoming: Lead[]) => {
        const incomingById = new Map(incoming.map((lead) => [lead.id, lead]));
        return prev.map((currentLead) => {
          const nextLead = incomingById.get(currentLead.id);
          if (!nextLead) return currentLead;
          const touched = notesTouchRef.current[currentLead.id] ?? 0;
          if (touched >= fetchStartedAt) {
            const prevActs = currentLead.activities || [];
            const nextActs = nextLead.activities || [];
            return {
              ...nextLead,
              notes: currentLead.notes ?? nextLead.notes,
              activities: prevActs.length > nextActs.length ? prevActs : nextActs,
            };
          }
          return nextLead;
        });
      };

      const PRIORITY_LEADS_COUNT = 80;
      const priorityLeads = leadsWithActivities.slice(0, PRIORITY_LEADS_COUNT);

      // Atualiza primeiro os leads mais prováveis de aparecer na viewport.
      setLeads((prev) => mergeLeadsPreservingRecentNotes(prev, priorityLeads));

      const applyRemainingEnrichment = () => {
        if (myGeneration !== fetchGenerationRef.current) return;
        initialHydrationRef.current = false;
        if (isFunnelKanbanInteractionWindow()) {
          runAfterFunnelInteractionWindow(applyRemainingEnrichment);
          return;
        }
        startTransition(() => {
          setLeads((prev) => mergeLeadsPreservingRecentNotes(prev, leadsWithActivities));
        });
      };

      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => applyRemainingEnrichment(), { timeout: 2500 });
      } else {
        setTimeout(applyRemainingEnrichment, 120);
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar leads:', error);
      toast({
        title: "Erro ao carregar leads",
        description: error.message || "Tente recarregar a página",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, toast]);

  useEffect(() => {
    if (activeOrgId) {
      initialHydrationRef.current = true;
      globalRefreshAllowedAfterRef.current = Date.now() + 2000;
      fetchLeads();
    } else {
      setLoading(false);
    }

    // ✅ OTIMIZAÇÃO: Realtime com updates otimistas + Polling como fallback
    let channel: any = null;
    const maxReconnectAttempts = 3;
    let reconnectAttempts = 0;
    let globalRefreshTimer: number | null = null;
    const leadRefreshTimers = new Map<string, number>();

    const clearScheduledRefreshes = () => {
      if (globalRefreshTimer) {
        window.clearTimeout(globalRefreshTimer);
        globalRefreshTimer = null;
      }
      leadRefreshTimers.forEach((timerId) => window.clearTimeout(timerId));
      leadRefreshTimers.clear();
    };

    const scheduleGlobalRefresh = (reason: string, delayMs = 1200) => {
      const allowEarlyGlobal =
        /online-recovery|fallback|force/i.test(reason) || reason.includes("tag-updated-fallback");
      if (
        initialHydrationRef.current &&
        !allowEarlyGlobal &&
        !/event:/.test(reason)
      ) {
        return;
      }
      if (!allowEarlyGlobal && Date.now() < globalRefreshAllowedAfterRef.current) {
        return;
      }
      if (globalRefreshTimer) {
        window.clearTimeout(globalRefreshTimer);
      }
      const waitMs = delayMs + funnelInteractionDelayExtra();
      globalRefreshTimer = window.setTimeout(() => {
        globalRefreshTimer = null;
        console.log(`🔄 Refetch global (debounced): ${reason}`);
        fetchLeads().catch((error) => console.error("Erro no refresh global:", error));
      }, waitMs);
    };

    const scheduleLeadRefresh = (kind: string, leadId: string, task: () => Promise<void>, delayMs = 350) => {
      const key = `${kind}:${leadId}`;
      const current = leadRefreshTimers.get(key);
      if (current) window.clearTimeout(current);
      const waitMs = delayMs + funnelInteractionDelayExtra();
      const timerId = window.setTimeout(async () => {
        leadRefreshTimers.delete(key);
        try {
          await task();
        } catch (error) {
          console.warn(`⚠️ ${kind} local falhou para lead ${leadId}; fallback global.`, error);
          scheduleGlobalRefresh(`${kind}-fallback`, 600);
        }
      }, waitMs);
      leadRefreshTimers.set(key, timerId);
    };

    const refreshAssigneesForLead = async (leadId: string) => {
      const { data: rows, error } = await supabase
        .from("lead_assignees")
        .select("lead_id, user_id, created_at")
        .eq("lead_id", leadId);
      if (error) throw error;

      const userIds = Array.from(
        new Set((rows || []).map((r) => r.user_id).filter((id): id is string => Boolean(id)))
      );
      let profileById = new Map<string, { full_name?: string | null; email?: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (profileError) throw profileError;
        profileById = new Map(
          (profiles || []).map((p) => [p.id, { full_name: p.full_name, email: p.email }])
        );
      }

      const assignees: LeadAssignee[] = (rows || [])
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
        .filter((row) => !!row.user_id)
        .map((row) => {
          const profile = profileById.get(row.user_id);
          return {
            userId: row.user_id,
            fullName: profile?.full_name ?? null,
            email: profile?.email ?? "",
          };
        });

      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id !== leadId) return lead;
          return {
            ...lead,
            assignees,
            assignedTo: mapAssigneesToDisplay(assignees, lead.assignedTo),
          };
        })
      );
    };

    const refreshBudgetForLead = async (leadId: string) => {
      if (!activeOrgId) return;
      const { data: budgetRows, error } = await (supabase as any)
        .from("budgets")
        .select("id, lead_id, budget_number, total, created_at, expires_at, approved, rejected")
        .eq("organization_id", activeOrgId)
        .eq("lead_id", leadId);
      if (error) throw error;

      const normalizedRows: BudgetRowForLeadCard[] = (budgetRows || []).map((row: any) => ({
        id: row.id,
        lead_id: row.lead_id ?? null,
        budget_number: row.budget_number ?? "",
        total: Number(row.total) || 0,
        created_at: row.created_at,
        expires_at: row.expires_at ?? null,
        approved: row.approved ?? null,
        rejected: row.rejected ?? null,
      }));

      const summaryByLead = buildBudgetSummaryByLeadId(
        normalizedRows.map((row) => ({
          lead_id: row.lead_id,
          expires_at: row.expires_at,
          approved: row.approved,
          rejected: row.rejected,
        }))
      );
      const previewsByLead = buildBudgetPreviewsByLeadId(normalizedRows);
      const approvedTotalsByLead = sumApprovedBudgetTotalsByLeadId(normalizedRows);

      setLeads((prev) =>
        prev.map((lead) => {
          if (lead.id !== leadId) return lead;
          const storedEstimate = lead.estimatedValueStored;
          const approvedTotal = approvedTotalsByLead[leadId] || 0;
          return {
            ...lead,
            value: approvedTotal > 0 ? approvedTotal : storedEstimate,
            budgetSummary: summaryByLead[leadId] ?? EMPTY_BUDGET_SUMMARY,
            budgetsPreview: previewsByLead[leadId] ?? EMPTY_BUDGET_PREVIEW,
          };
        })
      );
    };

    const refreshAttachmentCountForLead = async (leadId: string) => {
      if (!activeOrgId) return;
      const { count, error } = await (supabase as any)
        .from("lead_attachments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", activeOrgId)
        .eq("lead_id", leadId);
      if (error) throw error;

      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, attachmentCount: count || 0 } : lead))
      );
    };
    
    const setupRealtime = (fetchFn: () => Promise<void>) => {
      // Reset contador ao tentar reconectar
      if (reconnectAttempts > 0) {
        console.log(`🔄 Tentando reconectar canal realtime (tentativa ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
      }
      // Remover canal anterior se existir
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore
        }
      }
      
      channel = supabase
      .channel(`leads-realtime-${activeOrgId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('🆕 Novo lead inserido:', payload.new);
          const newLead = payload.new as any;
          toast({
            title: 'Novo contato adicionado!',
            description: `${newLead.name || newLead.phone} foi adicionado ao funil`,
          });
          // Refetch apenas quando há novo lead
          forceRefreshAfterMutation(fetchFn);
          broadcastRefreshEvent('create', 'lead');
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'leads',
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined
        },
        (payload) => {
          console.log('🔄 Lead atualizado (realtime):', payload);
          console.log('   EventType:', payload.eventType || payload.type);
          console.log('   New:', payload.new);
          console.log('   Old:', payload.old);
          
          const updated = payload.new as any;
          
          if (!updated || !updated.id) {
            console.error('❌ Payload UPDATE inválido:', payload);
            return;
          }
          
          // Verificar se pertence à organização ativa
          if (activeOrgId && updated.organization_id !== activeOrgId) {
            console.log('⚠️ Lead atualizado pertence a outra organização, ignorando...');
            return;
          }
          
          // ✅ Update otimista: atualizar apenas o lead modificado sem refetch completo
          setLeads((prev) => {
            const leadIndex = prev.findIndex(l => l.id === updated.id);
            
            if (leadIndex === -1) {
              console.log('⚠️ Lead não encontrado na lista atual, pode ser novo lead:', updated.id);
              // Se não encontrou, pode ser um lead novo que ainda não está na lista
              // Não adicionamos aqui, deixamos o INSERT handler fazer isso
              return prev;
            }
            
            const updatedLeads = [...prev];
            const oldLead = updatedLeads[leadIndex];
            
            const nextAssignedTo =
              oldLead.assignees && oldLead.assignees.length > 0
                ? oldLead.assignees.map((a) => a.fullName || a.email).join(", ")
                : updated.assigned_to?.trim()
                  ? updated.assigned_to
                  : "Não atribuído";

            updatedLeads[leadIndex] = {
              ...oldLead,
              name: updated.name ?? oldLead.name,
              phone: updated.phone ?? oldLead.phone,
              email: updated.email ?? oldLead.email,
              company: updated.company ?? oldLead.company,
              value: updated.value ?? oldLead.value,
              status: (updated.status as LeadStatus) ?? oldLead.status,
              assignedTo: nextAssignedTo,
              lastContact: updated.last_contact ? new Date(updated.last_contact) : (updated.updated_at ? new Date(updated.updated_at) : oldLead.lastContact),
              returnDate: updated.return_date ? (() => {
                try {
                  const date = new Date(updated.return_date);
                  return isNaN(date.getTime()) ? oldLead.returnDate : date;
                } catch {
                  return oldLead.returnDate;
                }
              })() : oldLead.returnDate,
              notes: updated.notes ?? oldLead.notes,
              stageId: updated.stage_id ?? oldLead.stageId,
              birthDate: updated.birth_date ?? oldLead.birthDate,
              address: updated.address ?? oldLead.address,
              neighborhood: updated.neighborhood ?? oldLead.neighborhood,
              city: updated.city ?? oldLead.city,
              postalCode: updated.postal_code ?? oldLead.postalCode,
            };
            
            console.log('✅ Lead atualizado via realtime:', updated.name || updated.phone, 'Campo alterado detectado');
            return updatedLeads;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          console.log('🗑️ Lead excluído (realtime):', payload.old);
          // ✅ Update otimista: remover lead deletado sem refetch completo
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setLeads((prev) => prev.filter((l) => l.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_tags' },
        async (payload) => {
          const eventType =
            (payload as { eventType?: string; type?: string }).eventType ||
            (payload as { type?: string }).type;
          const rowNew = payload.new as { lead_id?: string; tag_id?: string } | null;
          const rowOld = payload.old as { lead_id?: string; tag_id?: string } | null;
          const leadId = rowNew?.lead_id || rowOld?.lead_id;
          const tagId = rowNew?.tag_id || rowOld?.tag_id;
          if (!leadId || !tagId) return;

          if (eventType === "DELETE") {
            setLeads((prev) =>
              prev.map((l) => {
                if (l.id !== leadId) return l;
                return {
                  ...l,
                  tags: (l.tags ?? []).filter((t) => t.id !== tagId),
                };
              })
            );
            return;
          }

          if (eventType === "INSERT" && rowNew) {
            const { data: tagData } = await supabase
              .from("tags")
              .select("id, name, color")
              .eq("id", tagId)
              .maybeSingle();

            if (!tagData) return;

            const tag: Tag = {
              id: tagData.id,
              name: tagData.name,
              color: tagData.color,
            };

            setLeads((prev) =>
              prev.map((l) => {
                if (l.id !== leadId) return l;
                const current = l.tags ?? [];
                if (current.some((t) => t.id === tag.id)) return l;
                return { ...l, tags: [...current, tag] };
              })
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_assignees' },
        (payload) => {
          console.log('👤 Responsáveis do lead alterados:', payload);
          const rowNew = payload.new as { lead_id?: string } | null;
          const rowOld = payload.old as { lead_id?: string } | null;
          const leadId = rowNew?.lead_id || rowOld?.lead_id;
          if (!leadId) {
            scheduleGlobalRefresh("lead_assignees-sem-lead");
            return;
          }
          scheduleLeadRefresh("lead_assignees", leadId, () => refreshAssigneesForLead(leadId));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'budgets',
        },
        (payload) => {
          if (activeOrgId) {
            const orgN = (payload.new as { organization_id?: string } | null)?.organization_id;
            const orgO = (payload.old as { organization_id?: string } | null)?.organization_id;
            if (orgN !== activeOrgId && orgO !== activeOrgId) return;
          }
          console.log('💰 Orçamento alterado (realtime):', payload);
          const rowNew = payload.new as { lead_id?: string } | null;
          const rowOld = payload.old as { lead_id?: string } | null;
          const leadId = rowNew?.lead_id || rowOld?.lead_id;
          if (!leadId) {
            scheduleGlobalRefresh("budgets-sem-lead");
            return;
          }
          scheduleLeadRefresh("budgets", leadId, () => refreshBudgetForLead(leadId));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_attachments",
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined,
        },
        (payload) => {
          console.log("📎 Anexo do lead alterado (realtime):", payload);
          const rowNew = payload.new as { lead_id?: string } | null;
          const rowOld = payload.old as { lead_id?: string } | null;
          const leadId = rowNew?.lead_id || rowOld?.lead_id;
          if (!leadId) {
            scheduleGlobalRefresh("attachments-sem-lead");
            return;
          }
          scheduleLeadRefresh("attachments", leadId, () => refreshAttachmentCountForLead(leadId));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        (payload) => {
          console.log('📝 Atividade do lead alterada:', payload);
          const eventType =
            (payload as { eventType?: string; type?: string }).eventType ||
            (payload as { type?: string }).type;
          const rowNew = payload.new as Record<string, unknown> | null;
          const rowOld = payload.old as Record<string, unknown> | null;
          const row = rowNew || rowOld;
          if (!row?.lead_id) return;
          if (
            activeOrgId &&
            row.organization_id &&
            String(row.organization_id) !== activeOrgId
          ) {
            return;
          }

          const mapRowToActivity = (n: Record<string, unknown>): Activity => ({
            id: String(n.id),
            type: (n.type as Activity["type"]) || "note",
            content: String(n.content ?? ""),
            timestamp: new Date(
              (n.created_at as string) || Date.now()
            ),
            user: (n.user_name as string) || "Sistema",
            user_name: (n.user_name as string) ?? undefined,
          });

          if (eventType === "INSERT" && rowNew) {
            const act = mapRowToActivity(rowNew);
            setLeads((prev) =>
              prev.map((l) => {
                if (l.id !== String(rowNew.lead_id)) return l;
                const existing = l.activities || [];
                if (existing.some((a) => a.id === act.id)) return l;
                return {
                  ...l,
                  activities: [act, ...existing].slice(0, 25),
                };
              })
            );
            return;
          }

          if (eventType === "DELETE" && rowOld?.id) {
            const delId = String(rowOld.id);
            const lid = String(rowOld.lead_id);
            setLeads((prev) =>
              prev.map((l) =>
                l.id !== lid
                  ? l
                  : {
                      ...l,
                      activities: (l.activities || []).filter((a) => a.id !== delId),
                    }
              )
            );
            return;
          }

          if (eventType === "UPDATE" && rowNew) {
            const nid = String(rowNew.id);
            const lid = String(rowNew.lead_id);
            setLeads((prev) =>
              prev.map((l) => {
                if (l.id !== lid) return l;
                return {
                  ...l,
                  activities: (l.activities || []).map((a) =>
                    a.id === nid
                      ? {
                          ...a,
                          content: String(rowNew.content ?? a.content),
                          user_name: (rowNew.user_name as string) ?? a.user_name,
                          user: (rowNew.user_name as string) || a.user,
                        }
                      : a
                  ),
                };
              })
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tags',
          filter: activeOrgId ? `organization_id=eq.${activeOrgId}` : undefined
        },
        (payload) => {
          console.log('🏷️ Etiqueta atualizada (realtime):', payload);
          const updatedTag = payload.new as any;
          if (!updatedTag || !updatedTag.id) {
            console.error('❌ Payload UPDATE de tag inválido:', payload);
            return;
          }
          
          // Verificar se a tag pertence à organização ativa
          if (activeOrgId && updatedTag.organization_id !== activeOrgId) {
            console.log('⚠️ Tag atualizada pertence a outra organização, ignorando...');
            return;
          }
          
          // ✅ Atualização otimista: atualizar tags nos leads que têm essa tag
          setLeads((prev) => {
            let updated = false;
            const updatedLeads = prev.map((lead) => {
              // Verificar se o lead tem essa tag
              const hasTag = lead.tags?.some(tag => tag.id === updatedTag.id);
              if (!hasTag) return lead;
              
              updated = true;
              // Atualizar a tag no lead
              const updatedTags = lead.tags?.map(tag => 
                tag.id === updatedTag.id 
                  ? {
                      ...tag,
                      name: updatedTag.name || tag.name,
                      color: updatedTag.color || tag.color
                    }
                  : tag
              ) || [];
              
              console.log(`✅ Tag "${updatedTag.name}" atualizada no lead "${lead.name}"`);
              return {
                ...lead,
                tags: updatedTags
              };
            });
            
            if (updated) {
              console.log(`🔄 ${updatedLeads.filter(l => l.tags?.some(t => t.id === updatedTag.id)).length} leads atualizados com a tag "${updatedTag.name}"`);
            }
            
            return updatedLeads;
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime de leads:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Canal realtime de leads conectado com sucesso!');
          reconnectAttempts = 0; // Reset contador ao conectar
        } else if (status === 'CLOSED') {
          // CLOSED é normal quando usuário troca de aba ou canal é fechado
          // Não é um erro, apenas log informativo
          console.log('ℹ️ Canal realtime de leads fechado (normal ao trocar de aba)');
        } else if (status === 'TIMED_OUT') {
          // Timeout - tentar reconectar
          console.warn('⏱️ Timeout no canal realtime de leads. Polling de fallback ativo.');
        } else if (status === 'CHANNEL_ERROR') {
          // Erro no canal - tentar reconectar algumas vezes
          console.warn('⚠️ Erro no canal realtime de leads. Tentando reconectar...');
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(() => {
              console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts}...`);
              setupRealtime(fetchFn);
            }, 2000 * reconnectAttempts); // Backoff exponencial
          } else {
            console.warn('⚠️ Máximo de tentativas de reconexão atingido. Usando apenas polling.');
          }
        }
      });
    };
    
    // Configurar realtime inicialmente
    setupRealtime(fetchLeads);

    // ✅ OTIMIZAÇÃO: Reduzir polling quando realtime está funcionando
    // Polling de fallback: verificar a cada 30 segundos (reduzido de 15s)
    // Se não estiver, fazer polling a cada 20 segundos (reduzido de 10s)
    const fallbackPolling = setInterval(() => {
      const channels = supabase.realtime.getChannels();
      const hasActiveConnection = channels.some((ch: any) => {
        const state = ch.state || ch._state || ch.status;
        return state === 'joined' || state === 'joining' || state === 'SUBSCRIBED';
      });

      if (!hasActiveConnection) {
        console.log('🔄 Realtime não conectado. Fazendo polling de fallback...');
        fetchLeads().catch(console.error);
      }
    }, 30000); // ✅ Reduzido de 15s para 30s quando realtime está OK

    const handleLeadNotesSaved = (event: Event) => {
      const { leadId, notes, activity } = (event as CustomEvent<LeadNotesSavedDetail>).detail || {};
      if (!leadId || notes === undefined || !activity?.id) return;
      notesTouchRef.current[leadId] = Date.now();
      const act: Activity = {
        id: activity.id,
        type: activity.type,
        content: activity.content,
        timestamp: new Date(activity.timestamp),
        user: activity.user,
        user_name: activity.user_name,
      };
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id !== leadId) return l;
          const existing = l.activities || [];
          if (existing.some((a) => a.id === act.id)) {
            return { ...l, notes };
          }
          return {
            ...l,
            notes,
            activities: [act, ...existing].slice(0, 25),
          };
        })
      );
    };

    // Escutar eventos de refresh disparados por outros componentes
    const handleRefreshEvent = (event: CustomEvent) => {
      const { type, entity } = event.detail;
      if (entity === 'lead' || entity === 'budget') {
        console.log(`🔄 Evento de refresh recebido: ${type} ${entity}. Atualizando leads (debounced)...`);
        scheduleGlobalRefresh(`event:${type}:${entity}`, 500);
      }
    };

    // ✅ NOVO: Escutar evento de tag atualizada para atualizar leads em tempo real
    const handleTagUpdated = (event: CustomEvent) => {
      const { tagId } = event.detail;
      if (!tagId) return;
      
      console.log(`🏷️ Evento tag-updated recebido para tagId: ${tagId}`);
      
      // Buscar a tag atualizada do banco
      (supabase as any)
        .from('tags')
        .select('id, name, color')
        .eq('id', tagId)
        .maybeSingle()
        .then(({ data: updatedTag, error }: any) => {
          if (error) {
            console.error('❌ Erro ao buscar tag atualizada:', error);
            // Fallback: refetch completo
            scheduleGlobalRefresh("tag-updated-fallback", 500);
            return;
          }
          
          if (!updatedTag) {
            console.warn(`⚠️ Tag ${tagId} não encontrada após atualização`);
            return;
          }
          
          // Atualizar leads que têm essa tag
          setLeads((prev) => {
            return prev.map((lead) => {
              const hasTag = lead.tags?.some(tag => tag.id === updatedTag.id);
              if (!hasTag) return lead;
              
              const updatedTags = lead.tags?.map(tag => 
                tag.id === updatedTag.id 
                  ? {
                      ...tag,
                      name: updatedTag.name,
                      color: updatedTag.color
                    }
                  : tag
              ) || [];
              
              console.log(`✅ Tag "${updatedTag.name}" atualizada no lead "${lead.name}" via evento`);
              return {
                ...lead,
                tags: updatedTags
              };
            });
          });
        });
    };

    const handleLeadTagsChanged = (event: Event) => {
      const detail = (event as CustomEvent<LeadTagsChangedDetail>).detail;
      if (!detail?.leadId || !detail?.tag?.id) return;
      setLeads((prev) => applyLeadTagsPatch(prev, detail));
    };

    const handleOnline = () => {
      clearScheduledRefreshes();
      scheduleGlobalRefresh("online-recovery", 2000);
    };

    window.addEventListener(LEAD_NOTES_SAVED_EVENT, handleLeadNotesSaved);
    window.addEventListener('data-refresh', handleRefreshEvent as EventListener);
    window.addEventListener('tag-updated', handleTagUpdated as EventListener);
    window.addEventListener(LEAD_TAGS_CHANGED_EVENT, handleLeadTagsChanged);
    window.addEventListener("online", handleOnline);

    return () => {
      console.log('🔌 Desconectando realtime de leads...');
      clearInterval(fallbackPolling);
      clearScheduledRefreshes();
      window.removeEventListener(LEAD_NOTES_SAVED_EVENT, handleLeadNotesSaved);
      window.removeEventListener('data-refresh', handleRefreshEvent as EventListener);
      window.removeEventListener('tag-updated', handleTagUpdated as EventListener);
      window.removeEventListener(LEAD_TAGS_CHANGED_EVENT, handleLeadTagsChanged);
      window.removeEventListener("online", handleOnline);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // ignore erros ao remover canal
        }
      }
    };
  }, [toast, activeOrgId, fetchLeads]);

  const updateLeadStatus = async (leadId: string, newStageId: string) => {
    try {
      console.log('🔄 Atualizando lead:', { leadId, newStageId });

      // Optimistic UI update to move the card immediately
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, stageId: newStageId, lastContact: new Date() } : l
        )
      );

      if (!activeOrgId) throw new Error('Usuário não pertence a uma organização');

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          stage_id: newStageId,
          last_contact: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) {
        console.error('❌ Erro ao atualizar lead:', updateError);
        throw updateError;
      }


      // Add activity (org-scoped)
      const { error: activityError } = await supabase.from('activities').insert({
        lead_id: leadId,
        organization_id: activeOrgId,
        type: 'status_change',
        content: 'Lead movido para nova etapa',
        user_name: 'Sistema',
      });
      if (activityError) console.warn('⚠️ Erro ao criar atividade:', activityError);

      toast({
        title: 'Status atualizado',
        description: 'O lead foi movido para a nova etapa com sucesso.',
      });

      // Forçar refresh automático após atualização
      await forceRefreshAfterMutation(fetchLeads);
      broadcastRefreshEvent('update', 'lead');
      return true;
    } catch (error: any) {
      console.error('💥 Erro geral ao atualizar lead:', error);
      toast({
        title: 'Erro ao atualizar lead',
        description: error.message,
        variant: 'destructive',
      });
      // Rollback by refetching from server
      await fetchLeads();
      return false;
    }
  };

  const deleteLead = async (leadId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;

      toast({
        title: "Contato excluído",
        description: "O contato foi removido do funil.",
      });

      // Forçar refresh automático após exclusão
      await forceRefreshAfterMutation(fetchLeads, { forceImmediate: true });
      broadcastRefreshEvent('delete', 'lead');
      return true;
    } catch (error: any) {
      toast({
        title: "Erro ao excluir contato",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { leads, loading, updateLeadStatus, deleteLead, refetch: fetchLeads };
}
