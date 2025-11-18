import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const replaceInstancePlaceholder = (value: string | null, instanceName: string) => {
  if (!value) return null;
  return value
    .replace(/:instance/gi, instanceName)
    .replace(/{instance}/gi, instanceName)
    .replace(/{instanceName}/gi, instanceName);
};

const buildFullUrl = (baseUrl: string, path: string, instanceName: string) => {
  if (!path) {
    return baseUrl;
  }

  const normalizedPath = replaceInstancePlaceholder(path, instanceName) || "";

  if (normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/")) {
    return `${baseUrl}${normalizedPath}`;
  }

  return `${baseUrl}/${normalizedPath}`;
};

const normalizeInstanceResponse = (payload: any, instanceName: string): any => {
  if (!payload) return null;

  const tryMatch = (entry: any): any => {
    if (!entry) return null;
    if (entry.instance && (!instanceName || entry.instance.instanceName === instanceName)) {
      return entry.instance;
    }
    if (entry.instanceName === instanceName || entry.name === instanceName) {
      return entry;
    }
    if (!instanceName) {
      return entry.instance || entry;
    }
    return null;
  };

  if (Array.isArray(payload)) {
    const found =
      payload.find((item) => tryMatch(item)) ||
      payload.find((item) => item.instanceName === instanceName || item.name === instanceName);
    if (found) {
      return tryMatch(found) || found.instance || found;
    }
    return null;
  }

  if (payload.instance && (!instanceName || payload.instance.instanceName === instanceName)) {
    return payload.instance;
  }

  if (payload.data && typeof payload.data === "object") {
    const nested: any = normalizeInstanceResponse(payload.data, instanceName);
    if (nested) return nested;
  }

  if (payload.settings && payload.settings.instance) {
    return payload.settings.instance;
  }

  if (!instanceName || payload.instanceName === instanceName || payload.name === instanceName) {
    return payload.instance || payload;
  }

  return payload;
};

const extractIntegrations = (snapshot: any) => {
  if (!snapshot) return {};
  return (
    snapshot.integrations ||
    snapshot.settings?.integrations ||
    snapshot.instance?.integrations ||
    snapshot.data?.integrations ||
    {}
  );
};

const buildAssistantEntry = (agent: any) => {
  const timestamp = new Date().toISOString();
  return {
    assistant_id: agent.openai_assistant_id,
    assistantId: agent.openai_assistant_id,
    agent_id: agent.id,
    name: agent.name,
    description: agent.description || "",
    model: agent.model || null,
    language: agent.language || null,
    temperature: agent.temperature ?? null,
    prompt: agent.prompt_instructions || "",
    guardrails: agent.guardrails || "",
    few_shot_examples: agent.few_shot_examples || "",
    policies: agent.policies,
    persona: agent.persona,
    metadata: agent.metadata,
    allow_fallback: agent.allow_fallback ?? false,
    test_mode: agent.test_mode ?? false,
    version: agent.version ?? 1,
    updated_at: timestamp,
    last_synced_at: timestamp,
  };
};

const mergeOpenAIIntegrations = (
  existingIntegrations: Record<string, unknown>,
  assistantEntry: Record<string, unknown>,
  openaiKey: string,
  agent: any
) => {
  const existingOpenAI =
    (existingIntegrations?.openai as Record<string, unknown>) ||
    (existingIntegrations?.openAI as Record<string, unknown>) ||
    {};

  const assistantsSource = Array.isArray((existingOpenAI as any).assistants)
    ? (existingOpenAI as any).assistants
    : Array.isArray((existingOpenAI as any).agents)
      ? (existingOpenAI as any).agents
      : [];

  const assistantsMap = new Map<string, any>();
  for (const entry of assistantsSource) {
    if (!entry) continue;
    const key = entry.assistant_id || entry.assistantId || entry.id;
    if (key) {
      assistantsMap.set(String(key), entry);
    }
  }
  assistantsMap.set(String(assistantEntry.assistant_id), assistantEntry);

  const assistants = Array.from(assistantsMap.values());

  const openaiIntegration = {
    ...existingOpenAI,
    enabled: true,
    api_key: openaiKey,
    apiKey: openaiKey,
    assistant_id: assistantEntry.assistant_id,
    assistantId: assistantEntry.assistant_id,
    assistant_name: assistantEntry.name,
    assistantName: assistantEntry.name,
    organization_id: agent.organization_id,
    organizationId: agent.organization_id,
    last_sync_at: assistantEntry.updated_at,
    lastSyncAt: assistantEntry.updated_at,
    assistants,
  };

  const updatedIntegrations = {
    ...existingIntegrations,
    openai: openaiIntegration,
    openAI: openaiIntegration,
  };

  return { openaiIntegration, updatedIntegrations };
};

const buildPayloadForPath = (path: string, basePayload: Record<string, unknown>) => {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.includes("viewpool")) {
    return {
      instanceName: basePayload.instanceName,
      agent: basePayload.assistant,
      assistant: basePayload.assistant,
      openai: basePayload.openai,
      openAI: basePayload.openai,
    };
  }

  if (normalizedPath.includes("integrations/openai")) {
    // Para endpoints específicos de OpenAI, enviar tanto o objeto openai quanto integrations completo
    return {
      instanceName: basePayload.instanceName,
      openai: basePayload.openai,
      openAI: basePayload.openai,
      integrations: basePayload.integrations, // Incluir também o objeto completo de integrations
    };
  }

  if (normalizedPath.includes("integrations")) {
    // Para endpoints genéricos de integrations, sempre enviar o objeto completo
    return {
      instanceName: basePayload.instanceName,
      integrations: basePayload.integrations,
    };
  }

  if (normalizedPath.includes("settings")) {
    // Para endpoints de settings, incluir propriedades adicionais da instância
    return {
      instanceName: basePayload.instanceName,
      rejectCall: false,
      groupsIgnore: true,
      alwaysOnline: true,
      readMessages: true,
      readStatus: true,
      syncFullHistory: false,
      integrations: basePayload.integrations,
    };
  }

  return basePayload;
};

const buildCandidatePaths = (instanceName: string, configPath?: string | null) => {
  const candidates: string[] = [];

  // Priorizar endpoint customizado se configurado
  if (configPath) {
    candidates.push(configPath);
  }

  // Priorizar endpoints específicos de integrations/openai (mais diretos)
  candidates.push(`/instance/${instanceName}/integrations/openai`);
  candidates.push(`/integrations/${instanceName}/openai`);
  
  // Depois endpoints genéricos de integrations
  candidates.push(`/instance/${instanceName}/integrations`);
  candidates.push(`/integrations/${instanceName}`);
  
  // Depois endpoints de settings (podem aceitar integrations)
  candidates.push(`/instance/settings/${instanceName}`);
  candidates.push(`/instance/${instanceName}/settings`);
  candidates.push(`/settings/set/${instanceName}`);
  
  // Endpoints de update genéricos
  candidates.push(`/instance/update/${instanceName}`);
  
  // Fallback para ViewPool (legado)
  candidates.push(`/viewpool/sync-agent`);

  return candidates;
};

const buildMethodCandidates = (syncMethod?: string | null) => {
  if (syncMethod) {
    return [syncMethod.toUpperCase()];
  }
  return ["POST", "PUT", "PATCH"];
};

const fetchInstanceSnapshot = async (baseUrl: string, config: any) => {
  const fetchPaths = [
    `/instance/settings/${config.instance_name}`,
    `/instance/${config.instance_name}/settings`,
    `/instance/${config.instance_name}`,
    `/instance/fetchInstances/${config.instance_name}`,
    `/instance/fetchInstances?instanceName=${config.instance_name}`,
    `/settings/${config.instance_name}`,
  ];

  for (const path of fetchPaths) {
    const url = buildFullUrl(baseUrl, path, config.instance_name);
    try {
      console.log(`🔍 [agents-sync-evolution] Buscando snapshot em: ${url}`);
      const response = await fetch(url, {
        headers: {
          "apikey": config.api_key || "",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ [agents-sync-evolution] Snapshot ${url} retornou ${response.status}`);
        continue;
      }

      const raw = await response.json();
      const normalized = normalizeInstanceResponse(raw, config.instance_name);
      if (normalized) {
        console.log("📄 [agents-sync-evolution] Snapshot encontrado!");
        return { raw, normalized };
      }
    } catch (error) {
      console.warn(`⚠️ [agents-sync-evolution] Erro ao buscar snapshot em ${url}:`, error);
    }
  }

  console.warn("⚠️ [agents-sync-evolution] Nenhum snapshot da instância foi obtido. Usando integrações vazias.");
  return { raw: null, normalized: null };
};

const maskSecrets = (payload: any, openaiKey: string) => {
  if (!payload) return payload;
  const clone = JSON.parse(JSON.stringify(payload));

  const maskRecursive = (node: any) => {
    if (!node || typeof node !== "object") {
      return;
    }
    for (const key of Object.keys(node)) {
      if (
        key === "api_key" ||
        key === "apiKey" ||
        key === "openai_api_key" ||
        key === "openaiApiKey"
      ) {
        node[key] = openaiKey ? "***PRESENTE***" : "***AUSENTE***";
      } else {
        maskRecursive(node[key]);
      }
    }
  };

  maskRecursive(clone);
  return clone;
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
          api_key,
          instance_name,
          sync_path,
          sync_method
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

    if (!config.api_url) {
      console.error("❌ [agents-sync-evolution] API URL não encontrada na configuração Evolution!");
      throw new Error("API URL não configurada para a instância Evolution");
    }

    const baseUrl = normalizeUrl(config.api_url);
    console.log("✅ [agents-sync-evolution] API URL normalizada:", baseUrl);
    console.log("✅ [agents-sync-evolution] API Key presente:", !!config.api_key);

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

    console.log("🔍 [agents-sync-evolution] Coletando integrações atuais da instância...");
    const snapshot = await fetchInstanceSnapshot(baseUrl, config);
    const existingIntegrations = extractIntegrations(snapshot.normalized);
    console.log(
      "📦 [agents-sync-evolution] Chaves atuais de integrações:",
      existingIntegrations ? Object.keys(existingIntegrations) : "nenhuma"
    );

    const assistantEntry = buildAssistantEntry(agent);
    const { openaiIntegration, updatedIntegrations } = mergeOpenAIIntegrations(
      existingIntegrations,
      assistantEntry,
      openaiKey,
      agent
    );

    const basePayload = {
      instanceName: config.instance_name,
      syncedAt: assistantEntry.updated_at,
      openai: openaiIntegration,
      openAI: openaiIntegration,
      integrations: updatedIntegrations,
      assistant: assistantEntry,
      agent: assistantEntry,
    };

    const candidatePaths = buildCandidatePaths(config.instance_name, config.sync_path);
    const methodCandidates = buildMethodCandidates(config.sync_method);

    console.log("🎯 [agents-sync-evolution] Endpoints candidatos:", candidatePaths);
    console.log("🎯 [agents-sync-evolution] Métodos candidatos:", methodCandidates);

    let successEndpoint = "";
    let evolutionResult: any = null;
    let lastError = "";

    outerLoop: for (const rawPath of candidatePaths) {
      const endpoint = buildFullUrl(baseUrl, rawPath, config.instance_name);
      const payloadForPath = buildPayloadForPath(rawPath, basePayload);
      const maskedPayload = maskSecrets(payloadForPath, openaiKey);

      for (const method of methodCandidates) {
        console.log(`🚀 [agents-sync-evolution] Tentando ${method} ${endpoint}`);
        console.log("📦 [agents-sync-evolution] Payload enviado:", JSON.stringify(maskedPayload, null, 2));

        try {
          const response = await fetch(endpoint, {
            method,
            headers: {
              "Content-Type": "application/json",
              apikey: config.api_key || "",
            },
            body: JSON.stringify(payloadForPath),
          });

          const responseText = await response.text();
          console.log(
            `📡 [agents-sync-evolution] Resposta (${method} ${endpoint}):`,
            response.status,
            response.statusText
          );
          console.log(`📄 [agents-sync-evolution] Corpo da resposta:`, responseText);

          if (!response.ok) {
            lastError = responseText || `HTTP ${response.status}`;
            continue;
          }

          try {
            evolutionResult = responseText ? JSON.parse(responseText) : {};
          } catch {
            evolutionResult = { raw: responseText };
          }

          if (evolutionResult?.error) {
            lastError =
              typeof evolutionResult.error === "string"
                ? evolutionResult.error
                : JSON.stringify(evolutionResult.error);
            console.warn("⚠️ [agents-sync-evolution] Resposta indica erro lógico:", evolutionResult);
            continue;
          }

          successEndpoint = `${method} ${endpoint}`;
          console.log(`✅ [agents-sync-evolution] Integração atualizada via ${successEndpoint}`);
          break outerLoop;
        } catch (fetchError) {
          console.error(`❌ [agents-sync-evolution] Erro ao chamar ${method} ${endpoint}:`, fetchError);
          lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }
    }

    if (!successEndpoint) {
      console.error("❌❌❌ [agents-sync-evolution] Nenhum endpoint aceitou a atualização.");
      throw new Error(
        `Falha ao configurar OpenAI na Evolution. Último erro conhecido: ${lastError || "sem detalhes"}`
      );
    }

    // Verificar se realmente configurou fazendo uma nova leitura
    // Aguardar um pouco para a Evolution processar a atualização
    console.log("🔍 [agents-sync-evolution] Aguardando 2 segundos antes de verificar integrações...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log("🔍 [agents-sync-evolution] Verificando integrações após atualização...");
    const verifySnapshot = await fetchInstanceSnapshot(baseUrl, config);
    const verifyIntegrations = extractIntegrations(verifySnapshot.normalized);
    const verifyOpenAI =
      verifyIntegrations.openai || verifyIntegrations.openAI || (verifyIntegrations as any)?.openAi;

    if (verifyOpenAI) {
      const assistantIdFound = (verifyOpenAI as any).assistant_id || (verifyOpenAI as any).assistantId;
      const assistantsArray = (verifyOpenAI as any).assistants || [];
      console.log("✅✅✅ [agents-sync-evolution] Integrações OpenAI encontradas após atualização!");
      console.log("📋 [agents-sync-evolution] Assistant ID encontrado:", assistantIdFound);
      console.log("📋 [agents-sync-evolution] Assistants array:", assistantsArray.length > 0 ? `${assistantsArray.length} assistente(s)` : "vazio");
      
      // Verificar se o assistant ID correto está presente
      if (assistantIdFound === agent.openai_assistant_id || 
          assistantsArray.some((a: any) => (a.assistant_id || a.assistantId) === agent.openai_assistant_id)) {
        console.log("✅✅✅ [agents-sync-evolution] CONFIRMADO: O assistant ID correto está presente na integração!");
      } else {
        console.warn("⚠️ [agents-sync-evolution] Assistant ID encontrado não corresponde ao esperado.");
      }
    } else {
      console.warn("⚠️⚠️⚠️ [agents-sync-evolution] Não foi possível confirmar a integração OpenAI na verificação.");
      console.warn("📋 [agents-sync-evolution] Isso pode ser normal se a Evolution API processar a atualização de forma assíncrona.");
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
