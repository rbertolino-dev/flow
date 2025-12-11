import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FieldMapping {
  hubspot_field: string;
  system_field: string;
  default_value?: any;
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

// Normalizar telefone
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

    // Parse body
    const body = await req.json() as {
      list_id: string;
      list_name: string;
      field_mappings: FieldMapping[];
      import_to: 'crm' | 'campaign_list' | 'both';
      campaign_list_id?: string;
      campaign_list_name?: string;
    };

    if (!body.list_id || !body.list_name || !body.field_mappings) {
      throw new Error('list_id, list_name e field_mappings são obrigatórios');
    }

    // Propriedades a buscar do HubSpot
    const propertiesToFetch = [
      'firstname',
      'lastname', 
      'email',
      'phone',
      'mobilephone',
      'company',
      'lifecyclestage',
      'jobtitle',
      'website',
      'city',
      'state',
      'country',
    ];

    // Buscar todos os contatos da lista (com paginação)
    let allContacts: any[] = [];
    let vidOffset = 0;
    const count = 100;

    while (true) {
      // IMPORTANTE: Adicionar properties na URL para obter os dados dos contatos
      const propertiesParam = propertiesToFetch.map(p => `property=${p}`).join('&');
      const contactsUrl = `https://api.hubapi.com/contacts/v1/lists/${body.list_id}/contacts/all?vidOffset=${vidOffset}&count=${count}&${propertiesParam}`;
      
      console.log(`🔍 Buscando contatos: offset=${vidOffset}, count=${count}`);
      
      const response = await fetch(contactsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hubspotConfig.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro ao buscar contatos: ${response.status} - ${errorText}`);
        throw new Error(`Erro ao buscar contatos: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`📦 Recebidos ${data.contacts?.length || 0} contatos nesta página`);
      
      if (data.contacts && data.contacts.length > 0) {
        // Extrair valores das propriedades (HubSpot retorna properties.propertyName.value)
        const processedContacts = data.contacts.map((contact: any) => {
          const properties: Record<string, any> = {};
          if (contact.properties) {
            for (const [key, propData] of Object.entries(contact.properties)) {
              // A API v1 retorna { value: "...", versions: [...] }
              properties[key] = (propData as any)?.value || null;
            }
          }
          return {
            vid: contact.vid,
            properties,
          };
        });
        allContacts = allContacts.concat(processedContacts);
      }

      if (!data['has-more']) {
        break;
      }

      vidOffset = data['vid-offset'] || (vidOffset + count);
    }

    console.log(`✅ Total de ${allContacts.length} contatos obtidos da lista`);

    // Processar contatos
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const contactsForList: any[] = [];

    for (const contact of allContacts) {
      try {
        const props = contact.properties || {};
        
        // Aplicar mapeamentos
        const mappedData: any = {
          organization_id: organizationId,
          user_id: user.id,
          source: 'hubspot',
        };

        for (const mapping of body.field_mappings) {
          const hubspotValue = props[mapping.hubspot_field];
          const value = hubspotValue !== undefined && hubspotValue !== null 
            ? hubspotValue 
            : mapping.default_value;

          if (value !== undefined && value !== null) {
            mappedData[mapping.system_field] = value;
          }
        }

        // Validações
        if (!mappedData.name) {
          // Tentar construir nome se não mapeado
          const firstName = props.firstname || '';
          const lastName = props.lastname || '';
          mappedData.name = `${firstName} ${lastName}`.trim() || 'Sem Nome';
        }

        if (!mappedData.phone && !mappedData.email) {
          skipped++;
          errors.push(`Contato ${contact.vid} sem telefone ou email`);
          continue;
        }

        // Normalizar telefone
        if (mappedData.phone) {
          mappedData.phone = normalizePhone(mappedData.phone) || '00000000000';
        }

        // Mapear status se não mapeado
        if (!mappedData.status && props.lifecyclestage) {
          mappedData.status = mapLifecycleStageToStatus(props.lifecyclestage);
        }

        // Verificar se lead já existe
        let existingLead: any = null;
        
        if (mappedData.email) {
          const { data: leadByEmail } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('email', mappedData.email)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (leadByEmail) {
            existingLead = leadByEmail;
          }
        }

        if (!existingLead && mappedData.phone) {
          const { data: leadByPhone } = await supabase
            .from('leads')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('phone', mappedData.phone)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (leadByPhone) {
            existingLead = leadByPhone;
          }
        }

        // Importar para CRM se solicitado
        if (body.import_to === 'crm' || body.import_to === 'both') {
          if (existingLead) {
            // Atualizar lead existente
            const { error: updateError } = await supabase
              .from('leads')
              .update({
                name: mappedData.name,
                email: mappedData.email,
                company: mappedData.company,
                status: mappedData.status || 'new',
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
                name: mappedData.name,
                phone: mappedData.phone,
                email: mappedData.email,
                company: mappedData.company,
                status: mappedData.status || 'new',
                source: 'hubspot',
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
              existingLead = { id: newLead.id };
            }
          }
        }

        // Preparar para lista de campanha
        if (body.import_to === 'campaign_list' || body.import_to === 'both') {
          contactsForList.push({
            lead_id: existingLead?.id || null,
            phone: mappedData.phone,
            name: mappedData.name,
            variables: {},
          });
        }

      } catch (error: any) {
        errors.push(`Erro ao processar contato ${contact.vid}: ${error.message}`);
        skipped++;
      }
    }

    // Criar/atualizar lista de campanha se solicitado
    let listId: string | null = null;
    if ((body.import_to === 'campaign_list' || body.import_to === 'both') && contactsForList.length > 0) {
      if (body.campaign_list_id) {
        // Atualizar lista existente
        const { data: existingList } = await supabase
          .from('whatsapp_workflow_lists')
          .select('contacts')
          .eq('id', body.campaign_list_id)
          .single();

        if (existingList) {
          const existingContacts = Array.isArray(existingList.contacts) ? existingList.contacts : [];
          const existingPhones = new Set(existingContacts.map((c: any) => c.phone));
          
          const newContacts = contactsForList.filter(c => !existingPhones.has(c.phone));
          const updatedContacts = [...existingContacts, ...newContacts];

          await supabase
            .from('whatsapp_workflow_lists')
            .update({ contacts: updatedContacts })
            .eq('id', body.campaign_list_id);

          listId = body.campaign_list_id;
        }
      } else if (body.campaign_list_name) {
        // Criar nova lista
        const { data: newList, error: listError } = await supabase
          .from('whatsapp_workflow_lists')
          .insert({
            organization_id: organizationId,
            name: body.campaign_list_name,
            description: `Importada do HubSpot: ${body.list_name}`,
            contacts: contactsForList,
            list_type: 'list',
          })
          .select('id')
          .single();

        if (listError) {
          errors.push(`Erro ao criar lista: ${listError.message}`);
        } else {
          listId = newList.id;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_found: allContacts.length,
          created,
          updated,
          skipped,
          errors: errors.length,
          added_to_list: contactsForList.length,
        },
        list_id: listId,
        errors: errors.slice(0, 10),
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


