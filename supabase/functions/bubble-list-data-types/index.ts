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
    
    console.log('📦 Número de data types em metaData.get:', metaData.get?.length || 0);
    console.log('📦 Lista de data types:', metaData.get);
    
    // Verificar se existe informação sobre mais data types no objeto types
    if (metaData.types) {
      const typesKeys = Object.keys(metaData.types);
      console.log('📦 Data types encontrados em metaData.types:', typesKeys.length);
      console.log('📦 Lista completa de types:', typesKeys);
      
      // Se houver mais types do que no get, adicionar eles
      for (const typeName of typesKeys) {
        if (!metaData.get.includes(typeName)) {
          console.log(`➕ Adicionando ${typeName} que estava em types mas não em get`);
          metaData.get.push(typeName);
        }
      }
    }
    
    // Extrair Data Types do formato do Bubble
    const dataTypes: { name: string; fields: { name: string; type: string }[] }[] = [];
    
    // O Bubble retorna um objeto com "get" (array de nomes de data types)
    if (metaData.get && Array.isArray(metaData.get)) {
      // Adicionar cada data type da lista "get"
      for (const typeName of metaData.get) {
        // Buscar os campos fazendo uma chamada à API de dados desse tipo
        const fields: { name: string; type: string }[] = [];
        
        try {
          // Fazer uma requisição GET para obter um item de exemplo e extrair os campos
          const dataUrl = `${bubbleConfig.api_url}/${typeName}?limit=1`;
          console.log(`🔍 Buscando campos de ${typeName} em:`, dataUrl);
          
          const dataResponse = await fetch(dataUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${bubbleConfig.api_key}`,
              'Content-Type': 'application/json',
            },
          });

          if (dataResponse.ok) {
            const dataResult = await dataResponse.json();
            console.log(`✅ Resposta de ${typeName}:`, dataResult);
            
            // O Bubble retorna { response: { results: [...] } }
            if (dataResult.response?.results && dataResult.response.results.length > 0) {
              const sampleItem = dataResult.response.results[0];
              // Extrair os campos do item de exemplo
              for (const [fieldName, fieldValue] of Object.entries(sampleItem)) {
                // Ignorar campos internos do Bubble
                if (!fieldName.startsWith('_')) {
                  let fieldType = 'text';
                  if (typeof fieldValue === 'number') fieldType = 'number';
                  else if (typeof fieldValue === 'boolean') fieldType = 'boolean';
                  else if (fieldValue && typeof fieldValue === 'object' && fieldValue.constructor === Array) fieldType = 'list';
                  
                  fields.push({
                    name: fieldName,
                    type: fieldType
                  });
                }
              }
            }
          } else {
            console.log(`⚠️ Não foi possível buscar dados de ${typeName}: ${dataResponse.status}`);
          }
        } catch (error) {
          console.log(`⚠️ Erro ao buscar campos de ${typeName}:`, error);
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
