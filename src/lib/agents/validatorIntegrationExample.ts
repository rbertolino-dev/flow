/**
 * EXEMPLO DE INTEGRAÇÃO DO VALIDATOR
 * 
 * Este arquivo mostra como integrar o responseValidator.ts
 * na Evolution webhook ou em qualquer lugar onde o agente gere respostas.
 * 
 * QUANDO USAR:
 * - Quando a Evolution webhook processar respostas do agente OpenAI
 * - Antes de enviar qualquer resposta automática ao cliente
 * - Em Edge Functions que interagem com OpenAI Assistants
 */

import { 
  parseAndValidateJsonResponse, 
  shouldEscalateToHuman,
  type AgentJsonResponse 
} from './responseValidator.ts';

/**
 * EXEMPLO 1: Validar resposta JSON da OpenAI antes de enviar
 */
export async function handleAgentResponse(
  openaiResponse: string,
  leadId: string,
  supabase: any
): Promise<{ shouldSend: boolean; message: string; needsEscalation: boolean }> {
  
  // Parse e valida a resposta JSON
  const result = parseAndValidateJsonResponse(openaiResponse);
  
  if (!result.success) {
    console.error('❌ Resposta do agente não é JSON válido:', result.error);
    
    // Escalar para humano
    return {
      shouldSend: false,
      message: 'Um atendente irá responder em breve.',
      needsEscalation: true
    };
  }
  
  const { data: agentData, validation } = result;
  
  // Log de validação
  if (validation && !validation.isValid) {
    console.warn('⚠️ Problemas detectados na resposta:', {
      issues: validation.issues,
      warnings: validation.warnings
    });
  }
  
  // Verificar se deve bloquear envio (erros críticos)
  if (validation?.shouldBlock) {
    console.error('🚫 Resposta bloqueada por erros críticos:', validation.issues);
    
    // Escalar para humano
    return {
      shouldSend: false,
      message: 'Um atendente irá responder em breve.',
      needsEscalation: true
    };
  }
  
  // Verificar se deve escalar baseado em confiança
  const needsEscalation = shouldEscalateToHuman(agentData, validation);
  
  if (needsEscalation) {
    console.log('📞 Escalando para humano (confiança baixa ou erro detectado)');
    
    // Notificar operador (implementar conforme seu sistema)
    await notifyOperatorAboutEscalation(leadId, agentData, supabase);
    
    return {
      shouldSend: true,
      message: agentData.resposta + '\n\n_Um atendente irá auxiliar você em breve._',
      needsEscalation: true
    };
  }
  
  // Tudo OK, enviar resposta normalmente
  return {
    shouldSend: true,
    message: agentData.resposta,
    needsEscalation: false
  };
}

/**
 * EXEMPLO 2: Integração na Evolution Webhook
 * (Adicionar no evolution-webhook/index.ts quando implementar respostas automáticas)
 */
export async function evolutionWebhookIntegrationExample() {
  /*
  // Dentro da Evolution webhook, após receber mensagem do cliente:
  
  const userMessage = data.message?.conversation || '';
  
  // 1. Buscar agente IA vinculado à instância
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('evolution_instance_id', configs.instance_name)
    .eq('status', 'active')
    .maybeSingle();
  
  if (!agent || !agent.openai_assistant_id) {
    // Sem agente configurado, processar normalmente
    return;
  }
  
  // 2. Chamar OpenAI Assistant
  const openaiResponse = await callOpenAIAssistant(
    agent.openai_assistant_id,
    userMessage,
    leadId
  );
  
  // 3. VALIDAR RESPOSTA ANTES DE ENVIAR
  const { shouldSend, message, needsEscalation } = await handleAgentResponse(
    openaiResponse,
    leadId,
    supabase
  );
  
  if (!shouldSend) {
    // Não enviar, já foi escalado
    return;
  }
  
  // 4. Enviar resposta validada
  await sendWhatsAppMessage(phone, message, instanceId);
  
  // 5. Se precisou escalar, marcar no banco
  if (needsEscalation) {
    await supabase
      .from('leads')
      .update({ 
        status: 'aguardando_atendimento',
        notes: 'Escalado do agente IA (baixa confiança ou erro detectado)'
      })
      .eq('id', leadId);
  }
  */
}

/**
 * EXEMPLO 3: Notificar operador sobre escalação
 */
async function notifyOperatorAboutEscalation(
  leadId: string,
  agentResponse: AgentJsonResponse,
  supabase: any
): Promise<void> {
  // Buscar lead
  const { data: lead } = await supabase
    .from('leads')
    .select('name, phone, assigned_to')
    .eq('id', leadId)
    .single();
  
  if (!lead) return;
  
  // Criar atividade de escalação
  await supabase.from('activities').insert({
    lead_id: leadId,
    type: 'note',
    content: `🤖 Agente IA escalou conversa (Confiança: ${agentResponse.confianca}%)
    
Última resposta do agente:
${agentResponse.resposta}

Motivo: ${agentResponse.precisa_escalacao ? 'Solicitado pelo agente' : 'Confiança baixa'}`,
    user_name: 'Sistema',
    direction: 'internal'
  });
  
  // Se lead tem usuário atribuído, notificar (implementar conforme seu sistema)
  if (lead.assigned_to) {
    // await sendNotification(lead.assigned_to, { ... });
  }
}

/**
 * EXEMPLO 4: Chamar OpenAI Assistant (stub)
 */
async function callOpenAIAssistant(
  assistantId: string,
  message: string,
  leadId: string
): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  // 1. Criar thread (ou recuperar thread existente do lead)
  const threadResponse = await fetch('https://api.openai.com/v1/threads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    }
  });
  const thread = await threadResponse.json();
  
  // 2. Adicionar mensagem do usuário
  await fetch(`https://api.openai.com/v1/threads/${thread.id}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      role: 'user',
      content: message
    })
  });
  
  // 3. Executar assistant
  const runResponse = await fetch(`https://api.openai.com/v1/threads/${thread.id}/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: JSON.stringify({
      assistant_id: assistantId
    })
  });
  const run = await runResponse.json();
  
  // 4. Aguardar conclusão (polling)
  let runStatus = run.status;
  while (runStatus === 'queued' || runStatus === 'in_progress') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const statusResponse = await fetch(
      `https://api.openai.com/v1/threads/${thread.id}/runs/${run.id}`,
      {
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );
    const statusData = await statusResponse.json();
    runStatus = statusData.status;
  }
  
  // 5. Obter resposta
  const messagesResponse = await fetch(
    `https://api.openai.com/v1/threads/${thread.id}/messages`,
    {
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    }
  );
  const messages = await messagesResponse.json();
  
  // Última mensagem do assistant
  const lastMessage = messages.data.find((m: any) => m.role === 'assistant');
  const textContent = lastMessage?.content?.[0]?.text?.value || '{}';
  
  return textContent; // JSON string
}

/**
 * EXEMPLO 5: Usar em qualquer Edge Function
 */
export async function genericEdgeFunctionExample() {
  /*
  import { parseAndValidateJsonResponse } from '../_shared/responseValidator.ts';
  
  // Após obter resposta do OpenAI:
  const result = parseAndValidateJsonResponse(openaiJsonResponse);
  
  if (!result.success) {
    console.error('Resposta inválida:', result.error);
    return { error: 'Falha ao processar resposta do agente' };
  }
  
  const { data, validation } = result;
  
  if (validation?.shouldBlock) {
    console.error('Resposta bloqueada:', validation.issues);
    return { error: 'Resposta não passou na validação' };
  }
  
  // Usar data.resposta com segurança
  */
}

