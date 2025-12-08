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

    // Prompt para gerar workflow n8n baseado na documentação oficial
    const systemPrompt = `Você é um especialista em criar workflows do n8n seguindo a documentação oficial da API.

Estrutura EXATA de um workflow n8n conforme documentação:
{
  "name": "Nome do Workflow",
  "nodes": [
    {
      "id": "uuid-v4-válido",  // OBRIGATÓRIO: UUID v4 no formato xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      "name": "Nome do Node",
      "type": "n8n-nodes-base.triggerType",
      "typeVersion": 1,  // OBRIGATÓRIO
      "position": [250, 300],  // OBRIGATÓRIO: [x, y] array com 2 números
      "parameters": {}  // OBRIGATÓRIO: objeto (pode ser vazio)
    }
  ],
  "connections": {
    "node-id-1": {  // Use o ID do node, não o nome
      "main": [
        [
          {
            "node": "node-id-2",  // ID do node de destino
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveDataErrorExecution": "all",
    "saveDataSuccessExecution": "all",
    "saveManualExecutions": true
  },
  "staticData": null,
  "tags": []
}

REGRAS CRÍTICAS:
1. IDs dos nodes DEVEM ser UUIDs v4 válidos (formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
2. Cada node DEVE ter: id (UUID), name, type, typeVersion, position [x,y], parameters {}
3. Connections usam IDs dos nodes, não nomes
4. Sempre comece com um trigger node (webhook, scheduleTrigger, manualTrigger, ou cron)
5. Posições devem ser espaçadas: primeiro node [250, 300], segundo [550, 300], terceiro [850, 300], etc.
6. typeVersion geralmente é 1, mas pode variar (verifique o tipo específico)
7. Parameters devem ser configurados conforme o tipo de node

Tipos de nodes principais:
- Triggers: n8n-nodes-base.webhook, n8n-nodes-base.scheduleTrigger, n8n-nodes-base.manualTrigger, n8n-nodes-base.cron
- HTTP: n8n-nodes-base.httpRequest (method, url, authentication, etc.)
- Logic: n8n-nodes-base.if (conditions), n8n-nodes-base.switch (routing)
- Data: n8n-nodes-base.set (set fields), n8n-nodes-base.code (JavaScript)
- Database: n8n-nodes-base.postgres, n8n-nodes-base.mysql
- Integrations: n8n-nodes-base.slack, n8n-nodes-base.emailSend, n8n-nodes-base.telegram

Exemplo de node HTTP Request:
{
  "id": "uuid-v4",
  "name": "HTTP Request",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.1,
  "position": [550, 300],
  "parameters": {
    "method": "GET",
    "url": "https://api.exemplo.com/data",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth"
  }
}

Retorne APENAS JSON válido dentro de um objeto com chave "workflow".`;

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

    // Validar e corrigir estrutura básica
    if (!workflow.name) {
      workflow.name = `Workflow: ${description.substring(0, 50)}`;
    }
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      workflow.nodes = [];
    }
    if (!workflow.connections) {
      workflow.connections = {};
    }
    
    // Remover 'active' - é read-only na API
    delete workflow.active;
    
    // Validar e corrigir nodes
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    workflow.nodes = workflow.nodes.map((node: any, index: number) => {
      // Gerar UUID válido se não tiver ou for inválido
      if (!node.id || !uuidRegex.test(node.id)) {
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        node.id = uuid;
      }
      
      // Garantir propriedades obrigatórias
      if (!node.name) {
        node.name = `Node ${index + 1}`;
      }
      if (!node.type) {
        node.type = index === 0 ? "n8n-nodes-base.manualTrigger" : "n8n-nodes-base.set";
      }
      if (!node.typeVersion) {
        node.typeVersion = 1;
      }
      if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
        node.position = [250 + (index * 300), 300];
      }
      if (!node.parameters || typeof node.parameters !== 'object') {
        node.parameters = {};
      }
      
      return node;
    });
    
    // Se não tiver nodes, adicionar um trigger padrão
    if (workflow.nodes.length === 0) {
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      workflow.nodes.push({
        id: uuid,
        name: "Manual Trigger",
        type: "n8n-nodes-base.manualTrigger",
        typeVersion: 1,
        position: [250, 300],
        parameters: {},
      });
    }
    
    // Garantir settings
    if (!workflow.settings || typeof workflow.settings !== 'object') {
      workflow.settings = {
        executionOrder: "v1",
        saveDataErrorExecution: "all",
        saveDataSuccessExecution: "all",
        saveManualExecutions: true,
      };
    }
    
    // Garantir staticData
    if (workflow.staticData === undefined) {
      workflow.staticData = null;
    }
    
    // Garantir tags
    if (!workflow.tags || !Array.isArray(workflow.tags)) {
      workflow.tags = [];
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

