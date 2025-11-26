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
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!orgMembers) {
      throw new Error('Usuário não pertence a nenhuma organização');
    }

    const organizationId = orgMembers.organization_id;

    // Buscar configuração Bubble
    const { data: bubbleConfig } = await supabase
      .from('bubble_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!bubbleConfig) {
      throw new Error('Configure a API Bubble.io primeiro');
    }

    // Buscar Data Types do Bubble via API Meta
    let apiUrl = bubbleConfig.api_url;
    if (apiUrl.endsWith('/obj')) {
      apiUrl = apiUrl.replace('/obj', '/meta');
    } else if (apiUrl.endsWith('/')) {
      apiUrl = `${apiUrl}meta`;
    } else {
      apiUrl = `${apiUrl}/meta`;
    }

    console.log('📡 Buscando Data Types em:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bubbleConfig.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro Bubble API: ${response.status} - ${errorText}`);
    }

    const metaData = await response.json();
    
    // Extrair Data Types
    const dataTypes: { name: string; fields: { name: string; type: string }[] }[] = [];
    
    if (metaData.types && typeof metaData.types === 'object') {
      for (const [typeName, typeInfo] of Object.entries(metaData.types)) {
        const fields: { name: string; type: string }[] = [];
        
        if (typeInfo && typeof typeInfo === 'object' && 'fields' in typeInfo) {
          const typeFields = (typeInfo as any).fields;
          if (typeFields && typeof typeFields === 'object') {
            for (const [fieldName, fieldInfo] of Object.entries(typeFields)) {
              fields.push({
                name: fieldName,
                type: (fieldInfo as any)?.type || 'text'
              });
            }
          }
        }
        
        dataTypes.push({
          name: typeName,
          fields
        });
      }
    }

    console.log(`✅ Encontrados ${dataTypes.length} Data Types`);

    return new Response(
      JSON.stringify({
        success: true,
        data_types: dataTypes
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
