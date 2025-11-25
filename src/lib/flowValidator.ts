import { FlowData, FlowNode, FlowEdge, FlowValidation } from "@/types/automationFlow";

/**
 * Valida um fluxo completo
 */
export function validateFlow(flowData: FlowData): FlowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Verificar se há nós
  if (!flowData.nodes || flowData.nodes.length === 0) {
    errors.push("O fluxo não possui nenhum bloco");
    return { isValid: false, errors, warnings };
  }

  // Verificar se há pelo menos um gatilho
  const triggerNodes = flowData.nodes.filter(node => node.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push("O fluxo precisa ter pelo menos um gatilho");
  }

  // Verificar se há pelo menos um nó final
  const endNodes = flowData.nodes.filter(node => node.type === 'end');
  if (endNodes.length === 0) {
    warnings.push("O fluxo não possui um bloco de fim. Contatos podem ficar presos no fluxo.");
  }

  // Verificar nós desconectados
  const connectedNodeIds = new Set<string>();
  flowData.edges?.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const disconnectedNodes = flowData.nodes.filter(
    node => node.type !== 'trigger' && !connectedNodeIds.has(node.id)
  );

  if (disconnectedNodes.length > 0) {
    warnings.push(`${disconnectedNodes.length} bloco(s) não estão conectados ao fluxo`);
  }

  // Verificar gatilhos sem saída
  triggerNodes.forEach(trigger => {
    const hasOutgoingEdge = flowData.edges?.some(edge => edge.source === trigger.id);
    if (!hasOutgoingEdge) {
      errors.push(`Gatilho "${trigger.data.label}" não está conectado a nenhum bloco`);
    }
  });

  // Verificar condições sem ambas as saídas
  const conditionNodes = flowData.nodes.filter(node => node.type === 'condition');
  conditionNodes.forEach(condition => {
    const edges = flowData.edges?.filter(edge => edge.source === condition.id) || [];
    const hasYes = edges.some(edge => edge.sourceHandle === 'yes');
    const hasNo = edges.some(edge => edge.sourceHandle === 'no');
    
    if (!hasYes && !hasNo) {
      errors.push(`Condição "${condition.data.label}" não está conectada`);
    } else if (!hasYes) {
      warnings.push(`Condição "${condition.data.label}" não possui caminho "Sim"`);
    } else if (!hasNo) {
      warnings.push(`Condição "${condition.data.label}" não possui caminho "Não"`);
    }
  });

  // Verificar nós de ação sem configuração
  const actionNodes = flowData.nodes.filter(node => node.type === 'action');
  actionNodes.forEach(action => {
    const config = action.data.config;
    if (!config || !config.actionType) {
      errors.push(`Ação "${action.data.label}" não está configurada`);
    }
  });

  // Verificar gatilhos sem configuração
  triggerNodes.forEach(trigger => {
    const config = trigger.data.config;
    if (!config || !config.triggerType) {
      errors.push(`Gatilho "${trigger.data.label}" não está configurado`);
    }
  });

  // Verificar esperas sem configuração
  const waitNodes = flowData.nodes.filter(node => node.type === 'wait');
  waitNodes.forEach(wait => {
    const config = wait.data.config;
    if (!config || !config.waitType) {
      errors.push(`Espera "${wait.data.label}" não está configurada`);
    }
  });

  // Verificar condições sem configuração
  conditionNodes.forEach(condition => {
    const config = condition.data.config;
    if (!config || !config.operator) {
      errors.push(`Condição "${condition.data.label}" não está configurada`);
    }
  });

  // Verificar loops infinitos (caminhos que não chegam ao fim)
  const nodesReachableFromEnd = new Set<string>();
  endNodes.forEach(end => {
    nodesReachableFromEnd.add(end.id);
  });

  // BFS reverso a partir dos nós finais
  let changed = true;
  while (changed) {
    changed = false;
    flowData.edges?.forEach(edge => {
      if (nodesReachableFromEnd.has(edge.target) && !nodesReachableFromEnd.has(edge.source)) {
        nodesReachableFromEnd.add(edge.source);
        changed = true;
      }
    });
  }

  const unreachableNodes = flowData.nodes.filter(
    node => !nodesReachableFromEnd.has(node.id) && node.type !== 'trigger'
  );

  if (unreachableNodes.length > 0) {
    warnings.push(`${unreachableNodes.length} bloco(s) não são alcançáveis a partir de um nó final`);
  }

  // Verificar se há caminhos que não chegam ao fim a partir dos gatilhos
  triggerNodes.forEach(trigger => {
    const reachableNodes = new Set<string>([trigger.id]);
    let changed = true;
    
    while (changed) {
      changed = false;
      flowData.edges?.forEach(edge => {
        if (reachableNodes.has(edge.source) && !reachableNodes.has(edge.target)) {
          reachableNodes.add(edge.target);
          changed = true;
        }
      });
    }

    const reachesEnd = endNodes.some(end => reachableNodes.has(end.id));
    if (!reachesEnd) {
      warnings.push(`Gatilho "${trigger.data.label}" não possui caminho até um bloco final`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida um nó específico
 */
export function validateNode(node: FlowNode): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!node.data.label || node.data.label.trim() === '') {
    errors.push("O bloco precisa ter um nome");
  }

  switch (node.type) {
    case 'trigger':
      const triggerConfig = node.data.config as any;
      if (!triggerConfig?.triggerType) {
        errors.push("Tipo de gatilho não configurado");
      }
      break;

    case 'action':
      const actionConfig = node.data.config as any;
      if (!actionConfig?.actionType) {
        errors.push("Tipo de ação não configurado");
      }
      break;

    case 'wait':
      const waitConfig = node.data.config as any;
      if (!waitConfig?.waitType) {
        errors.push("Tipo de espera não configurado");
      }
      break;

    case 'condition':
      const conditionConfig = node.data.config as any;
      if (!conditionConfig?.operator) {
        errors.push("Operador de condição não configurado");
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

