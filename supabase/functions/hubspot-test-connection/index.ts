import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Buscar organização do usuário
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!orgMembers) {
      throw new Error('Usuário não pertence a nenhuma organização');
    }

    const organizationId = orgMembers.organization_id;

    // Buscar configuração HubSpot
    const { data: hubspotConfig, error: configError } = await supabase
      .from('hubspot_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !hubspotConfig) {
      throw new Error('Configuração HubSpot não encontrada ou inativa');
    }

    // Testar conexão fazendo uma requisição simples à API
    const testUrl = 'https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=firstname,lastname,email';
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotConfig.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Parse error for better messaging
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.category === 'EXPIRED_AUTHENTICATION') {
          throw new Error('Token HubSpot expirado ou inválido. Por favor, gere um novo Access Token no Portal do Desenvolvedor HubSpot e atualize a configuração.');
        }
        if (response.status === 401) {
          throw new Error('Token HubSpot inválido. Verifique se o Access Token está correto e possui as permissões necessárias (crm.objects.contacts.read).');
        }
      } catch (parseError) {
        // If can't parse, use generic message
      }
      
      throw new Error(`Erro na conexão: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Buscar informações do portal (opcional)
    // Nota: O endpoint correto para informações do portal é /integrations/v1/me
    // Mas pode não estar disponível em todos os tipos de token
    let portalInfo = null;
    try {
      // Tentar endpoint v1 (pode não estar disponível para private apps)
      const portalUrl = 'https://api.hubapi.com/integrations/v1/me';
      const portalResponse = await fetch(portalUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hubspotConfig.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (portalResponse.ok) {
        portalInfo = await portalResponse.json();
      } else {
        // Se falhar, tentar obter portal_id do primeiro contato (se houver)
        if (data.results && data.results.length > 0) {
          portalInfo = { 
            portal_id: hubspotConfig.portal_id || 'N/A',
            note: 'Informações limitadas - endpoint v1 não disponível para este tipo de token'
          };
        }
      }
    } catch (error) {
      console.log('Não foi possível obter informações do portal:', error);
      // Usar portal_id da configuração se disponível
      if (hubspotConfig.portal_id) {
        portalInfo = { portal_id: hubspotConfig.portal_id };
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        connected: true,
        message: 'Conexão com HubSpot estabelecida com sucesso',
        portal_info: portalInfo,
        contacts_accessible: data.results ? true : false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        error: error.message,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

