import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Tratar OPTIONS primeiro
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Garantir que sempre retornamos uma resposta válida
  try {
    console.log('[CREATE-EVOLUTION-INSTANCE] Iniciando requisição');
    console.log('[CREATE-EVOLUTION-INSTANCE] Método:', req.method);
    console.log('[CREATE-EVOLUTION-INSTANCE] URL:', req.url);
    
    // Parse do body com tratamento de erro específico
    let body: any;
    try {
      const bodyText = await req.text();
      console.log('[CREATE-EVOLUTION-INSTANCE] Body recebido (texto):', bodyText.substring(0, 200));
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('[CREATE-EVOLUTION-INSTANCE] Body vazio');
        return new Response(
          JSON.stringify({ error: 'Body da requisição está vazio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      body = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao fazer parse do JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao processar JSON da requisição',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[CREATE-EVOLUTION-INSTANCE] Body parseado:', {
      apiUrl: body.apiUrl ? '***' : 'ausente',
      apiKey: body.apiKey ? '***' : 'ausente',
      instanceName: body.instanceName,
      organizationId: body.organizationId,
      userId: body.userId
    });

    const { apiUrl, apiKey, instanceName, organizationId, userId } = body;

    if (!apiUrl || !apiKey || !instanceName || !organizationId || !userId) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Campos obrigatórios ausentes');
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CREATE-EVOLUTION-INSTANCE] Criando cliente Supabase');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar limites antes de criar instância
    console.log('[CREATE-EVOLUTION-INSTANCE] Verificando limites para org:', organizationId);
    
    // Verificar dados da organização primeiro para debug
    const { data: orgLimits, error: orgLimitsError } = await supabase
      .from('organization_limits')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();
    
    console.log('[CREATE-EVOLUTION-INSTANCE] Dados de organization_limits:', {
      exists: !!orgLimits,
      enabled_features: orgLimits?.enabled_features || null,
      enabled_features_type: orgLimits?.enabled_features ? typeof orgLimits.enabled_features : 'null',
      enabled_features_length: orgLimits?.enabled_features ? (Array.isArray(orgLimits.enabled_features) ? orgLimits.enabled_features.length : 'not array') : 'null',
      max_evolution_instances: orgLimits?.max_evolution_instances ?? null,
      max_instances: orgLimits?.max_instances ?? null,
      error: orgLimitsError ? orgLimitsError.message : null
    });
    
    // Contar instâncias atuais
    const { count: currentInstancesCount, error: countError } = await supabase
      .from('evolution_config')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    
    console.log('[CREATE-EVOLUTION-INSTANCE] Instâncias atuais:', {
      count: currentInstancesCount ?? 0,
      error: countError ? countError.message : null
    });
    
    // Verificar se usuário é super admin antes de chamar RPC
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    
    const { data: isPubdigital } = await supabase
      .rpc('is_pubdigital_user', { _user_id: userId });
    
    const isSuperAdmin = !!userRole || !!isPubdigital;
    
    console.log('[CREATE-EVOLUTION-INSTANCE] Verificação de super admin:', {
      userId,
      hasAdminRole: !!userRole,
      isPubdigital: !!isPubdigital,
      isSuperAdmin
    });
    
    // Chamar RPC passando userId para verificação de super admin
    const { data: canCreate, error: limitError } = await supabase
      .rpc('can_create_evolution_instance', { 
        _org_id: organizationId,
        _user_id: userId  // Passa userId para verificar super admin
      });

    if (limitError) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao verificar limites:', {
        code: limitError.code,
        message: limitError.message,
        details: limitError.details,
        hint: limitError.hint
      });
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao verificar limites da organização',
          details: limitError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[CREATE-EVOLUTION-INSTANCE] Limite verificado, pode criar:', canCreate);
    console.log('[CREATE-EVOLUTION-INSTANCE] Resumo da verificação:', {
      canCreate,
      orgLimitsExists: !!orgLimits,
      enabledFeatures: orgLimits?.enabled_features || null,
      currentInstances: currentInstancesCount ?? 0,
      maxEvolutionInstances: orgLimits?.max_evolution_instances ?? null,
      maxInstances: orgLimits?.max_instances ?? null
    });
    
    if (!canCreate) {
      // Mensagem mais detalhada para ajudar no debug
      let errorMessage = 'Limite de instâncias Evolution excedido ou funcionalidade não habilitada para esta organização.';
      if (orgLimits) {
        if (orgLimits.enabled_features && Array.isArray(orgLimits.enabled_features) && orgLimits.enabled_features.length > 0) {
          errorMessage += ` Features habilitadas: ${orgLimits.enabled_features.join(', ')}.`;
        } else {
          errorMessage += ' Nenhuma feature específica configurada.';
        }
        if (orgLimits.max_evolution_instances !== null) {
          errorMessage += ` Limite: ${orgLimits.max_evolution_instances} instâncias.`;
        }
        if (currentInstancesCount !== null) {
          errorMessage += ` Atuais: ${currentInstancesCount} instâncias.`;
        }
      } else {
        errorMessage += ' Organização não possui configuração de limites.';
      }
      errorMessage += ' Entre em contato com o administrador.';
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar URL
    const normalizedUrl = apiUrl.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');
    console.log('[CREATE-EVOLUTION-INSTANCE] URL normalizada:', normalizedUrl);

    // 1. Criar instância via Evolution API (com timeout)
    console.log('[CREATE-EVOLUTION-INSTANCE] Criando instância na Evolution API...');
    let createResponse: Response;
    try {
      // Timeout de 30 segundos para criação da instância
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      createResponse = await fetch(`${normalizedUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS', // Campo obrigatório
          qrcode: true,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('[CREATE-EVOLUTION-INSTANCE] Timeout ao criar instância na Evolution API');
        throw new Error('Timeout ao criar instância na Evolution API. Tente novamente.');
      }
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao fazer fetch para Evolution API:', fetchError);
      throw new Error(`Erro ao conectar com Evolution API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    if (!createResponse.ok) {
      let errorText = '';
      try {
        errorText = await createResponse.text();
      } catch (e) {
        errorText = `Status ${createResponse.status}: ${createResponse.statusText}`;
      }
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao criar instância Evolution:', errorText);
      throw new Error(`Erro ao criar instância: ${errorText}`);
    }

    let instanceData: any;
    try {
      instanceData = await createResponse.json();
      console.log('[CREATE-EVOLUTION-INSTANCE] Instância criada com sucesso');
    } catch (e) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao fazer parse da resposta:', e);
      throw new Error('Erro ao processar resposta da Evolution API');
    }

    // 2. Extrair QR Code da resposta de criação
    let qrCode = null;
    if (instanceData.qrcode) {
      // A Evolution API retorna o QR code diretamente na resposta de criação
      qrCode = instanceData.qrcode.base64 || instanceData.qrcode.code || instanceData.qrcode;
      if (qrCode && !qrCode.startsWith('data:image')) {
        // Se não for base64 completo, adicionar o prefixo
        qrCode = `data:image/png;base64,${qrCode}`;
      }
      console.log('✅ QR Code obtido da resposta de criação');
    }
    
    // Se não veio na resposta, tentar buscar pelo endpoint dedicado (com timeout)
    if (!qrCode) {
      console.log('[CREATE-EVOLUTION-INSTANCE] QR Code não veio na criação, tentando buscar...');
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const qrResponse = await fetch(`${normalizedUrl}/instance/qrcode/${instanceName}`, {
          headers: { 'apikey': apiKey },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          qrCode = qrData.base64 || qrData.qrcode || qrData.code || null;
          if (qrCode && !qrCode.startsWith('data:image')) {
            qrCode = `data:image/png;base64,${qrCode}`;
          }
          console.log('[CREATE-EVOLUTION-INSTANCE] QR Code obtido do endpoint dedicado');
        } else {
          console.log('[CREATE-EVOLUTION-INSTANCE] QR Code não disponível ainda (status:', qrResponse.status, ')');
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          console.log('[CREATE-EVOLUTION-INSTANCE] Timeout ao buscar QR Code (não crítico)');
        } else {
          console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao buscar QR Code:', e);
        }
        // Não é crítico - continuar sem QR Code
      }
    }

    // 3. Gerar webhook secret (DEVE ser UUID válido - coluna é UUID no banco)
    console.log('[CREATE-EVOLUTION-INSTANCE] Gerando webhook secret');
    let webhookSecret: string;
    try {
      webhookSecret = crypto.randomUUID();
      console.log('[CREATE-EVOLUTION-INSTANCE] UUID gerado:', webhookSecret.substring(0, 8) + '...');
    } catch (e) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao gerar UUID:', e);
      throw new Error('Erro ao gerar webhook secret');
    }

    // 4. Salvar no banco
    console.log('[CREATE-EVOLUTION-INSTANCE] Salvando no banco de dados');
    const insertData = {
      user_id: userId,
      organization_id: organizationId,
      api_url: normalizedUrl,
      api_key: apiKey,
      instance_name: instanceName,
      qr_code: qrCode,
      is_connected: false,
      webhook_enabled: true,
      webhook_secret: webhookSecret,
    };

    const { data: config, error: insertError } = await supabase
      .from('evolution_config')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao inserir no banco:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      
      // Tratar erros específicos
      if (insertError.code === '23505') { // Unique violation
        if (insertError.message?.includes('ux_evolution_config_instance_org')) {
          throw new Error(`Já existe uma instância com o nome "${instanceName}" nesta organização. Escolha outro nome.`);
        } else if (insertError.message?.includes('ux_evolution_config_webhook_secret')) {
          // Retry com novo UUID
          console.log('[CREATE-EVOLUTION-INSTANCE] Conflito de webhook_secret, tentando novamente...');
          insertData.webhook_secret = crypto.randomUUID();
          const { data: retryConfig, error: retryError } = await supabase
            .from('evolution_config')
            .insert(insertData)
            .select()
            .single();
          
          if (retryError) {
            throw new Error(`Erro ao salvar após retry: ${retryError.message}`);
          }
          
          console.log('[CREATE-EVOLUTION-INSTANCE] Configuração salva após retry');
          return new Response(
            JSON.stringify({
              success: true,
              config: retryConfig,
              qrCode: qrCode,
              instanceData: instanceData,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      throw insertError;
    }

    console.log('[CREATE-EVOLUTION-INSTANCE] Configuração salva com sucesso:', config?.id);

    // 5. Configurar webhook na Evolution (não crítico - pode falhar silenciosamente)
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?secret=${encodeURIComponent(webhookSecret)}`;
    console.log('[CREATE-EVOLUTION-INSTANCE] Configurando webhook na Evolution...');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      await fetch(`${normalizedUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: ['messages.upsert', 'connection.update', 'qrcode.updated'],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('[CREATE-EVOLUTION-INSTANCE] Webhook configurado com sucesso');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('[CREATE-EVOLUTION-INSTANCE] Timeout ao configurar webhook (não crítico)');
      } else {
        console.error('[CREATE-EVOLUTION-INSTANCE] Erro ao configurar webhook (não crítico):', e);
      }
      // Não é crítico - instância já foi criada e salva
    }

    return new Response(
      JSON.stringify({
        success: true,
        config: config,
        qrCode: qrCode,
        instanceData: instanceData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Garantir que sempre logamos o erro antes de retornar
    console.error('[CREATE-EVOLUTION-INSTANCE] ========== ERRO CAPTURADO ==========');
    console.error('[CREATE-EVOLUTION-INSTANCE] Tipo do erro:', typeof error);
    console.error('[CREATE-EVOLUTION-INSTANCE] Erro:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorDetails = error && typeof error === 'object' && 'code' in error 
      ? { code: (error as any).code, message: (error as any).message }
      : null;
    
    console.error('[CREATE-EVOLUTION-INSTANCE] Mensagem:', errorMessage);
    console.error('[CREATE-EVOLUTION-INSTANCE] Stack:', errorStack);
    console.error('[CREATE-EVOLUTION-INSTANCE] Detalhes:', errorDetails);
    console.error('[CREATE-EVOLUTION-INSTANCE] ====================================');
    
    // Sempre retornar uma resposta válida, mesmo em caso de erro
    try {
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          code: errorDetails?.code || undefined
        }),
        { 
          status: 500, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      );
    } catch (responseError) {
      // Se até retornar a resposta falhar, logar e retornar resposta mínima
      console.error('[CREATE-EVOLUTION-INSTANCE] ERRO CRÍTICO ao criar resposta:', responseError);
      return new Response(
        'Internal Server Error',
        { 
          status: 500, 
          headers: corsHeaders 
        }
      );
    }
  }
});
