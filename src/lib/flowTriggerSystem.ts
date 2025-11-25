import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { AutomationFlow, TriggerConfig, TriggerType } from "@/types/automationFlow";

/**
 * Verifica se um gatilho foi acionado e cria execuções de fluxo
 */
export async function checkTriggers(
  eventType: 'lead_created' | 'tag_added' | 'tag_removed' | 'stage_changed' | 'field_changed',
  leadId: string,
  eventData?: Record<string, any>
): Promise<void> {
  try {
    const organizationId = await getUserOrganizationId();
    if (!organizationId) return;

    // Buscar todos os fluxos ativos
    const { data: activeFlows, error: flowsError } = await (supabase as any)
      .from('automation_flows')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    if (flowsError || !activeFlows) {
      console.error('Erro ao buscar fluxos ativos:', flowsError);
      return;
    }

    // Para cada fluxo, verificar se algum gatilho foi acionado
    for (const flow of activeFlows) {
      const flowData = flow.flow_data;
      if (!flowData?.nodes) continue;

      // Encontrar nós de gatilho
      const triggerNodes = flowData.nodes.filter((node: any) => node.type === 'trigger');

      for (const triggerNode of triggerNodes) {
        const triggerConfig = triggerNode.data.config as TriggerConfig;

        if (isTriggerMatch(triggerConfig, eventType, eventData)) {
          // Verificar se já existe execução ativa para este lead neste fluxo
          const { data: existingExecution } = await (supabase as any)
            .from('flow_executions')
            .select('id')
            .eq('flow_id', flow.id)
            .eq('lead_id', leadId)
            .in('status', ['running', 'waiting'])
            .maybeSingle();

          if (!existingExecution) {
            // Criar nova execução
            await createFlowExecution(flow.id, leadId, triggerNode.id, organizationId);
          }
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar gatilhos:', error);
  }
}

/**
 * Verifica se um gatilho corresponde ao evento
 */
function isTriggerMatch(
  triggerConfig: TriggerConfig,
  eventType: string,
  eventData?: Record<string, any>
): boolean {
  if (!triggerConfig?.triggerType) return false;

  const triggerType = triggerConfig.triggerType;

  // Mapear tipos de evento para tipos de gatilho
  const eventToTriggerMap: Record<string, TriggerType[]> = {
    lead_created: ['lead_created'],
    tag_added: ['tag_added'],
    tag_removed: ['tag_removed'],
    stage_changed: ['stage_changed'],
    field_changed: ['field_changed'],
  };

  const matchingTriggerTypes = eventToTriggerMap[eventType] || [];
  if (!matchingTriggerTypes.includes(triggerType)) {
    return false;
  }

  // Verificações específicas por tipo
  switch (triggerType) {
    case 'tag_added':
    case 'tag_removed':
      return triggerConfig.tag_id === eventData?.tag_id;

    case 'stage_changed':
      return triggerConfig.stage_id === eventData?.stage_id;

    case 'field_changed':
      if (triggerConfig.field !== eventData?.field) return false;
      if (triggerConfig.value && triggerConfig.value !== eventData?.value) return false;
      return true;

    case 'lead_created':
      return true; // Sempre aciona quando lead é criado

    case 'date_trigger':
      // Verificar se a data atual corresponde à data configurada
      if (!triggerConfig.date) return false;
      const triggerDate = new Date(triggerConfig.date);
      const now = new Date();
      return (
        triggerDate.getDate() === now.getDate() &&
        triggerDate.getMonth() === now.getMonth() &&
        triggerDate.getFullYear() === now.getFullYear()
      );

    case 'relative_date':
      // Implementar lógica de data relativa se necessário
      return false; // Por enquanto, não implementado

    default:
      return false;
  }
}

/**
 * Cria uma nova execução de fluxo
 */
async function createFlowExecution(
  flowId: string,
  leadId: string,
  startNodeId: string,
  organizationId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await (supabase as any)
    .from('flow_executions')
    .insert({
      flow_id: flowId,
      lead_id: leadId,
      organization_id: organizationId,
      current_node_id: startNodeId,
      status: 'running',
      execution_data: {},
      created_by: user?.id,
    });

  if (error) {
    console.error('Erro ao criar execução de fluxo:', error);
    throw error;
  }

  // Iniciar processamento imediato
  // Nota: Em produção, isso poderia ser feito via Edge Function ou job queue
  setTimeout(() => {
    processFlowExecution(flowId, leadId).catch(console.error);
  }, 100);
}

/**
 * Processa uma execução de fluxo
 */
export async function processFlowExecution(
  flowId: string,
  leadId: string
): Promise<void> {
  try {
    // Buscar execução
    const { data: execution, error: execError } = await (supabase as any)
      .from('flow_executions')
      .select('*')
      .eq('flow_id', flowId)
      .eq('lead_id', leadId)
      .in('status', ['running', 'waiting'])
      .maybeSingle();

    if (execError || !execution) {
      return; // Execução não encontrada ou já finalizada
    }

    // Verificar se está aguardando e se o tempo chegou
    if (execution.status === 'waiting') {
      if (execution.next_execution_at) {
        const nextExecution = new Date(execution.next_execution_at);
        const now = new Date();
        
        if (now < nextExecution) {
          // Ainda não é hora de executar
          return;
        }
      }
      
      // Atualizar status para running
      await (supabase as any)
        .from('flow_executions')
        .update({ status: 'running' })
        .eq('id', execution.id);
    }

    // Buscar fluxo
    const { data: flow, error: flowError } = await (supabase as any)
      .from('automation_flows')
      .select('*')
      .eq('id', flowId)
      .single();

    if (flowError || !flow) {
      console.error('Erro ao buscar fluxo:', flowError);
      return;
    }

    const flowData = flow.flow_data;
    if (!flowData?.nodes || !flowData?.edges) {
      return;
    }

    // Encontrar nó atual
    const currentNode = flowData.nodes.find(
      (node: any) => node.id === execution.current_node_id
    );

    if (!currentNode) {
      console.error('Nó atual não encontrado:', execution.current_node_id);
      return;
    }

    // Processar nó
    const { processFlowNode, getNextNodeId } = await import('./flowProcessor');
    const result = await processFlowNode(currentNode, leadId, execution.id);

    if (!result.success) {
      // Marcar execução com erro
      await (supabase as any)
        .from('flow_executions')
        .update({
          status: 'error',
          execution_data: {
            ...execution.execution_data,
            lastError: result.error,
          },
        })
        .eq('id', execution.id);
      return;
    }

    // Se há espera, agendar próxima execução
    if (result.waitUntil) {
      await (supabase as any)
        .from('flow_executions')
        .update({
          status: 'waiting',
          next_execution_at: result.waitUntil.toISOString(),
        })
        .eq('id', execution.id);
      return;
    }

    // Se é nó final, já foi processado
    if (currentNode.type === 'end') {
      return;
    }

    // Encontrar próximo nó
    let nextNodeId: string | null = null;

    if (result.nextNodeId) {
      // Resultado de condição (yes/no)
      nextNodeId = getNextNodeId(
        execution.current_node_id,
        flowData.edges,
        result.nextNodeId as 'yes' | 'no'
      );
    } else {
      // Próximo nó padrão
      nextNodeId = getNextNodeId(execution.current_node_id, flowData.edges);
    }

    if (!nextNodeId) {
      // Não há próximo nó, finalizar execução
      await (supabase as any)
        .from('flow_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', execution.id);
      return;
    }

    // Atualizar para próximo nó e continuar processamento
    await (supabase as any)
      .from('flow_executions')
      .update({
        current_node_id: nextNodeId,
        execution_data: {
          ...execution.execution_data,
          lastProcessedNode: execution.current_node_id,
          lastProcessedAt: new Date().toISOString(),
        },
      })
      .eq('id', execution.id);

    // Processar próximo nó recursivamente (com limite de profundidade)
    const maxDepth = 50; // Prevenir loops infinitos
    const currentDepth = (execution.execution_data?.depth || 0) + 1;
    
    if (currentDepth < maxDepth) {
      await (supabase as any)
        .from('flow_executions')
        .update({
          execution_data: {
            ...execution.execution_data,
            depth: currentDepth,
          },
        })
        .eq('id', execution.id);

      // Processar próximo nó
      await processFlowExecution(flowId, leadId);
    } else {
      // Limite de profundidade atingido
      await (supabase as any)
        .from('flow_executions')
        .update({
          status: 'error',
          execution_data: {
            ...execution.execution_data,
            error: 'Limite de profundidade atingido',
          },
        })
        .eq('id', execution.id);
    }
  } catch (error) {
    console.error('Erro ao processar execução de fluxo:', error);
  }
}

