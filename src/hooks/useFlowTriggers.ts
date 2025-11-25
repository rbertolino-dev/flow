import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkTriggers } from "@/lib/flowTriggerSystem";

/**
 * Hook para escutar eventos e acionar gatilhos de fluxos
 */
export function useFlowTriggers() {
  useEffect(() => {
    // Listener para criação de leads
    const leadsChannel = supabase
      .channel('flow-triggers-leads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          const leadId = payload.new.id;
          await checkTriggers('lead_created', leadId);
        }
      )
      .subscribe();

    // Listener para mudanças de tags (tag adicionada)
    const tagAddedChannel = supabase
      .channel('flow-triggers-tags-added')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_tags',
        },
        async (payload) => {
          const leadId = payload.new.lead_id;
          const tagId = payload.new.tag_id;
          await checkTriggers('tag_added', leadId, { tag_id: tagId });
        }
      )
      .subscribe();

    // Listener para remoção de tags
    const tagRemovedChannel = supabase
      .channel('flow-triggers-tags-removed')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lead_tags',
        },
        async (payload) => {
          const leadId = payload.old.lead_id;
          const tagId = payload.old.tag_id;
          await checkTriggers('tag_removed', leadId, { tag_id: tagId });
        }
      )
      .subscribe();

    // Listener para mudanças de estágio
    const stageChangedChannel = supabase
      .channel('flow-triggers-stage-changed')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
          filter: 'stage_id=neq.null',
        },
        async (payload) => {
          const oldStageId = payload.old.stage_id;
          const newStageId = payload.new.stage_id;
          
          // Só acionar se o estágio realmente mudou
          if (oldStageId !== newStageId && newStageId) {
            const leadId = payload.new.id;
            await checkTriggers('stage_changed', leadId, { stage_id: newStageId });
          }
        }
      )
      .subscribe();

    // Listener para mudanças de campos específicos
    const fieldChangedChannel = supabase
      .channel('flow-triggers-field-changed')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads',
        },
        async (payload) => {
          const leadId = payload.new.id;
          
          // Verificar quais campos mudaram
          const fieldsToCheck = ['value', 'source', 'assigned_to', 'email', 'phone'];
          
          for (const field of fieldsToCheck) {
            if (payload.old[field] !== payload.new[field]) {
              await checkTriggers('field_changed', leadId, {
                field,
                value: payload.new[field],
                oldValue: payload.old[field],
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(tagAddedChannel);
      supabase.removeChannel(tagRemovedChannel);
      supabase.removeChannel(stageChangedChannel);
      supabase.removeChannel(fieldChangedChannel);
    };
  }, []);
}

