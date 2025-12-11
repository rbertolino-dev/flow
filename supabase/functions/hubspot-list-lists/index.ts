import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotList {
  listId: number;
  name: string;
  size: number;
  dynamic: boolean;
  createdAt: number;
  updatedAt: number;
  portalId: number;
  filters?: any[];
}

interface HubSpotListsResponse {
  lists: HubSpotList[];
  'has-more': boolean;
  'offset'?: number;
}

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

    // Parse body para filtros opcionais
    let offset = 0;
    let count = 250; // Máximo permitido pela API
    try {
      if (req.method === 'POST') {
        const body = await req.json() as { offset?: number; count?: number };
        if (body) {
          offset = body.offset ?? 0;
          count = Math.min(body.count ?? 250, 250);
        }
      }
    } catch {
      // Body vazio, usar valores padrão
    }

    // Buscar listas do HubSpot
    // API v1: /contacts/v1/lists
    const listsUrl = `https://api.hubapi.com/contacts/v1/lists?offset=${offset}&count=${count}`;
    
    const response = await fetch(listsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotConfig.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro HubSpot API (${response.status}):`, errorText);
      
      // Parse error for better messaging
      let friendlyError = '';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.category === 'EXPIRED_AUTHENTICATION' || response.status === 401) {
          friendlyError = 'Token HubSpot expirado ou inválido. Por favor, gere um novo Access Token no Portal do Desenvolvedor HubSpot (Settings → Integrations → Private Apps) e atualize a configuração.';
        }
      } catch {
        // If can't parse, continue with generic message
      }
      
      throw new Error(friendlyError || `Erro HubSpot API: ${response.status} - ${errorText}`);
    }

    const data: HubSpotListsResponse = await response.json();

    // Formatar resposta
    const formattedLists = (data.lists || []).map(list => ({
      id: list.listId.toString(),
      name: list.name,
      size: list.size,
      dynamic: list.dynamic,
      created_at: new Date(list.createdAt).toISOString(),
      updated_at: new Date(list.updatedAt).toISOString(),
      portal_id: list.portalId,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        lists: formattedLists,
        has_more: data['has-more'] || false,
        offset: data.offset || offset,
        total: formattedLists.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


