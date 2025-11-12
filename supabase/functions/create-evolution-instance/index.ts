import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiUrl, apiKey, instanceName, organizationId, userId } = await req.json();

    if (!apiUrl || !apiKey || !instanceName || !organizationId || !userId) {
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalizar URL
    const normalizedUrl = apiUrl.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/, '');

    // 1. Criar instância via Evolution API
    const createResponse = await fetch(`${normalizedUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Erro ao criar instância Evolution:', errorText);
      throw new Error(`Erro ao criar instância: ${errorText}`);
    }

    const instanceData = await createResponse.json();
    console.log('✅ Instância criada:', instanceData);

    // 2. Buscar QR Code (aguardar alguns segundos para geração)
    let qrCode = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!qrCode && attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Aguardar 2s
        
        const qrResponse = await fetch(`${normalizedUrl}/instance/qrcode/${instanceName}`, {
          headers: { 'apikey': apiKey },
        });
        
        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          qrCode = qrData.qrcode || qrData.base64 || qrData.code || null;
          
          if (qrCode) {
            console.log('✅ QR Code obtido com sucesso');
            break;
          }
        }
        
        attempts++;
        console.log(`⏳ Tentativa ${attempts}/${maxAttempts} de obter QR Code...`);
      } catch (e) {
        console.error(`❌ Erro na tentativa ${attempts}:`, e);
        attempts++;
      }
    }
    
    if (!qrCode) {
      console.warn('⚠️ QR Code não foi gerado após várias tentativas');
    }

    // 3. Gerar webhook secret
    const webhookSecret = crypto.randomUUID();

    // 4. Salvar no banco
    const { data: config, error: insertError } = await supabase
      .from('evolution_config')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        api_url: normalizedUrl,
        api_key: apiKey,
        instance_name: instanceName,
        qr_code: qrCode,
        is_connected: false,
        webhook_enabled: true,
        webhook_secret: webhookSecret,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // 5. Configurar webhook na Evolution
    const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?secret=${encodeURIComponent(webhookSecret)}`;
    
    try {
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
      });
    } catch (e) {
      console.error('Erro ao configurar webhook:', e);
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
    console.error('Erro ao criar instância Evolution:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
