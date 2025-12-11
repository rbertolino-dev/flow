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

// Executa uma função retornada pelo DeepSeek
async function executeFunction(
  supabase: any,
  functionName: string,
  parameters: any,
  organizationId: string,
  userId: string
): Promise<any> {
  console.log(`🔧 Executando função: ${functionName}`, parameters);

  try {
    switch (functionName) {
      case "create_lead": {
        // Normalizar telefone (remover caracteres não numéricos)
        const normalizedPhone = parameters.phone.replace(/\D/g, "");

        // Buscar primeira etapa se não informada
        let stageId = parameters.stage_id;
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
          console.error("Erro ao criar lead:", insertError);
          throw insertError;
        }

        return { 
          success: true, 
          lead: newLead, 
          message: `Lead "${parameters.name}" criado com sucesso na etapa ${stageId ? 'especificada' : 'inicial'}` 
        };
      }

      case "search_leads": {
        const query = parameters.query.trim();
        const limit = parameters.limit || 10;

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
        const updateData: any = {};
        if (parameters.name) updateData.name = parameters.name;
        if (parameters.phone) {
          updateData.phone = parameters.phone.replace(/\D/g, "");
        }
        if (parameters.email !== undefined) updateData.email = parameters.email;
        if (parameters.company !== undefined)
          updateData.company = parameters.company;
        if (parameters.value !== undefined) updateData.value = parameters.value;
        if (parameters.stage_id !== undefined)
          updateData.stage_id = parameters.stage_id;
        if (parameters.notes !== undefined) updateData.notes = parameters.notes;
        updateData.updated_by = userId;
        updateData.updated_at = new Date().toISOString();

        const { data: updatedLead, error } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .select()
          .single();

        if (error) throw error;
        if (!updatedLead) throw new Error("Lead não encontrado");

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

        if (error) throw error;

        return {
          success: true,
          message: "Tag adicionada ao lead com sucesso",
        };
      }

      case "schedule_call": {
        // Buscar lead para validar
        const { data: lead } = await supabase
          .from("leads")
          .select("id")
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .single();

        if (!lead) throw new Error("Lead não encontrado");

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
        // Buscar lead
        const { data: lead, error: leadError } = await supabase
          .from("leads")
          .select("id, phone")
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .single();

        if (leadError || !lead) throw new Error("Lead não encontrado");

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
          const error = await response.text();
          throw new Error(`Erro ao enviar mensagem: ${error}`);
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
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
        const limit = parameters.limit || 10;
        const days = parameters.days || 7;
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
        const { data: lead, error } = await supabase
          .from("leads")
          .select(
            "id, name, phone, email, company, value, status, notes, source, created_at, updated_at, stage_id, assigned_to"
          )
          .eq("id", parameters.lead_id)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .single();

        if (error) throw error;
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
    console.error(`❌ Erro ao executar função ${functionName}:`, error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
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

    // Obter organização do usuário
    let organizationId = organization_id;
    if (!organizationId) {
      const { data: org } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      organizationId = org?.organization_id;
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

    // Buscar ou criar conversa
    let conversationId = conversation_id;
    let conversationMessages: any[] = [];

    if (conversationId) {
      const { data: conv } = await supabase
        .from("assistant_conversations")
        .select("messages")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .single();

      if (conv) {
        conversationMessages = Array.isArray(conv.messages)
          ? conv.messages
          : [];
      }
    }

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

    // Montar contexto do sistema
    const systemContext = `Você é um assistente de CRM especializado em gerenciar leads, contatos e vendas.

ETAPAS DO FUNIL DISPONÍVEIS:
${(stages || [])
  .map((s: any) => `- ${s.name} (ID: ${s.id})`)
  .join("\n")}

TAGS DISPONÍVEIS:
${(tags || [])
  .map((t: any) => `- ${t.name} (ID: ${t.id})`)
  .join("\n")}

INSTRUÇÕES:
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

    // Buscar API Key do DeepSeek (pode ser global ou por organização)
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      return new Response(
        JSON.stringify({
          error:
            "API Key do DeepSeek não configurada. Configure a variável DEEPSEEK_API_KEY no Supabase.",
        }),
        {
          status: 500,
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
        model: "deepseek-chat",
        messages,
        tools: AVAILABLE_TOOLS,
        tool_choice: "auto",
        temperature: 0.7,
      }),
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      throw new Error(`Erro na API DeepSeek: ${errorText}`);
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
          model: "deepseek-chat",
          messages: secondMessages,
          temperature: 0.7,
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
    console.error("❌ Erro no assistente:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

