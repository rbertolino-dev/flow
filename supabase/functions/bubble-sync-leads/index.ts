import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FieldMapping {
  bubble_field: string;  // Campo no Bubble
  lead_field: string;    // Campo no sistema (name, phone, email, company, value, etc.)
  default_value?: any;    // Valor padrão se o campo estiver vazio
}

interface SyncConfig {
  endpoint: string;              // Tabela do Bubble (ex: "cliente", "lead", "contato")
  field_mappings: FieldMapping[]; // Mapeamento de campos
  constraints?: any[];            // Filtros para buscar apenas leads novos/atualizados
  auto_sync?: boolean;            // Sincronização automática
  last_sync_at?: string;          // Última sincronização
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

    // Buscar configuração Bubble
    const { data: bubbleConfig } = await supabase
      .from('bubble_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!bubbleConfig) {
      throw new Error('Configure a API Bubble.io primeiro');
    }

    const { sync_config, dry_run = false } = await req.json() as { 
      sync_config: SyncConfig; 
      dry_run?: boolean;
    };

    if (!sync_config || !sync_config.endpoint || !sync_config.field_mappings) {
      throw new Error('Configuração de sincronização inválida');
    }

    // Construir URL do Bubble
    let bubbleUrl = bubbleConfig.api_url;
    if (bubbleUrl.endsWith('/')) {
      bubbleUrl = bubbleUrl.slice(0, -1);
    }
    bubbleUrl = `${bubbleUrl}/${sync_config.endpoint}`;
    
    console.log('📡 URL do Bubble construída:', bubbleUrl);
    console.log('📋 Endpoint solicitado:', sync_config.endpoint);

    // Adicionar constraints se houver
    const params = new URLSearchParams();
    if (sync_config.constraints && sync_config.constraints.length > 0) {
      params.append('constraints', JSON.stringify(sync_config.constraints));
    }

    // Se houver last_sync_at, adicionar filtro de data
    if (sync_config.last_sync_at) {
      const dateConstraints = [
        {
          key: 'Modified Date',
          constraint_type: 'greater than',
          value: sync_config.last_sync_at
        }
      ];
      params.append('constraints', JSON.stringify(dateConstraints));
    }

    // Buscar dados do Bubble com paginação
    let allBubbleLeads: any[] = [];
    let cursor = 0;
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && pageCount < 50) { // Limite de 50 páginas
      pageCount++;
      const pageParams = new URLSearchParams(params);
      if (cursor > 0) {
        pageParams.append('cursor', cursor.toString());
      }
      pageParams.append('limit', '100');

      const pageUrl = `${bubbleUrl}?${pageParams.toString()}`;
      
      console.log(`🔍 Página ${pageCount}: Buscando leads do Bubble em ${pageUrl}`);
      
      const pageResponse = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bubbleConfig.api_key}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pageResponse.ok) {
        const errorText = await pageResponse.text();
        console.error(`❌ Erro Bubble API (${pageResponse.status}):`, errorText);
        throw new Error(`Erro Bubble API: ${pageResponse.status} - ${errorText}`);
      }

      const pageData = await pageResponse.json();
      
      if (pageData.response?.results) {
        allBubbleLeads = allBubbleLeads.concat(pageData.response.results);
      }

      if (pageData.response?.remaining > 0) {
        cursor = pageData.response.cursor || (cursor + 100);
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Total de ${allBubbleLeads.length} registros obtidos do Bubble`);

    // Mapear e processar leads
    const processedLeads: any[] = [];
    const errors: string[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const bubbleLead of allBubbleLeads) {
      try {
        // Mapear campos do Bubble para campos de Lead
        const leadData: any = {
          organization_id: organizationId,
          user_id: user.id,
          source: 'bubble_erp',
        };

        // Aplicar mapeamentos
        for (const mapping of sync_config.field_mappings) {
          const bubbleValue = bubbleLead[mapping.bubble_field];
          const value = bubbleValue !== undefined && bubbleValue !== null 
            ? bubbleValue 
            : mapping.default_value;

          if (value !== undefined && value !== null) {
            leadData[mapping.lead_field] = value;
          }
        }

        // Validar campos obrigatórios
        if (!leadData.name || !leadData.phone) {
          skipped++;
          errors.push(`Lead sem nome ou telefone: ${JSON.stringify(bubbleLead)}`);
          continue;
        }

        // Normalizar telefone (remover caracteres não numéricos)
        if (leadData.phone) {
          leadData.phone = leadData.phone.toString().replace(/\D/g, '');
        }

        if (dry_run) {
          processedLeads.push(leadData);
          continue;
        }

        // Verificar se lead já existe (por telefone na organização)
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('phone', leadData.phone)
          .is('deleted_at', null)
          .maybeSingle();

        if (existingLead) {
          // Atualizar lead existente
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              name: leadData.name,
              email: leadData.email || null,
              company: leadData.company || null,
              value: leadData.value || null,
              notes: leadData.notes || null,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            })
            .eq('id', existingLead.id);

          if (updateError) {
            errors.push(`Erro ao atualizar lead ${existingLead.id}: ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Criar novo lead
          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              organization_id: organizationId,
              user_id: user.id,
              name: leadData.name,
              phone: leadData.phone,
              email: leadData.email || null,
              company: leadData.company || null,
              value: leadData.value || null,
              source: 'bubble_erp',
              status: 'new',
              notes: leadData.notes || null,
              created_by: user.id,
              updated_by: user.id,
            })
            .select('id')
            .single();

          if (insertError) {
            errors.push(`Erro ao criar lead: ${insertError.message}`);
          } else {
            created++;
            // Os Fluxos de Automação serão acionados automaticamente via Realtime
            // quando o lead for inserido na tabela
          }
        }

        processedLeads.push(leadData);
      } catch (error: any) {
        errors.push(`Erro ao processar lead: ${error.message}`);
        skipped++;
      }
    }

    // Atualizar last_sync_at se não for dry_run
    if (!dry_run && processedLeads.length > 0) {
      // Salvar configuração de sincronização (se houver tabela para isso)
      // Por enquanto, apenas retornamos o timestamp
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run,
        stats: {
          total_found: allBubbleLeads.length,
          processed: processedLeads.length,
          created,
          updated,
          skipped,
          errors: errors.length,
        },
        errors: errors.slice(0, 10), // Limitar a 10 erros
        last_sync_at: new Date().toISOString(),
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

