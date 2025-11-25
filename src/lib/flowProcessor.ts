import { supabase } from "@/integrations/supabase/client";
import { getUserOrganizationId } from "@/lib/organizationUtils";
import { executeFollowUpAutomation } from "./followUpAutomationExecutor";
import { FlowNode, TriggerConfig, ActionConfig, WaitConfig, ConditionConfig, AutomationActionType } from "@/types/automationFlow";

interface ProcessNodeResult {
  success: boolean;
  nextNodeId?: string;
  waitUntil?: Date;
  error?: string;
}

/**
 * Processa um nó do fluxo e retorna o resultado
 */
export async function processFlowNode(
  node: FlowNode,
  leadId: string,
  executionId: string
): Promise<ProcessNodeResult> {
  try {
    switch (node.type) {
      case 'trigger':
        // Gatilhos não são processados aqui, apenas acionam o início do fluxo
        return { success: true };

      case 'action':
        return await processActionNode(node, leadId);

      case 'wait':
        return await processWaitNode(node);

      case 'condition':
        return await processConditionNode(node, leadId);

      case 'end':
        return await processEndNode(executionId);

      default:
        return { success: false, error: `Tipo de nó desconhecido: ${node.type}` };
    }
  } catch (error: any) {
    console.error(`Erro ao processar nó ${node.id}:`, error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
}

/**
 * Processa um nó de ação
 */
async function processActionNode(
  node: FlowNode,
  leadId: string
): Promise<ProcessNodeResult> {
  const config = node.data.config as ActionConfig;
  
  if (!config.actionType) {
    return { success: false, error: 'Tipo de ação não configurado' };
  }

  // Reaproveitar 100% do executor existente
  const success = await executeFollowUpAutomation({
    leadId,
    stepId: node.id,
    actionType: config.actionType as AutomationActionType,
    actionConfig: config,
  });

  if (!success) {
    return { success: false, error: 'Falha ao executar ação' };
  }

  return { success: true };
}

/**
 * Processa um nó de espera
 */
async function processWaitNode(node: FlowNode): Promise<ProcessNodeResult> {
  const config = node.data.config as WaitConfig;

  if (!config.waitType) {
    return { success: false, error: 'Tipo de espera não configurado' };
  }

  let waitUntil: Date;

  switch (config.waitType) {
    case 'delay':
      if (!config.delay_value || !config.delay_unit) {
        return { success: false, error: 'Configuração de delay incompleta' };
      }
      
      waitUntil = new Date();
      if (config.delay_unit === 'minutes') {
        waitUntil.setMinutes(waitUntil.getMinutes() + config.delay_value);
      } else if (config.delay_unit === 'hours') {
        waitUntil.setHours(waitUntil.getHours() + config.delay_value);
      } else if (config.delay_unit === 'days') {
        waitUntil.setDate(waitUntil.getDate() + config.delay_value);
      }
      break;

    case 'until_date':
      if (!config.date) {
        return { success: false, error: 'Data não configurada' };
      }
      waitUntil = new Date(config.date);
      break;

    case 'until_field':
      // Para este tipo, precisamos verificar periodicamente
      // Por enquanto, agendamos para verificar em 1 hora
      waitUntil = new Date();
      waitUntil.setHours(waitUntil.getHours() + 1);
      break;

    default:
      return { success: false, error: 'Tipo de espera não suportado' };
  }

  return { success: true, waitUntil };
}

/**
 * Processa um nó de condição
 */
async function processConditionNode(
  node: FlowNode,
  leadId: string
): Promise<ProcessNodeResult> {
  const config = node.data.config as ConditionConfig;

  if (!config.operator) {
    return { success: false, error: 'Operador não configurado' };
  }

  // Buscar dados do lead
  const { data: lead, error: leadError } = await (supabase as any)
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, error: 'Erro ao buscar lead' };
  }

  let conditionResult = false;

  // Avaliar condição baseada no tipo
  if (config.field) {
    // Condição de campo
    conditionResult = evaluateFieldCondition(lead, config);
  } else if (config.tag_id) {
    // Condição de tag
    conditionResult = await evaluateTagCondition(leadId, config);
  } else if (config.stage_id) {
    // Condição de estágio
    conditionResult = evaluateStageCondition(lead, config);
  } else {
    return { success: false, error: 'Tipo de condição não configurado' };
  }

  // Retornar o próximo nó baseado no resultado
  return {
    success: true,
    nextNodeId: conditionResult ? 'yes' : 'no',
  };
}

/**
 * Avalia condição de campo
 */
function evaluateFieldCondition(lead: any, config: ConditionConfig): boolean {
  const fieldValue = lead[config.field!];
  const compareValue = config.value;

  switch (config.operator) {
    case 'equals':
      return String(fieldValue) === String(compareValue);
    case 'not_equals':
      return String(fieldValue) !== String(compareValue);
    case 'greater_than':
      return Number(fieldValue) > Number(compareValue);
    case 'less_than':
      return Number(fieldValue) < Number(compareValue);
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(compareValue).toLowerCase());
    case 'exists':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'not_exists':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    default:
      return false;
  }
}

/**
 * Avalia condição de tag
 */
async function evaluateTagCondition(leadId: string, config: ConditionConfig): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from('lead_tags')
    .select('id')
    .eq('lead_id', leadId)
    .eq('tag_id', config.tag_id)
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar tag:', error);
    return false;
  }

  const hasTag = !!data;

  if (config.operator === 'exists') {
    return hasTag;
  } else if (config.operator === 'not_exists') {
    return !hasTag;
  }

  return false;
}

/**
 * Avalia condição de estágio
 */
function evaluateStageCondition(lead: any, config: ConditionConfig): boolean {
  const leadStageId = lead.stage_id;
  const configStageId = config.stage_id;

  if (config.operator === 'equals') {
    return leadStageId === configStageId;
  } else if (config.operator === 'not_equals') {
    return leadStageId !== configStageId;
  }

  return false;
}

/**
 * Processa nó final
 */
async function processEndNode(executionId: string): Promise<ProcessNodeResult> {
  const organizationId = await getUserOrganizationId();
  if (!organizationId) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { error } = await (supabase as any)
    .from('flow_executions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId);

  if (error) {
    return { success: false, error: 'Erro ao finalizar execução' };
  }

  return { success: true };
}

/**
 * Encontra o próximo nó baseado nas conexões
 */
export function getNextNodeId(
  currentNodeId: string,
  edges: any[],
  conditionResult?: 'yes' | 'no'
): string | null {
  // Se for resultado de condição, buscar edge com sourceHandle correspondente
  if (conditionResult) {
    const edge = edges.find(
      (e) => e.source === currentNodeId && e.sourceHandle === conditionResult
    );
    return edge?.target || null;
  }

  // Caso contrário, buscar primeira conexão
  const edge = edges.find((e) => e.source === currentNodeId);
  return edge?.target || null;
}

