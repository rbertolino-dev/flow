import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";

// Lista de funções disponíveis para o assistente
const AVAILABLE_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Cria um novo lead no CRM com nome, telefone e outras informações opcionais",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome completo do lead" },
          phone: { type: "string", description: "Telefone do lead (apenas números)" },
          email: { type: "string", description: "Email do lead (opcional)" },
          company: { type: "string", description: "Nome da empresa (opcional)" },
          value: { type: "number", description: "Valor estimado do negócio (opcional)" },
          stage_id: { type: "string", description: "ID da etapa do funil (opcional)" },
          notes: { type: "string", description: "Notas sobre o lead (opcional)" },
          source: { type: "string", description: "Origem do lead (padrão: 'assistant')" },
        },
        required: ["name", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Busca leads por nome, telefone, email ou outros critérios",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termo de busca (nome, telefone ou email)" },
          stage_id: { type: "string", description: "Filtrar por etapa do funil (opcional)" },
          limit: { type: "number", description: "Número máximo de resultados (padrão: 10)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Atualiza informações de um lead existente",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead a ser atualizado" },
          name: { type: "string", description: "Novo nome (opcional)" },
          phone: { type: "string", description: "Novo telefone (opcional)" },
          email: { type: "string", description: "Novo email (opcional)" },
          company: { type: "string", description: "Nova empresa (opcional)" },
          value: { type: "number", description: "Novo valor (opcional)" },
          stage_id: { type: "string", description: "Nova etapa do funil (opcional)" },
          notes: { type: "string", description: "Notas adicionais (opcional)" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_stages",
      description: "Lista todas as etapas do funil de vendas da organização",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tags",
      description: "Lista todas as tags disponíveis na organização",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_tag_to_lead",
      description: "Adiciona uma tag a um lead",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead" },
          tag_id: { type: "string", description: "ID da tag" },
        },
        required: ["lead_id", "tag_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_call",
      description: "Agenda uma ligação para um lead",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead" },
          scheduled_for: { type: "string", description: "Data e hora no formato ISO 8601" },
          priority: { type: "string", description: "Prioridade: 'low', 'normal' ou 'high' (padrão: 'normal')" },
          notes: { type: "string", description: "Notas sobre a ligação (opcional)" },
        },
        required: ["lead_id", "scheduled_for"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp_message",
      description: "Envia uma mensagem WhatsApp para um lead",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead" },
          message: { type: "string", description: "Texto da mensagem" },
          instance_id: { type: "string", description: "ID da instância Evolution (opcional, usa primeira disponível se não informado)" },
        },
        required: ["lead_id", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_statistics",
      description: "Obtém estatísticas gerais de leads: total, valor total, ticket médio, taxa de conversão",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "Data inicial no formato ISO (opcional)" },
          end_date: { type: "string", description: "Data final no formato ISO (opcional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stage_statistics",
      description: "Obtém estatísticas de leads por etapa do funil",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_source_statistics",
      description: "Obtém estatísticas de leads por origem (whatsapp, manual, etc.)",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_call_queue_statistics",
      description: "Obtém estatísticas da fila de ligações: pendentes, concluídas, taxa de conclusão",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_leads",
      description: "Obtém leads criados recentemente",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Número máximo de leads (padrão: 10)" },
          days: { type: "number", description: "Últimos N dias (padrão: 7)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_lead_details",
      description: "Obtém detalhes completos de um lead específico",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead" },
        },
        required: ["lead_id"],
      },
    },
  },
];

// ============================================
// FUNÇÕES AUXILIARES DE VALIDAÇÃO
// ============================================

// Valida formato UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Valida formato de telefone (mínimo 10 dígitos, máximo 15)
function isValidPhone(phone: string): boolean {
  const normalized = phone.replace(/\D/g, "");
  return normalized.length >= 10 && normalized.length <= 15;
}

// Valida formato de email
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Valida tamanho de string
function isValidStringLength(str: string, min: number, max: number): boolean {
  return str.length >= min && str.length <= max;
}

// Valida se um lead pertence à organização
async function validateLeadBelongsToOrg(
  supabase: any,
  leadId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("id, organization_id")
      .eq("id", leadId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) return false;
    return data.organization_id === organizationId;
  } catch {
    return false;
  }
}

// Valida se uma tag pertence à organização
async function validateTagBelongsToOrg(
  supabase: any,
  tagId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tags")
      .select("id, organization_id")
      .eq("id", tagId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data) return false;
    return data.organization_id === organizationId;
  } catch {
    return false;
  }
}

// Valida se uma etapa pertence à organização
async function validateStageBelongsToOrg(
  supabase: any,
  stageId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("pipeline_stages")
      .select("id, organization_id")
      .eq("id", stageId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error || !data) return false;
    return data.organization_id === organizationId;
  } catch {
    return false;
  }
}

// Sanitiza mensagem de erro para não expor informações sensíveis
function sanitizeError(error: any): string {
  if (typeof error === "string") {
    // Remove possíveis informações sensíveis
    return error
      .replace(/sk-[a-zA-Z0-9]+/g, "[API_KEY]")
      .replace(/Bearer\s+[^\s]+/g, "[TOKEN]")
      .substring(0, 200); // Limita tamanho
  }
  if (error?.message) {
    return sanitizeError(error.message);
  }
  return "Erro ao processar solicitação";
}

// Valida tamanho máximo de mensagem
const MAX_MESSAGE_LENGTH = 5000;
function validateMessageLength(message: string): boolean {
  return message.length > 0 && message.length <= MAX_MESSAGE_LENGTH;
}

// ============================================
// EXECUTA FUNÇÕES DO ASSISTENTE
// ============================================

// Executa uma função retornada pelo DeepSeek
async function executeFunction(
  supabase: any,
  functionName: string,
  parameters: any,
  organizationId: string,
  userId: string
): Promise<any> {
  // Log sanitizado (sem dados sensíveis)
  console.log(`🔧 Executando função: ${functionName}`);

  try {
    switch (functionName) {
      case "create_lead": {
        // Validações
        if (!parameters.name || typeof parameters.name !== "string") {
          throw new Error("Nome é obrigatório e deve ser uma string");
        }
        if (!isValidStringLength(parameters.name, 2, 200)) {
          throw new Error("Nome deve ter entre 2 e 200 caracteres");
        }
        if (!parameters.phone || typeof parameters.phone !== "string") {
          throw new Error("Telefone é obrigatório e deve ser uma string");
        }
        
        // Normalizar telefone (remover caracteres não numéricos)
        const normalizedPhone = parameters.phone.replace(/\D/g, "");
        
        if (!isValidPhone(normalizedPhone)) {
          throw new Error("Telefone inválido. Deve ter entre 10 e 15 dígitos");
        }
        
        // Validar email se fornecido
        if (parameters.email && !isValidEmail(parameters.email)) {
          throw new Error("Email inválido");
        }
        
        // Validar stage_id se fornecido
        let stageId = parameters.stage_id;
        if (stageId) {
          if (!isValidUUID(stageId)) {
            throw new Error("ID da etapa inválido");
          }
          // Validar se etapa pertence à organização
          const isValidStage = await validateStageBelongsToOrg(
            supabase,
            stageId,
            organizationId
          );
          if (!isValidStage) {
            throw new Error("Etapa não encontrada ou não pertence à organização");
          }
        }
        
        // Validar valor se fornecido
        if (parameters.value !== undefined && parameters.value !== null) {
          if (typeof parameters.value !== "number" || parameters.value < 0) {
            throw new Error("Valor deve ser um número positivo");
          }
        }

        // Buscar primeira etapa se não informada
        if (!stageId) {
          const { data: firstStage } = await supabase
            .from("pipeline_stages")
            .select("id")
            .eq("organization_id", organizationId)
            .order("position", { ascending: true })
            .limit(1)
            .maybeSingle();
          stageId = firstStage?.id;
        }

        // Inserir diretamente usando service role (bypass RLS)
        const { data: newLead, error: insertError } = await supabase
          .from("leads")
          .insert({
            organization_id: organizationId,
            user_id: userId,
            name: parameters.name,
            phone: normalizedPhone,
            email: parameters.email || null,
            company: parameters.company || null,
            value: parameters.value || null,
            stage_id: stageId || null,
            notes: parameters.notes || null,
            source: parameters.source || "assistant",
            status: "novo",
            created_by: userId,
            updated_by: userId,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao criar lead:", sanitizeError(insertError));
          throw new Error("Erro ao criar lead. Verifique se os dados estão corretos.");
        }

        // Publicar evento realtime para atualização imediata
        try {
          const channel = supabase.channel('crm-leads');
          await channel.send({
            type: 'broadcast',
            event: 'lead_updated',
            payload: {
              organizationId,
              leadId: newLead.id,
              action: 'created',
              timestamp: new Date().toISOString(),
            }
          });
          console.log('📡 Lead criado publicado no Realtime');
        } catch (realtimeError) {
          console.error('⚠️ Erro ao publicar no Realtime:', realtimeError);
          // Não bloqueia o fluxo
        }

        return { 
          success: true, 
          lead: newLead, 
          message: `Lead "${parameters.name}" criado com sucesso na etapa ${stageId ? 'especificada' : 'inicial'}` 
        };
      }

      case "search_leads": {
        // Validações
        if (!parameters.query || typeof parameters.query !== "string") {
          throw new Error("Query de busca é obrigatória");
        }
        const query = parameters.query.trim();
        if (query.length < 2) {
          throw new Error("Query deve ter pelo menos 2 caracteres");
        }
        if (query.length > 100) {
          throw new Error("Query muito longa. Máximo 100 caracteres");
        }
        
        const limit = Math.min(Math.max(1, parameters.limit || 10), 50); // Entre 1 e 50
        
        // Validar stage_id se fornecido
        if (parameters.stage_id) {
          if (!isValidUUID(parameters.stage_id)) {
            throw new Error("ID da etapa inválido");
          }
          const isValidStage = await validateStageBelongsToOrg(
            supabase,
            parameters.stage_id,
            organizationId
          );
          if (!isValidStage) {
            throw new Error("Etapa não encontrada ou não pertence à organização");
          }
        }

        // Buscar por nome, telefone ou email
        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, name, phone, email, company, value, status, stage_id, created_at")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .or(
            `name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`
          )
          .limit(limit);

        if (error) throw error;

        // Filtrar por etapa se informada
        let filteredLeads = leads || [];
        if (parameters.stage_id) {
          filteredLeads = filteredLeads.filter(
            (l: any) => l.stage_id === parameters.stage_id
          );
        }

        return {
          success: true,
          leads: filteredLeads,
          count: filteredLeads.length,
          message: `Encontrados ${filteredLeads.length} leads`,
        };
      }

      case "update_lead": {
        // Validações
        if (!parameters.lead_id || !isValidUUID(parameters.lead_id)) {
          throw new Error("ID do lead inválido");
        }
        
        // Validar se lead pertence à organização
        const leadBelongsToOrg = await validateLeadBelongsToOrg(
          supabase,
          parameters.lead_id,
          organizationId
        );
        if (!leadBelongsToOrg) {
          throw new Error("Lead não encontrado ou não pertence à organização");
        }
        
        const updateData: any = {};
        
        if (parameters.name !== undefined) {
          if (typeof parameters.name !== "string") {
            throw new Error("Nome deve ser uma string");
          }
          if (!isValidStringLength(parameters.name, 2, 200)) {
            throw new Error("Nome deve ter entre 2 e 200 caracteres");
          }
          updateData.name = parameters.name;
        }
        
        if (parameters.phone !== undefined) {
          if (typeof parameters.phone !== "string") {
            throw new Error("Telefone deve ser uma string");
          }
          const normalizedPhone = parameters.phone.replace(/\D/g, "");
          if (!isValidPhone(normalizedPhone)) {
            throw new Error("Telefone inválido. Deve ter entre 10 e 15 dígitos");
          }
          updateData.phone = normalizedPhone;
        }
        
        if (parameters.email !== undefined) {
          if (parameters.email !== null && !isValidEmail(parameters.email)) {
            throw new Error("Email inválido");
          }
          updateData.email = parameters.email;
        }
        
        if (parameters.company !== undefined) {
          if (parameters.company !== null && typeof parameters.company !== "string") {
            throw new Error("Empresa deve ser uma string");
          }
          if (parameters.company && !isValidStringLength(parameters.company, 1, 200)) {
            throw new Error("Empresa deve ter no máximo 200 caracteres");
          }
          updateData.company = parameters.company;
        }
        
        if (parameters.value !== undefined) {
          if (parameters.value !== null) {
            if (typeof parameters.value !== "number" || parameters.value < 0) {
              throw new Error("Valor deve ser um número positivo");
            }
          }
          updateData.value = parameters.value;
        }
        
        if (parameters.stage_id !== undefined) {
          if (parameters.stage_id !== null) {
            if (!isValidUUID(parameters.stage_id)) {
              throw new Error("ID da etapa inválido");
            }
            const isValidStage = await validateStageBelongsToOrg(
              supabase,
              parameters.stage_id,
              organizationId
            );
            if (!isValidStage) {
              throw new Error("Etapa não encontrada ou não pertence à organização");
            }
          }
          updateData.stage_id = parameters.stage_id;
        }
        
        if (parameters.notes !== undefined) {
          if (parameters.notes !== null && typeof parameters.notes !== "string") {
            throw new Error("Notas devem ser uma string");
          }
          if (parameters.notes && parameters.notes.length > 5000) {
            throw new Error("Notas muito longas. Máximo 5000 caracteres");
          }
          updateData.notes = parameters.notes;
        }
        
        updateData.updated_by = userId;
        updateData.updated_at = new Date().toISOString();

        const { data: updatedLead, error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .select()
          .single();

        if (error) {
          console.error("Erro ao atualizar lead:", sanitizeError(error));
          throw new Error("Erro ao atualizar lead");
        }
        if (!updatedLead) throw new Error("Lead não encontrado");

        // Publicar evento realtime para atualização imediata
        try {
          const channel = supabase.channel('crm-leads');
          await channel.send({
            type: 'broadcast',
            event: 'lead_updated',
            payload: {
              organizationId,
              leadId: updatedLead.id,
              action: 'updated',
              timestamp: new Date().toISOString(),
            }
          });
          console.log('📡 Lead atualizado publicado no Realtime');
        } catch (realtimeError) {
          console.error('⚠️ Erro ao publicar no Realtime:', realtimeError);
          // Não bloqueia o fluxo
        }

        return {
          success: true,
          lead: updatedLead,
          message: "Lead atualizado com sucesso",
        };
      }

      case "list_stages": {
        const { data: stages, error } = await supabase
          .from("pipeline_stages")
          .select("id, name, position, color")
          .eq("organization_id", organizationId)
          .order("position", { ascending: true });

        if (error) throw error;

        return {
          success: true,
          stages: stages || [],
          count: stages?.length || 0,
          message: `Encontradas ${stages?.length || 0} etapas`,
        };
      }

      case "list_tags": {
        const { data: tags, error } = await supabase
          .from("tags")
          .select("id, name, color")
          .eq("organization_id", organizationId)
          .order("name");

        if (error) throw error;

        return {
          success: true,
          tags: tags || [],
          count: tags?.length || 0,
          message: `Encontradas ${tags?.length || 0} tags`,
        };
      }

      case "add_tag_to_lead": {
        // Validações
        if (!parameters.lead_id || !isValidUUID(parameters.lead_id)) {
          throw new Error("ID do lead inválido");
        }
        if (!parameters.tag_id || !isValidUUID(parameters.tag_id)) {
          throw new Error("ID da tag inválido");
        }
        
        // Validar se lead pertence à organização
        const leadBelongsToOrg = await validateLeadBelongsToOrg(
          supabase,
          parameters.lead_id,
          organizationId
        );
        if (!leadBelongsToOrg) {
          throw new Error("Lead não encontrado ou não pertence à organização");
        }
        
        // Validar se tag pertence à organização
        const tagBelongsToOrg = await validateTagBelongsToOrg(
          supabase,
          parameters.tag_id,
          organizationId
        );
        if (!tagBelongsToOrg) {
          throw new Error("Tag não encontrada ou não pertence à organização");
        }
        
        // Verificar se a tag já está associada
        const { data: existing } = await supabase
          .from("lead_tags")
          .select("id")
          .eq("lead_id", parameters.lead_id)
          .eq("tag_id", parameters.tag_id)
          .maybeSingle();

        if (existing) {
          return {
            success: true,
            message: "Tag já está associada a este lead",
          };
        }

        const { error } = await supabase.from("lead_tags").insert({
          lead_id: parameters.lead_id,
          tag_id: parameters.tag_id,
        });

        if (error) {
          console.error("Erro ao adicionar tag:", sanitizeError(error));
          throw new Error("Erro ao adicionar tag ao lead");
        }

        return {
          success: true,
          message: "Tag adicionada ao lead com sucesso",
        };
      }

      case "schedule_call": {
        // Validações
        if (!parameters.lead_id || !isValidUUID(parameters.lead_id)) {
          throw new Error("ID do lead inválido");
        }
        if (!parameters.scheduled_for || typeof parameters.scheduled_for !== "string") {
          throw new Error("Data e hora são obrigatórias (formato ISO 8601)");
        }
        
        // Validar formato de data
        const scheduledDate = new Date(parameters.scheduled_for);
        if (isNaN(scheduledDate.getTime())) {
          throw new Error("Data e hora inválidas. Use formato ISO 8601");
        }
        
        // Validar se data não é no passado
        if (scheduledDate < new Date()) {
          throw new Error("Não é possível agendar ligação no passado");
        }
        
        // Validar prioridade
        if (parameters.priority && !["low", "normal", "high"].includes(parameters.priority)) {
          throw new Error("Prioridade deve ser: low, normal ou high");
        }
        
        // Validar se lead pertence à organização
        const leadBelongsToOrg = await validateLeadBelongsToOrg(
          supabase,
          parameters.lead_id,
          organizationId
        );
        if (!leadBelongsToOrg) {
          throw new Error("Lead não encontrado ou não pertence à organização");
        }

        const { data: call, error } = await supabase
          .from("call_queue")
          .insert({
            lead_id: parameters.lead_id,
            organization_id: organizationId,
            scheduled_for: parameters.scheduled_for,
            priority: parameters.priority || "normal",
            notes: parameters.notes || null,
            status: "pending",
            created_by: userId,
          })
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          call,
          message: "Ligação agendada com sucesso",
        };
      }

      case "send_whatsapp_message": {
        // Validações
        if (!parameters.lead_id || !isValidUUID(parameters.lead_id)) {
          throw new Error("ID do lead inválido");
        }
        if (!parameters.message || typeof parameters.message !== "string") {
          throw new Error("Mensagem é obrigatória");
        }
        if (!isValidStringLength(parameters.message, 1, 1000)) {
          throw new Error("Mensagem deve ter entre 1 e 1000 caracteres");
        }
        
        // Validar instance_id se fornecido
        if (parameters.instance_id && !isValidUUID(parameters.instance_id)) {
          throw new Error("ID da instância inválido");
        }
        
        // Validar se lead pertence à organização
        const leadBelongsToOrg = await validateLeadBelongsToOrg(
          supabase,
          parameters.lead_id,
          organizationId
        );
        if (!leadBelongsToOrg) {
          throw new Error("Lead não encontrado ou não pertence à organização");
        }
        
        // Buscar lead
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("id, phone")
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .single();

        if (leadError || !lead) {
          console.error("Erro ao buscar lead:", sanitizeError(leadError));
          throw new Error("Lead não encontrado");
        }
        
        // Validar telefone do lead
        if (!lead.phone || !isValidPhone(lead.phone)) {
          throw new Error("Lead não possui telefone válido");
        }

        // Buscar instância Evolution
        let instanceId = parameters.instance_id;
        if (!instanceId) {
          const { data: instance } = await supabase
            .from("evolution_config")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("is_connected", true)
            .limit(1)
            .maybeSingle();
          instanceId = instance?.id;
        }

        if (!instanceId) {
          throw new Error("Nenhuma instância Evolution conectada");
        }

        // Chamar Edge Function para enviar mensagem
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-whatsapp-message`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              instanceId,
              phone: lead.phone,
              message: parameters.message,
              leadId: parameters.lead_id,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Erro ao enviar mensagem WhatsApp:", sanitizeError(errorText));
          throw new Error("Erro ao enviar mensagem WhatsApp");
        }

        const result = await response.json();

        if (result.error) {
          console.error("Erro na resposta:", sanitizeError(result.error));
          throw new Error("Erro ao enviar mensagem WhatsApp");
        }

        return {
          success: true,
          messageId: result.messageId || result.key?.id,
          message: "Mensagem enviada com sucesso",
        };
      }

      case "get_lead_statistics": {
        const startDate = parameters.start_date
          ? new Date(parameters.start_date)
          : null;
        const endDate = parameters.end_date
          ? new Date(parameters.end_date)
          : null;

        let query = supabase
          .from("leads")
          .select("id, value, stage_id, created_at")
          .eq("organization_id", organizationId)
          .is("deleted_at", null);

        if (startDate) {
          query = query.gte("created_at", startDate.toISOString());
        }
        if (endDate) {
          query = query.lte("created_at", endDate.toISOString());
        }

        const { data: leads, error } = await query;

        if (error) throw error;

        const totalLeads = leads?.length || 0;
        const totalValue =
          leads?.reduce((sum: number, l: any) => sum + (l.value || 0), 0) || 0;
        const averageTicket = totalLeads > 0 ? totalValue / totalLeads : 0;

        // Buscar última etapa para calcular conversão
        const { data: lastStage } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("organization_id", organizationId)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle();

        const leadsInLastStage = lastStage
          ? leads?.filter((l: any) => l.stage_id === lastStage.id).length || 0
          : 0;
        const conversionRate =
          totalLeads > 0 ? (leadsInLastStage / totalLeads) * 100 : 0;

        return {
          success: true,
          statistics: {
            totalLeads,
            totalValue: Math.round(totalValue * 100) / 100,
            averageTicket: Math.round(averageTicket * 100) / 100,
            conversionRate: Math.round(conversionRate * 10) / 10,
            leadsInLastStage,
          },
          message: `Estatísticas: ${totalLeads} leads, R$ ${totalValue.toFixed(2)} total, ${conversionRate.toFixed(1)}% conversão`,
        };
      }

      case "get_stage_statistics": {
        const { data: stages } = await supabase
          .from("pipeline_stages")
          .select("id, name, position")
          .eq("organization_id", organizationId)
          .order("position");

        const { data: leads } = await supabase
          .from("leads")
          .select("id, stage_id, value")
          .eq("organization_id", organizationId)
          .is("deleted_at", null);

        const stageStats = (stages || []).map((stage: any) => {
          const stageLeads = leads?.filter(
            (l: any) => l.stage_id === stage.id
          ) || [];
          const stageValue =
            stageLeads.reduce((sum: number, l: any) => sum + (l.value || 0), 0) ||
            0;

          return {
            stageId: stage.id,
            stageName: stage.name,
            leadCount: stageLeads.length,
            totalValue: Math.round(stageValue * 100) / 100,
            averageValue:
              stageLeads.length > 0
                ? Math.round((stageValue / stageLeads.length) * 100) / 100
                : 0,
          };
        });

        return {
          success: true,
          statistics: stageStats,
          message: `Estatísticas por etapa: ${stageStats.length} etapas`,
        };
      }

      case "get_source_statistics": {
        const { data: leads, error } = await supabase
          .from("leads")
          .select("source, value")
          .eq("organization_id", organizationId)
          .is("deleted_at", null);

        if (error) throw error;

        const sourceMap = new Map<string, { count: number; value: number }>();

        (leads || []).forEach((lead: any) => {
          const source = lead.source || "desconhecida";
          const current = sourceMap.get(source) || { count: 0, value: 0 };
          sourceMap.set(source, {
            count: current.count + 1,
            value: current.value + (lead.value || 0),
          });
        });

        const sourceStats = Array.from(sourceMap.entries()).map(
          ([source, data]) => ({
            source,
            leadCount: data.count,
            totalValue: Math.round(data.value * 100) / 100,
            averageValue:
              data.count > 0
                ? Math.round((data.value / data.count) * 100) / 100
                : 0,
          })
        );

        return {
          success: true,
          statistics: sourceStats,
          message: `Estatísticas por origem: ${sourceStats.length} origens`,
        };
      }

      case "get_call_queue_statistics": {
        const { data: calls, error } = await supabase
          .from("call_queue")
          .select("status")
          .eq("organization_id", organizationId);

        if (error) throw error;

        const totalPending =
          calls?.filter((c: any) => c.status === "pending").length || 0;
        const totalCompleted =
          calls?.filter((c: any) => c.status === "completed").length || 0;
        const totalRescheduled =
          calls?.filter((c: any) => c.status === "rescheduled").length || 0;
        const totalInQueue = calls?.length || 0;
        const completionRate =
          totalInQueue > 0 ? (totalCompleted / totalInQueue) * 100 : 0;

        return {
          success: true,
          statistics: {
            totalPending,
            totalCompleted,
            totalRescheduled,
            totalInQueue,
            completionRate: Math.round(completionRate * 10) / 10,
          },
          message: `Fila de ligações: ${totalPending} pendentes, ${totalCompleted} concluídas`,
        };
      }

      case "get_recent_leads": {
        // Validações
        const limit = Math.min(Math.max(1, parameters.limit || 10), 50); // Entre 1 e 50
        const days = Math.min(Math.max(1, parameters.days || 7), 365); // Entre 1 e 365
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data: leads, error } = await supabase
          .from("leads")
          .select("id, name, phone, email, company, value, status, created_at, stage_id")
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) throw error;

        return {
          success: true,
          leads: leads || [],
          count: leads?.length || 0,
          message: `Encontrados ${leads?.length || 0} leads recentes`,
        };
      }

      case "get_lead_details": {
        // Validações
        if (!parameters.lead_id || !isValidUUID(parameters.lead_id)) {
          throw new Error("ID do lead inválido");
        }
        
        // Validar se lead pertence à organização
        const leadBelongsToOrg = await validateLeadBelongsToOrg(
          supabase,
          parameters.lead_id,
          organizationId
        );
        if (!leadBelongsToOrg) {
          throw new Error("Lead não encontrado ou não pertence à organização");
        }
        
        const { data: lead, error } = await supabase
          .from("leads")
          .select(
            "id, name, phone, email, company, value, status, notes, source, created_at, updated_at, stage_id, assigned_to"
          )
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .single();

        if (error) {
          console.error("Erro ao buscar lead:", sanitizeError(error));
          throw new Error("Erro ao buscar detalhes do lead");
        }
        if (!lead) throw new Error("Lead não encontrado");

        // Buscar tags do lead
        const { data: leadTags } = await supabase
          .from("lead_tags")
          .select("tag_id")
          .eq("lead_id", parameters.lead_id);

        // Buscar nomes das tags
        const tagIds = leadTags?.map((lt: any) => lt.tag_id) || [];
        let tagNames: string[] = [];
        if (tagIds.length > 0) {
          const { data: tags } = await supabase
            .from("tags")
            .select("name")
            .in("id", tagIds);
          tagNames = tags?.map((t: any) => t.name) || [];
        }

        // Buscar atividades
        const { data: activities } = await supabase
          .from("activities")
          .select("type, content, created_at")
          .eq("lead_id", parameters.lead_id)
          .order("created_at", { ascending: false })
          .limit(10);

        return {
          success: true,
          lead: {
            ...lead,
            tags: tagNames,
            recentActivities: activities || [],
          },
          message: "Detalhes do lead obtidos com sucesso",
        };
      }

      default:
        throw new Error(`Função desconhecida: ${functionName}`);
    }
  } catch (error: any) {
    console.error(`❌ Erro ao executar função ${functionName}:`, sanitizeError(error));
    return {
      success: false,
      error: sanitizeError(error),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar token e obter usuário
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { message, conversation_id, organization_id } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Mensagem não fornecida" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter organização do usuário logado
    let organizationId = organization_id;
    if (!organizationId) {
      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      organizationId = orgMember?.organization_id;
      
      console.log(`📍 Organização do usuário ${user.id}: ${organizationId}`);
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Organização não encontrada" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // VALIDAÇÃO DE SEGURANÇA: Verificar se o usuário pertence à organização
    const { data: orgMember, error: orgError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (orgError) {
      console.error("Erro ao verificar membro da organização:", orgError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se é admin ou pubdigital (podem acessar qualquer organização)
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const { data: isPubdigital } = await supabase.rpc("is_pubdigital_user", {
      _user_id: user.id,
    });

    // Se não é membro da organização E não é admin/pubdigital, negar acesso
    if (!orgMember && !adminRole && !isPubdigital) {
      return new Response(
        JSON.stringify({ 
          error: "Acesso negado: você não pertence a esta organização" 
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar ou criar conversa
    let conversationId = conversation_id;
    let conversationMessages: any[] = [];

      if (conversationId) {
      // VALIDAÇÃO DE SEGURANÇA: Verificar se a conversa pertence ao usuário e organização
      const { data: conv } = await supabase
        .from("assistant_conversations")
        .select("messages, user_id, organization_id")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .single();

      if (conv) {
        // Verificação adicional de segurança
        if (conv.user_id !== user.id || conv.organization_id !== organizationId) {
          return new Response(
            JSON.stringify({ 
              error: "Acesso negado: conversa não pertence a você" 
            }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        conversationMessages = Array.isArray(conv.messages)
          ? conv.messages
          : [];
      }
    }

    // Buscar configurações do assistente (organização específica ou global)
    const { data: orgConfig } = await supabase
      .from("assistant_config")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();

    const { data: globalConfig } = await supabase
      .from("assistant_config")
      .select("*")
      .is("organization_id", null)
      .eq("is_global", true)
      .eq("is_active", true)
      .maybeSingle();

    // Usar configuração da organização se existir, senão usar global
    const config = orgConfig || globalConfig || {};

    // Buscar contexto da organização (etapas, tags)
    const { data: stages } = await supabase
      .from("pipeline_stages")
      .select("id, name, position")
      .eq("organization_id", organizationId)
      .order("position");

    const { data: tags } = await supabase
      .from("tags")
      .select("id, name")
      .eq("organization_id", organizationId)
      .limit(20);

    // Montar contexto do sistema baseado nas configurações
    let systemContext = config.system_prompt || `Você é um assistente de CRM especializado em gerenciar leads, contatos e vendas.`;

    // Adicionar tom de voz
    if (config.tone_of_voice) {
      const toneInstructions: Record<string, string> = {
        profissional: "Mantenha um tom profissional e respeitoso em todas as respostas.",
        amigável: "Seja amigável, caloroso e acessível nas respostas.",
        formal: "Use linguagem formal e polida em todas as comunicações.",
        casual: "Use um tom casual e descontraído, mas ainda profissional.",
        técnico: "Use terminologia técnica quando apropriado e seja preciso.",
        vendedor: "Seja persuasivo, entusiasmado e focado em resultados de vendas.",
      };
      systemContext += `\n\nTOM DE VOZ: ${toneInstructions[config.tone_of_voice] || config.tone_of_voice}`;
    }

    // Adicionar regras
    if (config.rules) {
      systemContext += `\n\nREGRAS DE COMPORTAMENTO:\n${config.rules}`;
    }

    // Adicionar restrições
    if (config.restrictions) {
      systemContext += `\n\nRESTRIÇÕES (NÃO FAÇA):\n${config.restrictions}`;
    }

    // Adicionar exemplos
    if (config.examples) {
      systemContext += `\n\nEXEMPLOS DE BOAS RESPOSTAS:\n${config.examples}`;
    }

    // Adicionar contexto do sistema (etapas e tags)
    systemContext += `\n\nETAPAS DO FUNIL DISPONÍVEIS:
${(stages || [])
  .map((s: any) => `- ${s.name} (ID: ${s.id})`)
  .join("\n")}

TAGS DISPONÍVEIS:
${(tags || [])
  .map((t: any) => `- ${t.name} (ID: ${t.id})`)
  .join("\n")}

INSTRUÇÕES ADICIONAIS:
- Seja claro e objetivo nas respostas
- Sempre confirme ações importantes antes de executar
- Use as funções disponíveis para realizar ações no sistema
- Quando buscar leads, apresente os resultados de forma organizada
- Sempre informe o ID do lead quando criar ou atualizar`;

    // Montar histórico de mensagens
    const messages: any[] = [
      { role: "system", content: systemContext },
      ...conversationMessages.slice(-10), // Últimas 10 mensagens
      { role: "user", content: message },
    ];

    // Buscar API Key do DeepSeek (prioridade: configuração da organização > global)
    let deepseekApiKey: string | null = null;
    
    // Primeiro tenta usar a API key da configuração da organização
    if (config.api_key) {
      deepseekApiKey = config.api_key;
      console.log("🔑 Usando API key da configuração da organização");
    } else {
      // Se não tiver na configuração, usa a variável de ambiente global
      deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || null;
      if (deepseekApiKey) {
        console.log("🔑 Usando API key global (variável de ambiente)");
      }
    }
    // NUNCA logar a API key completa - apenas indicar que foi encontrada
    
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({
          error:
            "API Key do DeepSeek não configurada. Configure a API key na configuração do assistente ou a variável DEEPSEEK_API_KEY no Supabase.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Validar tamanho da mensagem
    if (!validateMessageLength(message)) {
      return new Response(
        JSON.stringify({
          error: `Mensagem muito longa. Máximo ${MAX_MESSAGE_LENGTH} caracteres.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Chamar DeepSeek API
    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: "auto",
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 2000,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("Erro na API DeepSeek:", sanitizeError(errorText));
      throw new Error("Erro ao processar solicitação com o assistente de IA");
    }

    const deepseekData = await deepseekResponse.json();
    const assistantMessage = deepseekData.choices[0].message;

    // Processar tool calls se houver
    let finalResponse = assistantMessage.content || "";
    const toolCalls = assistantMessage.tool_calls || [];

    if (toolCalls.length > 0) {
      const toolResults: any[] = [];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let parameters: any;
        try {
          parameters = JSON.parse(toolCall.function.arguments);
        } catch {
          parameters = toolCall.function.arguments;
        }

        const result = await executeFunction(
          supabase,
          functionName,
          parameters,
          organizationId,
          user.id
        );

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: JSON.stringify(result),
        });

        // Registrar ação
        await supabase.from("assistant_actions").insert({
          conversation_id: conversationId || null,
          organization_id: organizationId,
          user_id: user.id,
          action_type: functionName,
          function_name: functionName,
          parameters,
          result,
          success: result.success !== false,
          error_message: result.error || null,
        });
      }

      // Segunda chamada ao DeepSeek com resultados
      const secondMessages = [
        ...messages,
        assistantMessage,
        ...toolResults,
      ];

      const secondResponse = await fetch(DEEPSEEK_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseekApiKey}`,
        },
        body: JSON.stringify({
          model: config.model || "deepseek-chat",
          messages: secondMessages,
          temperature: config.temperature || 0.7,
          max_tokens: config.max_tokens || 2000,
        }),
      });

      if (secondResponse.ok) {
        const secondData = await secondResponse.json();
        finalResponse = secondData.choices[0].message.content;
      }
    }

    // Salvar conversa
    const newMessages = [
      ...conversationMessages,
      { role: "user", content: message },
      { role: "assistant", content: finalResponse },
    ];

    if (conversationId) {
      await supabase
        .from("assistant_conversations")
        .update({
          messages: newMessages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } else {
      const { data: newConv } = await supabase
        .from("assistant_conversations")
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          messages: newMessages,
          title: message.substring(0, 50),
        })
        .select("id")
        .single();

      conversationId = newConv?.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: finalResponse,
        conversation_id: conversationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("❌ Erro no assistente:", sanitizeError(error));
    return new Response(
      JSON.stringify({
        error: sanitizeError(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

