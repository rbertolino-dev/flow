import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    lifecyclestage?: string;
    hubspot_owner_id?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

interface HubSpotResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

// Mapear lifecycle stage do HubSpot para status do sistema
function mapLifecycleStageToStatus(lifecycleStage?: string): string {
  if (!lifecycleStage) return 'new';
  
  const mapping: Record<string, string> = {
    'subscriber': 'new',
    'lead': 'new',
    'marketingqualifiedlead': 'new',
    'salesqualifiedlead': 'contacted',
    'opportunity': 'qualified',
    'customer': 'won',
    'evangelist': 'won',
  };
  
  return mapping[lifecycleStage.toLowerCase()] || 'new';
}

// Normalizar telefone (remover caracteres não numéricos)
function normalizePhone(phone?: string): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, '');
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

    // Parse body com tratamento de erro
    // Valores padrão caso não haja body ou erro no parse
    let incremental = false;
    let limit = 100;
    
    try {
      // Tentar parsear body apenas se for POST e tiver Content-Type JSON
      if (req.method === 'POST') {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await req.json() as { incremental?: boolean; limit?: number };
          if (body) {
            incremental = body.incremental ?? false;
            limit = body.limit ?? 100;
          }
        }
      }
    } catch (error) {
      // Body vazio ou inválido, usar valores padrão
      console.log('⚠️ Body vazio ou inválido, usando valores padrão');
    }

    // Propriedades a buscar do HubSpot
    const properties = [
      'firstname',
      'lastname',
      'email',
      'phone',
      'company',
      'lifecyclestage',
      'hubspot_owner_id',
      'createdate',
      'lastmodifieddate',
    ].join(',');

    // Construir URL da API HubSpot
    const baseUrl = 'https://api.hubapi.com/crm/v3/objects/contacts';
    const params = new URLSearchParams({
      limit: Math.min(limit, 100).toString(),
      properties,
    });

    // Se sincronização incremental, usar endpoint de search para filtrar por data
    // Nota: Para sincronização incremental real, seria necessário usar o endpoint de search
    // Por enquanto, apenas limitamos a quantidade de resultados
    if (incremental && hubspotConfig.last_sync_at) {
      // Para sincronização incremental real, seria necessário usar:
      // POST /crm/v3/objects/contacts/search
      // Com filtro: { propertyName: "lastmodifieddate", operator: "GTE", value: timestamp }
      // Por enquanto, apenas limitamos resultados e ordenamos por última modificação
      params.append('associations', 'none');
      // Ordenar por última modificação (mais recentes primeiro)
      // Nota: A API v3 não suporta ordenação direta, então processaremos todos e filtraremos
    }

    let allContacts: HubSpotContact[] = [];
    let after: string | undefined;
    let pageCount = 0;
    const maxPages = 50; // Limite de segurança

    // Buscar contatos com paginação
    while (pageCount < maxPages) {
      pageCount++;
      const pageParams = new URLSearchParams(params);
      if (after) {
        pageParams.set('after', after);
      }

      const url = `${baseUrl}?${pageParams.toString()}`;
      console.log(`📡 Página ${pageCount}: Buscando contatos do HubSpot...`);

      const response = await fetch(url, {
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

      const data: HubSpotResponse = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Se sincronização incremental, filtrar por data de modificação
        let contactsToAdd = data.results;
        if (incremental && hubspotConfig.last_sync_at) {
          const lastSyncDate = new Date(hubspotConfig.last_sync_at);
          contactsToAdd = data.results.filter(contact => {
            const lastModified = contact.properties.lastmodifieddate 
              ? new Date(contact.properties.lastmodifieddate)
              : new Date(contact.updatedAt);
            return lastModified >= lastSyncDate;
          });
          console.log(`🔍 Filtrados ${contactsToAdd.length} de ${data.results.length} contatos modificados desde última sincronização`);
        }
        
        allContacts = allContacts.concat(contactsToAdd);
        console.log(`✅ ${contactsToAdd.length} contatos obtidos (total: ${allContacts.length})`);
      }

      // Verificar se há mais páginas
      if (data.paging?.next?.after) {
        after = data.paging.next.after;
      } else {
        break;
      }

      // Rate limiting: aguardar um pouco entre requisições
      if (pageCount < maxPages && after) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ Total de ${allContacts.length} contatos obtidos do HubSpot`);

    // Processar contatos
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const contact of allContacts) {
      try {
        const props = contact.properties;
        
        // Construir nome completo
        const firstName = props.firstname || '';
        const lastName = props.lastname || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Sem Nome';
        
        // Normalizar telefone e email
        const phone = normalizePhone(props.phone);
        const email = props.email?.toLowerCase().trim() || null;

        // Validar campos obrigatórios
        if (!phone && !email) {
          skipped++;
          errors.push(`Contato ${contact.id} sem telefone ou email`);
          continue;
        }

        // Mapear dados
        const leadData: any = {
          organization_id: organizationId,
          user_id: user.id,
          name: fullName,
          email: email,
          phone: phone || '00000000000', // Telefone temporário se não houver
          company: props.company || null,
          status: mapLifecycleStageToStatus(props.lifecyclestage),
          source: 'hubspot',
          assigned_to: props.hubspot_owner_id || null,
        };

        // Verificar se lead já existe (por email ou telefone)
        let existingLead: any = null;
        
        if (email) {
          const { data: leadByEmail } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('email', email)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (leadByEmail) {
            existingLead = leadByEmail;
          }
        }

        if (!existingLead && phone) {
          const { data: leadByPhone } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('phone', phone)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (leadByPhone) {
            existingLead = leadByPhone;
          }
        }

        if (existingLead) {
          // Atualizar lead existente
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              name: leadData.name,
              email: leadData.email,
              company: leadData.company,
              status: leadData.status,
              assigned_to: leadData.assigned_to,
              updated_at: new Date().toISOString(),
              updated_by: user.id,
            })
            .eq('id', existingLead.id);

          if (updateError) {
            errors.push(`Erro ao atualizar lead ${existingLead.id}: ${updateError.message}`);
          } else {
            updated++;
            
            // Atualizar registro de sincronização
            await supabase
              .from('hubspot_contact_sync')
              .upsert({
                organization_id: organizationId,
                hubspot_contact_id: contact.id,
                lead_id: existingLead.id,
                last_synced_at: new Date().toISOString(),
                sync_status: 'success',
                metadata: { updated: true },
              }, {
                onConflict: 'organization_id,hubspot_contact_id',
              });
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
              email: leadData.email,
              company: leadData.company,
              status: leadData.status,
              source: 'hubspot',
              assigned_to: leadData.assigned_to,
              created_by: user.id,
              updated_by: user.id,
            })
            .select('id')
            .single();

          if (insertError) {
            errors.push(`Erro ao criar lead: ${insertError.message}`);
            skipped++;
          } else {
            created++;
            
            // Criar registro de sincronização
            await supabase
              .from('hubspot_contact_sync')
              .insert({
                organization_id: organizationId,
                hubspot_contact_id: contact.id,
                lead_id: newLead.id,
                last_synced_at: new Date().toISOString(),
                sync_status: 'success',
                metadata: { created: true },
              });
          }
        }
      } catch (error: any) {
        errors.push(`Erro ao processar contato ${contact.id}: ${error.message}`);
        skipped++;
      }
    }

    // Atualizar last_sync_at
    await supabase
      .from('hubspot_configs')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', hubspotConfig.id);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_found: allContacts.length,
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

