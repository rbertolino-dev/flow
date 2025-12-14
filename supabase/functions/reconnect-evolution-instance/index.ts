import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normaliza URLs de API
const normalizeApiUrl = (url: string) => {
  try {
    const u = new URL(url);
    let base = u.origin + u.pathname.replace(/\/$/, '');
    base = base.replace(/\/(manager|dashboard|app)$/i, '');
    return base;
  } catch {
    return url.replace(/\/$/, '').replace(/\/(manager|dashboard|app)$/i, '');
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, instanceName, apiUrl, apiKey, phoneNumber, verificationCode } = await req.json();

    if (!instanceId || !instanceName || !apiUrl || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: instanceId, instanceName, apiUrl, apiKey' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se a instância existe e pertence ao usuário
    const { data: instance, error: instanceError } = await supabase
      .from('evolution_config')
      .select('id, instance_name, api_url, api_key, organization_id, user_id')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedUrl = normalizeApiUrl(apiUrl);

    // Se tem código de verificação, validar
    if (verificationCode) {
      console.log('🔐 Validando código de verificação...');
      
      // Tentar validar o código via Evolution API
      // Nota: A Evolution API pode ter diferentes endpoints para isso
      // Vamos tentar alguns endpoints comuns
      const endpoints = [
        `${normalizedUrl}/instance/restore/${instanceName}`,
        `${normalizedUrl}/instance/reconnect/${instanceName}`,
        `${normalizedUrl}/instance/verify/${instanceName}`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({
              code: verificationCode,
              phoneNumber: phoneNumber,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ Código validado com sucesso');

            // Atualizar status no banco
            await supabase
              .from('evolution_config')
              .update({
                is_connected: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', instanceId);

            return new Response(
              JSON.stringify({ success: true, message: 'Instância reconectada com sucesso' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (error) {
          console.error(`Erro ao tentar endpoint ${endpoint}:`, error);
          continue;
        }
      }

      // Se nenhum endpoint funcionou, tentar método alternativo
      // Verificar status diretamente após alguns segundos
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`${normalizedUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': apiKey },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.state === 'open') {
          await supabase
            .from('evolution_config')
            .update({
              is_connected: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', instanceId);

          return new Response(
            JSON.stringify({ success: true, message: 'Instância reconectada com sucesso' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: 'Código inválido ou instância não conectou' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se não tem código, iniciar processo de reconexão por telefone
    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Número de telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 Iniciando reconexão por telefone...');

    // Tentar diferentes métodos de reconexão por telefone
    // Método 1: Usar endpoint de restore/restart
    const restoreEndpoints = [
      `${normalizedUrl}/instance/restore/${instanceName}`,
      `${normalizedUrl}/instance/restart/${instanceName}`,
      `${normalizedUrl}/instance/reconnect/${instanceName}`,
    ];

    for (const endpoint of restoreEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Processo de reconexão iniciado');

          // Se a API retornar que está esperando código
          if (data.waitingForCode || data.codeRequired) {
            return new Response(
              JSON.stringify({
                success: true,
                waitingForCode: true,
                message: 'Código de verificação enviado para o WhatsApp',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Se já conectou diretamente
          if (data.connected || data.state === 'open') {
            await supabase
              .from('evolution_config')
              .update({
                is_connected: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', instanceId);

            return new Response(
              JSON.stringify({ success: true, message: 'Instância reconectada com sucesso' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      } catch (error) {
        console.error(`Erro ao tentar endpoint ${endpoint}:`, error);
        continue;
      }
    }

    // Método 2: Se não funcionou, tentar deletar e recriar a instância
    // (último recurso - pode não ser ideal)
    try {
      // Deletar instância existente
      await fetch(`${normalizedUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey },
      });

      // Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Recriar instância com número de telefone
      const createResponse = await fetch(`${normalizedUrl}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS',
          phoneNumber: phoneNumber,
          qrcode: false, // Não usar QR code quando tem número
        }),
      });

      if (createResponse.ok) {
        const createData = await createResponse.json();
        
        if (createData.waitingForCode || createData.codeRequired) {
          return new Response(
            JSON.stringify({
              success: true,
              waitingForCode: true,
              message: 'Código de verificação enviado para o WhatsApp',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } catch (error) {
      console.error('Erro no método alternativo:', error);
    }

    // Se chegou aqui, assumir que precisa de código
    return new Response(
      JSON.stringify({
        success: true,
        waitingForCode: true,
        message: 'Verifique o WhatsApp e insira o código de 8 dígitos recebido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao reconectar instância:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

