import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotContact {
  vid: number;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    lifecyclestage?: string;
    [key: string]: any;
  };
}

interface HubSpotListContactsResponse {
  contacts: HubSpotContact[];
  'has-more': boolean;
  'vid-offset'?: number;
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

    // Parse body
    const body = await req.json() as {
      list_id: string;
      vid_offset?: number;
      count?: number;
      properties?: string[];
    };

    if (!body.list_id) {
      throw new Error('list_id é obrigatório');
    }

    const listId = body.list_id;
    const vidOffset = body.vid_offset || 0;
    const count = Math.min(body.count || 100, 100); // Máximo 100 por requisição
    const properties = body.properties || [
      'firstname',
      'lastname',
      'email',
      'phone',
      'company',
      'lifecyclestage',
    ];

    // Buscar contatos da lista
    // API v1: /contacts/v1/lists/{listId}/contacts/all
    const contactsUrl = `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all?vidOffset=${vidOffset}&count=${count}&property=${properties.join('&property=')}`;
    
    const response = await fetch(contactsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hubspotConfig.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro HubSpot API (${response.status}):`, errorText);
      throw new Error(`Erro HubSpot API: ${response.status} - ${errorText}`);
    }

    const data: HubSpotListContactsResponse = await response.json();

    // Formatar contatos - extrair valores das propriedades (HubSpot v1 retorna { value: "...", versions: [...] })
    const formattedContacts = (data.contacts || []).map(contact => {
      const extractedProps: Record<string, any> = {};
      if (contact.properties) {
        for (const [key, propData] of Object.entries(contact.properties)) {
          extractedProps[key] = (propData as any)?.value || null;
        }
      }
      return {
        id: contact.vid.toString(),
        properties: extractedProps,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        contacts: formattedContacts,
        has_more: data['has-more'] || false,
        vid_offset: data['vid-offset'] || vidOffset,
        total: formattedContacts.length,
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


