import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, organization_id } = await req.json();

    if (!description) {
      return new Response(
        JSON.stringify({ error: "Descrição do workflow é obrigatória" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar API key da OpenAI da organização
    const { data: openaiConfig, error: configError } = await supabase
      .from("openai_configs")
      .select("api_key")
      .eq("organization_id", organization_id)
      .single();

    if (configError || !openaiConfig || !openaiConfig.api_key) {
      throw new Error(
        "Configuração OpenAI não encontrada. Configure a API key no botão 'Configurar OpenAI'."
      );
    }

    const openaiKey = openaiConfig.api_key;

    // Prompt para gerar workflow n8n
    const systemPrompt = `Você é um especialista em criar workflows do n8n. 
Sua tarefa é gerar a estrutura JSON completa de um workflow n8n baseado na descrição fornecida pelo usuário.

O workflow n8n deve seguir esta estrutura EXATA:
{
  "name": "Nome do Workflow",
  "nodes": [
    {
      "parameters": {},
      "id": "uuid-único-1",
      "name": "Nome do Node",
      "type": "n8n-nodes-base.triggerType",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ],
  "connections": {
    "Node1": {
      "main": [[{"node": "Node2", "type": "main", "index": 0}]]
    }
  },
  "active": false,
  "settings": {},
  "staticData": null
}

Tipos de nodes comuns do n8n:
- Triggers: n8n-nodes-base.webhook, n8n-nodes-base.scheduleTrigger, n8n-nodes-base.manualTrigger, n8n-nodes-base.cron
- Actions: n8n-nodes-base.httpRequest, n8n-nodes-base.set, n8n-nodes-base.if, n8n-nodes-base.switch, n8n-nodes-base.code
- Integrations: n8n-nodes-base.postgres, n8n-nodes-base.mysql, n8n-nodes-base.slack, n8n-nodes-base.emailSend

IMPORTANTE:
1. Use IDs únicos para cada node (ex: "node-1", "node-2", "node-3")
2. Defina posições [x, y] para cada node (ex: [250, 300], [450, 300], [650, 300])
3. Crie conexões lógicas entre os nodes no formato correto
4. Sempre comece com um trigger node
5. Retorne APENAS o JSON válido dentro de um objeto com chave "workflow"
6. O workflow deve estar funcional e completo
7. Use typeVersion: 1 para todos os nodes
8. Configure parameters apropriados para cada tipo de node`;

    const userPrompt = `Crie um workflow n8n completo para: ${description}

Retorne APENAS um objeto JSON com a chave "workflow" contendo o workflow completo. Exemplo:
{
  "workflow": {
    "name": "...",
    "nodes": [...],
    "connections": {...}
  }
}`;

    // Chamar OpenAI
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro na API OpenAI:", errorText);
      throw new Error(`Erro ao gerar workflow: ${response.status}`);
    }

    const data = await response.json();
    const workflowJson = data.choices[0]?.message?.content;

    if (!workflowJson) {
      throw new Error("Resposta vazia da OpenAI");
    }

    // Parse do JSON retornado
    let workflow;
    try {
      // Tentar extrair JSON se vier dentro de um objeto maior
      const parsed = JSON.parse(workflowJson);
      // Se a resposta contém um campo 'workflow', usar ele, senão usar o objeto inteiro
      workflow = parsed.workflow || parsed;
      
      // Se ainda não tiver a estrutura correta, tentar encontrar o workflow
      if (!workflow.nodes && parsed.workflow) {
        workflow = parsed.workflow;
      }
    } catch (e) {
      // Se não for JSON válido, tentar extrair de markdown code blocks
      const jsonMatch = workflowJson.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[1]);
        workflow = extracted.workflow || extracted;
      } else {
        // Tentar encontrar JSON no texto
        const jsonInText = workflowJson.match(/\{[\s\S]*\}/);
        if (jsonInText) {
          const extracted = JSON.parse(jsonInText[0]);
          workflow = extracted.workflow || extracted;
        } else {
          throw new Error("Não foi possível parsear o JSON do workflow");
        }
      }
    }

    // Validar estrutura básica
    if (!workflow.name) {
      workflow.name = `Workflow: ${description.substring(0, 50)}`;
    }
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      workflow.nodes = [];
    }
    if (!workflow.connections) {
      workflow.connections = {};
    }
    if (workflow.active === undefined) {
      workflow.active = false;
    }

    return new Response(
      JSON.stringify({
        success: true,
        workflow,
        description: `Workflow gerado com ${workflow.nodes.length} nodes`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Erro ao gerar workflow:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao gerar workflow",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

