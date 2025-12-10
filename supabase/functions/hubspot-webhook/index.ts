import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotWebhookEvent {
  subscriptionId: number;
  portalId: number;
  occurredAt: number;
  subscriptionType: string;
  eventId: string;
  objectId: number;
  properties?: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
    lifecyclestage?: string;
    [key: string]: any;
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

    // Validar Content-Type
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type deve ser application/json' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // HubSpot envia eventos em array
    let events: HubSpotWebhookEvent[] = [];
    try {
      const text = await req.text();
      if (!text || text.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Corpo da requisição vazio' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      events = JSON.parse(text);
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: `Erro ao parsear JSON: ${error.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(events) || events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum evento recebido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 Recebidos ${events.length} eventos do HubSpot`);

    const results = [];

    for (const event of events) {
      try {
        const { subscriptionType, objectId, properties, portalId } = event;

        // Processar apenas eventos de contatos
        if (!subscriptionType.startsWith('contact.')) {
          console.log(`⏭️  Ignorando evento: ${subscriptionType}`);
          continue;
        }

        // Buscar configuração HubSpot pelo portal_id
        const { data: hubspotConfig } = await supabase
          .from('hubspot_configs')
          .select('*, organization_id')
          .eq('portal_id', portalId.toString())
          .eq('is_active', true)
          .maybeSingle();

        if (!hubspotConfig) {
          console.log(`⚠️  Configuração HubSpot não encontrada para portal ${portalId}`);
          continue;
        }

        const organizationId = hubspotConfig.organization_id;

        // Buscar contato completo do HubSpot
        const contactUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${objectId}?properties=firstname,lastname,email,phone,company,lifecyclestage,hubspot_owner_id`;
        
        const contactResponse = await fetch(contactUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${hubspotConfig.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!contactResponse.ok) {
          console.error(`❌ Erro ao buscar contato ${objectId}: ${contactResponse.status}`);
          continue;
        }

        const contactData = await contactResponse.json();
        const contactProps = contactData.properties || properties || {};

        // Construir dados do lead
        const firstName = contactProps.firstname || '';
        const lastName = contactProps.lastname || '';
        const fullName = `${firstName} ${lastName}`.trim() || 'Sem Nome';
        const phone = normalizePhone(contactProps.phone);
        const email = contactProps.email?.toLowerCase().trim() || null;

        if (!phone && !email) {
          console.log(`⏭️  Contato ${objectId} sem telefone ou email, ignorando`);
          continue;
        }

        // Verificar se lead já existe
        let existingLead: any = null;
        
        if (email) {
          const { data: leadByEmail } = await supabase
            .from('leads')
            .select('id, user_id')
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
            .select('id, user_id')
            .eq('organization_id', organizationId)
            .eq('phone', phone)
            .is('deleted_at', null)
            .maybeSingle();
          
          if (leadByPhone) {
            existingLead = leadByPhone;
          }
        }

        if (subscriptionType === 'contact.deletion' || subscriptionType === 'contact.privacyDeletion') {
          // Se contato foi deletado no HubSpot, marcar como deletado no sistema (opcional)
          if (existingLead) {
            // Você pode optar por deletar ou apenas marcar
            console.log(`🗑️  Contato ${objectId} deletado no HubSpot`);
          }
          continue;
        }

        if (existingLead) {
          // Atualizar lead existente
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              name: fullName,
              email: email,
              company: contactProps.company || null,
              status: mapLifecycleStageToStatus(contactProps.lifecyclestage),
              assigned_to: contactProps.hubspot_owner_id || null,
              updated_at: new Date().toISOString(),
              updated_by: existingLead.user_id,
            })
            .eq('id', existingLead.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar lead: ${updateError.message}`);
          } else {
            // Atualizar registro de sincronização
            await supabase
              .from('hubspot_contact_sync')
              .upsert({
                organization_id: organizationId,
                hubspot_contact_id: objectId.toString(),
                lead_id: existingLead.id,
                last_synced_at: new Date().toISOString(),
                sync_status: 'success',
                metadata: { webhook: true, event: subscriptionType },
              }, {
                onConflict: 'organization_id,hubspot_contact_id',
              });

            results.push({ action: 'updated', contactId: objectId, leadId: existingLead.id });
          }
        } else {
          // Criar novo lead
          // Buscar primeiro usuário da organização
          const { data: orgMember } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organizationId)
            .limit(1)
            .single();

          if (!orgMember) {
            console.error(`❌ Nenhum membro encontrado na organização ${organizationId}`);
            continue;
          }

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              organization_id: organizationId,
              user_id: orgMember.user_id,
              name: fullName,
              phone: phone || '00000000000',
              email: email,
              company: contactProps.company || null,
              status: mapLifecycleStageToStatus(contactProps.lifecyclestage),
              source: 'hubspot',
              assigned_to: contactProps.hubspot_owner_id || null,
              created_by: orgMember.user_id,
              updated_by: orgMember.user_id,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`❌ Erro ao criar lead: ${insertError.message}`);
          } else {
            // Criar registro de sincronização
            await supabase
              .from('hubspot_contact_sync')
              .insert({
                organization_id: organizationId,
                hubspot_contact_id: objectId.toString(),
                lead_id: newLead.id,
                last_synced_at: new Date().toISOString(),
                sync_status: 'success',
                metadata: { webhook: true, event: subscriptionType },
              });

            results.push({ action: 'created', contactId: objectId, leadId: newLead.id });
          }
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar evento: ${error.message}`);
        results.push({ action: 'error', error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
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

