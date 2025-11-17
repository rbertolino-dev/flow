import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🟢🟢🟢 [agents-sync-evolution] INÍCIO DA EXECUÇÃO");
    const { agentId } = await req.json();
    console.log("📋 [agents-sync-evolution] AgentId recebido:", agentId);

    if (!agentId) {
      console.error("❌ [agents-sync-evolution] agentId não fornecido!");
      throw new Error("agentId é obrigatório");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🔍 [agents-sync-evolution] Buscando dados do agente no banco...");
    // Buscar os dados do agente com a config da Evolution
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(`
        *,
        evolution_config:evolution_config_id (
          api_url,
          instance_name
        )
      `)
      .eq("id", agentId)
      .single();

    console.log("📦 [agents-sync-evolution] Resultado da busca:", { agent, agentError });

    if (agentError || !agent) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar agente:", agentError);
      throw new Error("Agente não encontrado");
    }

    console.log("✅ [agents-sync-evolution] Agente encontrado:", agent.name);
    console.log("📋 [agents-sync-evolution] OpenAI Assistant ID:", agent.openai_assistant_id);
    console.log("📋 [agents-sync-evolution] Evolution Config ID:", agent.evolution_config_id);

    const config = agent.evolution_config;
    console.log("📋 [agents-sync-evolution] Evolution config completo:", JSON.stringify(config, null, 2));
    
    if (!config || !config.instance_name) {
      console.error("❌ [agents-sync-evolution] Instância Evolution não configurada!");
      throw new Error("Instância Evolution não configurada para este agente");
    }

    if (!agent.openai_assistant_id) {
      console.error("❌ [agents-sync-evolution] OpenAI Assistant ID não encontrado!");
      throw new Error("Sincronize primeiro com OpenAI para obter o assistantId");
    }

    // Buscar API key da instância
    const { data: evolutionConfig, error: evolutionConfigError } = await supabase
      .from("evolution_config")
      .select("api_key, api_url")
      .eq("id", agent.evolution_config_id)
      .single();

    console.log("📦 [agents-sync-evolution] Evolution config completa:", { evolutionConfig, evolutionConfigError });

    if (evolutionConfigError || !evolutionConfig) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar config Evolution:", evolutionConfigError);
      throw new Error("Configuração Evolution não encontrada");
    }

    console.log("✅ [agents-sync-evolution] API URL:", evolutionConfig.api_url);
    console.log("✅ [agents-sync-evolution] API Key presente:", !!evolutionConfig.api_key);

    // Normalizar URL da API
    const normalizeUrl = (url: string) => {
      try {
        const u = new URL(url);
        let base = u.origin + u.pathname.replace(/\/$/, '');
        base = base.replace(/\/(manager|dashboard|app)$/, '');
        return base;
      } catch {
        return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');
      }
    };

    const baseUrl = normalizeUrl(evolutionConfig.api_url);

    // Buscar API key da tabela openai_configs
    console.log("🔍 [agents-sync-evolution] Buscando API key da organização...");
    const { data: openaiConfig, error: openaiConfigError } = await supabase
      .from("openai_configs")
      .select("api_key")
      .eq("organization_id", agent.organization_id)
      .single();

    console.log("📦 [agents-sync-evolution] Resultado da busca da config:", { 
      encontrado: !!openaiConfig, 
      openaiConfigError 
    });

    if (openaiConfigError || !openaiConfig?.api_key) {
      console.error("❌ [agents-sync-evolution] Erro ao buscar config OpenAI:", openaiConfigError);
      throw new Error("Configuração OpenAI não encontrada para esta organização. Configure a API key no botão 'Configurar OpenAI'.");
    }

    const openaiKey = openaiConfig.api_key;
    console.log("🔑 [agents-sync-evolution] API key encontrada:", !!openaiKey);

    if (!openaiKey) {
      console.error("❌ [agents-sync-evolution] API key vazia na configuração!");
      throw new Error(
        "API key OpenAI não configurada para esta organização. Configure no botão 'Configurar OpenAI'."
      );
    }

    // Payload para configurar OpenAI na Evolution (estrutura correta da API)
    // Tentar diferentes formatos de payload para compatibilidade
    const payloadVariants = [
      // Formato 1: Flat (mais comum)
      {
        openai_enabled: true,
        openai_api_key: openaiKey,
        openai_assistant_id: agent.openai_assistant_id,
        openai_organization_id: agent.organization_id,
      },
      // Formato 2: Aninhado em settings
      {
        settings: {
          openai_enabled: true,
          openai_api_key: openaiKey,
          openai_assistant_id: agent.openai_assistant_id,
          openai_organization_id: agent.organization_id,
        }
      },
      // Formato 3: Aninhado em openai
      {
        openai: {
          enabled: true,
          api_key: openaiKey,
          assistant_id: agent.openai_assistant_id,
          organization_id: agent.organization_id,
        }
      },
    ];

    console.log("📦 [agents-sync-evolution] Variantes de payload preparadas:", payloadVariants.length);

    // Lista de endpoints possíveis (diferentes versões da Evolution API)
    // Baseado na documentação da Evolution API v2
    const possibleEndpoints = [
      `${baseUrl}/instance/settings/${config.instance_name}`, // Endpoint mais comum
      `${baseUrl}/settings/set/${config.instance_name}`, // Alternativa
      `${baseUrl}/instance/${config.instance_name}/settings`, // Formato alternativo
      `${baseUrl}/instance/update/${config.instance_name}`, // Update endpoint
      `${baseUrl}/instance/${config.instance_name}`, // Direto na instância
      `${baseUrl}/settings/${config.instance_name}`, // Formato simplificado
    ];

    console.log("🌐 [agents-sync-evolution] URL base normalizada:", baseUrl);
    console.log("🎯 [agents-sync-evolution] Tentando endpoints:", possibleEndpoints);

    let evolutionResponse: Response | null = null;
    let evolutionResult: any = null;
    let lastError = "";
    let successEndpoint = "";

    // Tentar cada combinação de endpoint + payload até encontrar uma que funcione
    endpointLoop: for (const endpoint of possibleEndpoints) {
      for (let payloadIndex = 0; payloadIndex < payloadVariants.length; payloadIndex++) {
        const evolutionPayload = payloadVariants[payloadIndex];
        console.log(`🚀 [agents-sync-evolution] Tentando endpoint: ${endpoint} com payload formato ${payloadIndex + 1}`);
        console.log(`📦 [agents-sync-evolution] Payload:`, {
          ...evolutionPayload,
          openai_api_key: openaiKey ? "***PRESENTE***" : "***AUSENTE***",
          settings: evolutionPayload.settings ? {
            ...evolutionPayload.settings,
            openai_api_key: openaiKey ? "***PRESENTE***" : "***AUSENTE***"
          } : undefined,
          openai: evolutionPayload.openai ? {
            ...evolutionPayload.openai,
            api_key: openaiKey ? "***PRESENTE***" : "***AUSENTE***"
          } : undefined,
        });
        
        try {
          evolutionResponse = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evolutionConfig.api_key || "",
            },
            body: JSON.stringify(evolutionPayload),
          });

          console.log(`📡 [agents-sync-evolution] Status da resposta (${endpoint}):`, evolutionResponse.status);
          console.log(`📡 [agents-sync-evolution] Status text:`, evolutionResponse.statusText);

          const responseText = await evolutionResponse.text();
          console.log(`📄 [agents-sync-evolution] Resposta completa (${endpoint}):`, responseText);
          
          if (evolutionResponse.ok) {
            // Tentar parsear JSON da resposta
            let responseData: any;
            try {
              responseData = JSON.parse(responseText);
              console.log(`📊 [agents-sync-evolution] Resposta JSON:`, JSON.stringify(responseData, null, 2));
            } catch (e) {
              console.warn(`⚠️ [agents-sync-evolution] Resposta não é JSON válido:`, responseText);
              responseData = { raw: responseText };
            }
            
            // Verificar se a resposta realmente indica sucesso
            // Algumas APIs retornam 200 mas com erro no corpo
            if (responseData && typeof responseData === 'object') {
              if (responseData.error || responseData.message?.toLowerCase().includes('error')) {
                console.error(`❌ [agents-sync-evolution] Resposta indica erro:`, responseData);
                lastError = responseData.error || responseData.message || 'Erro na resposta da Evolution';
                continue;
              }
            }
            
            successEndpoint = `${endpoint} (payload formato ${payloadIndex + 1})`;
            evolutionResult = responseData;
            console.log(`✅ [agents-sync-evolution] Endpoint funcionou: ${endpoint} com payload formato ${payloadIndex + 1}`);
            console.log(`📊 [agents-sync-evolution] Dados da resposta:`, responseData);
            break endpointLoop; // Sair dos dois loops
          } else {
            lastError = responseText || `HTTP ${evolutionResponse.status}`;
            console.warn(`⚠️ [agents-sync-evolution] Endpoint ${endpoint} falhou com ${evolutionResponse.status}: ${responseText}`);
          }
        } catch (fetchError) {
          console.error(`❌ [agents-sync-evolution] Erro ao chamar ${endpoint}:`, fetchError);
          lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }
    }

    if (!evolutionResponse || !evolutionResponse.ok || !evolutionResult) {
      console.error("❌❌❌ [agents-sync-evolution] Todos os endpoints falharam!");
      console.error("📋 [agents-sync-evolution] Último erro:", lastError);
      throw new Error(
        `Falha ao configurar OpenAI na Evolution. Tentamos ${possibleEndpoints.length} endpoints diferentes. Último erro: ${lastError}`
      );
    }
    console.log(`✅✅✅ [agents-sync-evolution] Sucesso com endpoint: ${successEndpoint}`);
    console.log("✅✅✅ [agents-sync-evolution] Evolution API response:", evolutionResult);
    console.log("📊 [agents-sync-evolution] Response completo:", JSON.stringify(evolutionResult, null, 2));

    // Verificar se realmente configurou fazendo uma chamada GET para confirmar
    console.log("🔍 [agents-sync-evolution] Verificando se configuração foi aplicada...");
    const verifyEndpoints = [
      `${baseUrl}/instance/fetchInstances`,
      `${baseUrl}/instance/${config.instance_name}`,
      `${baseUrl}/instance/${config.instance_name}/settings`,
    ];
    
    let verified = false;
    for (const verifyEndpoint of verifyEndpoints) {
      try {
        console.log(`🔍 [agents-sync-evolution] Verificando em: ${verifyEndpoint}`);
        const verifyResponse = await fetch(verifyEndpoint, {
          headers: {
            "apikey": evolutionConfig.api_key || "",
          },
        });
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          console.log(`📊 [agents-sync-evolution] Dados da verificação:`, JSON.stringify(verifyData, null, 2));
          
          // Tentar encontrar a configuração OpenAI nos dados retornados
          const instanceData = Array.isArray(verifyData) 
            ? verifyData.find((i: any) => i.instance?.instanceName === config.instance_name || i.instanceName === config.instance_name)
            : verifyData;
          
          if (instanceData) {
            const hasOpenAI = instanceData.openai_enabled || 
                             instanceData.settings?.openai_enabled ||
                             instanceData.instance?.openai_enabled;
            
            if (hasOpenAI) {
              console.log(`✅✅✅ [agents-sync-evolution] CONFIRMADO: OpenAI está habilitado na instância!`);
              verified = true;
              break;
            } else {
              console.warn(`⚠️ [agents-sync-evolution] OpenAI não encontrado habilitado na resposta de verificação`);
            }
          }
        }
      } catch (verifyError) {
        console.warn(`⚠️ [agents-sync-evolution] Erro ao verificar:`, verifyError);
      }
    }
    
    if (!verified) {
      console.warn(`⚠️⚠️⚠️ [agents-sync-evolution] ATENÇÃO: Não foi possível confirmar se a configuração foi aplicada. Mas continuando...`);
    }

    // Atualizar agente no banco
    const { error: updateErr } = await supabase
      .from("agents")
      .update({ 
        evolution_instance_id: config.instance_name,
        updated_at: new Date().toISOString()
      })
      .eq("id", agentId);

    if (updateErr) {
      console.error("[agents-sync-evolution] Erro ao atualizar agente:", updateErr);
      throw new Error("Erro ao atualizar agente com instância Evolution");
    }

    console.log(`[agents-sync-evolution] Agente ${agent.name} sincronizado com Evolution`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Agente sincronizado com Evolution "${config.instance_name}"`,
        data: {
          agentId: agent.id,
          agentName: agent.name,
          evolutionInstance: config.instance_name,
          openaiAssistantId: agent.openai_assistant_id,
          evolutionResponse: evolutionResult,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[agents-sync-evolution] Erro:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
