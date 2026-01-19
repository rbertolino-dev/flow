import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Service role client para operações que não dependem de auth.uid()
const supabaseServiceRole = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, x-api-key, x-webhook-secret, content-type',
};

// Schema de validação para webhook do Bubble
const bubbleUsageWebhookSchema = z.object({
  company_name: z.string().min(1, 'Nome da empresa é obrigatório'),
  usage_days: z.number().int().min(0, 'Dias de uso deve ser um número positivo'),
  client_id: z.string().optional(),
  phone: z.string().optional(), // Telefone opcional (será gerado se não fornecido)
  email: z.string().email().optional(), // Email opcional
  timestamp: z.string().optional(),
  organization_id: z.string().uuid().optional(), // Opcional: se não fornecido, busca todas as organizações
});

/**
 * Determina o stage_id baseado nos dias de uso
 * Regras:
 * - >30 dias: Stage 4 (Renovação ou Fidelizado)
 * - >15 dias: Stage 3 (Suporte)
 * - >7 dias: Stage 2 (Ativação)
 * - <=7 dias: Stage 1 (Novo Cliente)
 */
async function getStageIdByUsageDays(
  supabase: any,
  organizationId: string,
  usageDays: number
): Promise<string | null> {
  // Buscar stages da organização ordenados por position
  const { data: stages, error } = await supabase
    .from('post_sale_stages')
    .select('id, name, position')
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });

  if (error || !stages || stages.length === 0) {
    console.error('❌ Erro ao buscar stages:', error);
    return null;
  }

  // Mapear stages por posição
  const stageMap: Record<number, string> = {};
  stages.forEach((stage: any) => {
    stageMap[stage.position] = stage.id;
  });

  // Determinar stage baseado nos dias de uso
  if (usageDays > 30) {
    // Stage 4 (posição 3) - Renovação ou Fidelizado
    return stageMap[3] || stageMap[4] || stages[stages.length - 1]?.id || null;
  } else if (usageDays > 15) {
    // Stage 3 (posição 2) - Suporte
    return stageMap[2] || stages[2]?.id || null;
  } else if (usageDays > 7) {
    // Stage 2 (posição 1) - Ativação
    return stageMap[1] || stages[1]?.id || null;
  } else {
    // Stage 1 (posição 0) - Novo Cliente
    return stageMap[0] || stages[0]?.id || null;
  }
}

/**
 * Gera um telefone placeholder quando não fornecido
 */
function generatePlaceholderPhone(companyName: string): string {
  // Gera um telefone baseado no hash do nome da empresa
  // Formato: 55000000000 + últimos 2 dígitos do hash
  const hash = companyName.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  const lastDigits = Math.abs(hash % 100).toString().padStart(2, '0');
  return `550000000${lastDigits}`;
}

/**
 * Busca ou cria um post-sale lead baseado no nome da empresa
 */
async function findOrCreatePostSaleLead(
  supabase: any,
  organizationId: string,
  companyName: string,
  usageDays: number,
  clientId?: string,
  phone?: string,
  email?: string
): Promise<{ lead: any; created: boolean }> {
  // Normalizar nome da empresa para busca (case-insensitive)
  const normalizedCompanyName = companyName.trim().toLowerCase();

  // Buscar lead existente por nome da empresa
  const { data: existingLead, error: searchError } = await supabase
    .from('post_sale_leads')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('company', normalizedCompanyName)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (searchError) {
    console.error('❌ Erro ao buscar lead:', searchError);
    throw new Error(`Erro ao buscar lead: ${searchError.message}`);
  }

  // Se encontrou lead existente, atualizar
  if (existingLead) {
    // Buscar stage_id baseado nos dias de uso
    const stageId = await getStageIdByUsageDays(supabase, organizationId, usageDays);

    // Atualizar lead existente
    const updateData: any = {
      updated_at: new Date().toISOString(),
      last_contact: new Date().toISOString(),
    };

    if (stageId) {
      updateData.stage_id = stageId;
    }

    // Adicionar nota sobre atualização automática
    const existingNotes = existingLead.notes || '';
    const newNote = `[AUTO] Atualizado via Bubble: ${usageDays} dias de uso (${new Date().toLocaleString('pt-BR')})`;
    updateData.notes = existingNotes 
      ? `${existingNotes}\n${newNote}`
      : newNote;

    const { data: updatedLead, error: updateError } = await supabase
      .from('post_sale_leads')
      .update(updateData)
      .eq('id', existingLead.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar lead:', updateError);
      throw new Error(`Erro ao atualizar lead: ${updateError.message}`);
    }

    // Criar atividade de status_change
    if (stageId && stageId !== existingLead.stage_id) {
      const { data: stageData } = await supabase
        .from('post_sale_stages')
        .select('name')
        .eq('id', stageId)
        .single();

      await supabase
        .from('post_sale_activities')
        .insert({
          post_sale_lead_id: existingLead.id,
          organization_id: organizationId,
          type: 'status_change',
          content: `Transição automática para "${stageData?.name || 'Nova etapa'}" (${usageDays} dias de uso)`,
          user_name: 'Sistema Bubble',
        });
    }

    return { lead: updatedLead, created: false };
  }

  // Se não encontrou, criar novo lead
  // Buscar primeiro usuário da organização para usar como user_id
  const { data: orgMember } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .limit(1)
    .single();

  if (!orgMember) {
    throw new Error('Organização não possui membros');
  }

  // Buscar stage_id baseado nos dias de uso
  const stageId = await getStageIdByUsageDays(supabase, organizationId, usageDays);

  // Buscar perfil do usuário para assigned_to
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', orgMember.user_id)
    .single();

  // Usar telefone fornecido ou gerar placeholder
  const leadPhone = phone?.trim() || generatePlaceholderPhone(companyName);

  const newLeadData: any = {
    organization_id: organizationId,
    user_id: orgMember.user_id,
    company: companyName.trim(),
    name: companyName.trim(), // Usar nome da empresa como nome do lead
    phone: leadPhone,
    email: email?.trim() || null,
    source: 'bubble_webhook',
    status: 'new',
    assigned_to: profile?.email || 'Sistema',
    notes: `[AUTO] Criado via Bubble: ${usageDays} dias de uso (${new Date().toLocaleString('pt-BR')})${phone ? '' : ' - Telefone gerado automaticamente'}`,
    created_by: orgMember.user_id,
    updated_by: orgMember.user_id,
  };

  if (stageId) {
    newLeadData.stage_id = stageId;
  }

  const { data: newLead, error: insertError } = await supabase
    .from('post_sale_leads')
    .insert(newLeadData)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Erro ao criar lead:', insertError);
    throw new Error(`Erro ao criar lead: ${insertError.message}`);
  }

  // Criar atividade inicial
  await supabase
    .from('post_sale_activities')
    .insert({
      post_sale_lead_id: newLead.id,
      organization_id: organizationId,
      type: 'note',
      content: `Lead criado automaticamente via webhook Bubble com ${usageDays} dias de uso`,
      user_name: 'Sistema Bubble',
    });

  return { lead: newLead, created: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Ignore non-POST requests (healthcheck)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: true, message: 'OK' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se há corpo na requisição
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.log('⚠️ Requisição sem Content-Type JSON');
      return new Response(
        JSON.stringify({ success: false, error: 'Content-Type deve ser application/json' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse e valida o payload
    const text = await req.text();
    if (!text || text.trim() === '') {
      console.log('⚠️ Corpo da requisição vazio');
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição vazio' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const rawPayload = JSON.parse(text);
    console.log('📥 Webhook Bubble recebido:', JSON.stringify(rawPayload, null, 2));

    // Validar payload com Zod
    const validationResult = bubbleUsageWebhookSchema.safeParse(rawPayload);
    if (!validationResult.success) {
      console.error('❌ Erro de validação:', validationResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payload inválido',
          details: validationResult.error.errors
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { company_name, usage_days, client_id, phone, email, organization_id } = validationResult.data;

    // Se organization_id foi fornecido, usar apenas essa organização
    // Caso contrário, buscar em todas as organizações (não recomendado, mas possível)
    let organizationIds: string[] = [];

    if (organization_id) {
      organizationIds = [organization_id];
    } else {
      // Buscar todas as organizações (limitação: pode ser lento)
      // Em produção, é recomendado sempre fornecer organization_id
      const { data: allOrgs } = await supabase
        .from('organizations')
        .select('id')
        .limit(100); // Limite de segurança

      if (allOrgs) {
        organizationIds = allOrgs.map((org: any) => org.id);
      }

      if (organizationIds.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Nenhuma organização encontrada. Forneça organization_id no payload.' 
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Processar para cada organização
    const results: any[] = [];

    for (const orgId of organizationIds) {
      try {
        const { lead, created } = await findOrCreatePostSaleLead(
          supabase,
          orgId,
          company_name,
          usage_days,
          client_id,
          phone,
          email
        );

        results.push({
          organization_id: orgId,
          company_name,
          usage_days,
          lead_id: lead.id,
          stage_id: lead.stage_id,
          created,
          action: created ? 'created' : 'updated',
        });

        console.log(`✅ ${created ? 'Criado' : 'Atualizado'} lead para ${company_name} na organização ${orgId}`);
      } catch (error: any) {
        console.error(`❌ Erro ao processar organização ${orgId}:`, error);
        results.push({
          organization_id: orgId,
          company_name,
          usage_days,
          error: error.message,
          success: false,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processado com sucesso',
        results,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
