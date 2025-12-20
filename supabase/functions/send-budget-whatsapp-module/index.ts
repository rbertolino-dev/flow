import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validar token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { budget_id } = await req.json();

    if (!budget_id) {
      return new Response(
        JSON.stringify({ error: 'budget_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar orçamento
    const { data: budget, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        *,
        leads (
          id,
          name,
          phone,
          email,
          company
        )
      `)
      .eq('id', budget_id)
      .single();

    if (budgetError || !budget) {
      return new Response(
        JSON.stringify({ error: 'Orçamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se usuário tem acesso à organização
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', budget.organization_id)
      .single();

    if (!orgMember) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar lead e telefone
    const lead = budget.leads || budget.client_data;
    if (!lead || !lead.phone) {
      return new Response(
        JSON.stringify({ error: 'Lead não possui telefone cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração Evolution API
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('*')
      .eq('organization_id', budget.organization_id)
      .eq('is_connected', true)
      .maybeSingle();

    if (configError || !evolutionConfig) {
      return new Response(
        JSON.stringify({ error: 'Configuração Evolution API não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se PDF existe
    if (!budget.pdf_url) {
      return new Response(
        JSON.stringify({ error: 'PDF não disponível. Gere o PDF primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone
    const normalizedPhone = lead.phone.replace(/\D/g, '');
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Telefone inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappNumber = `${normalizedPhone}@s.whatsapp.net`;

    // Enviar via Evolution API
    const evolutionApiUrl = evolutionConfig.api_url.replace(/\/$/, '');
    const sendMediaUrl = `${evolutionApiUrl}/message/sendMedia/${evolutionConfig.instance_name}`;

    // Enviar APENAS PDF, sem mensagem de texto (caption vazio)
    const evolutionPayload = {
      number: whatsappNumber,
      mediatype: 'document',
      mimetype: 'application/pdf',
      media: budget.pdf_url,
      fileName: `Orcamento_${budget.budget_number}.pdf`,
      caption: '', // Sem mensagem de texto, apenas PDF
      delay: 1200,
    };

    console.log('📤 Enviando orçamento via Evolution API...');

    const evolutionResponse = await fetch(sendMediaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key || '',
      },
      body: JSON.stringify(evolutionPayload),
    });

    console.log('📥 Resposta Evolution:', {
      status: evolutionResponse.status,
      ok: evolutionResponse.ok
    });

    if (!evolutionResponse.ok) {
      const errorText = await evolutionResponse.text();
      console.error('❌ Erro Evolution API:', errorText);
      throw new Error(`Evolution API erro ${evolutionResponse.status}: ${errorText}`);
    }

    const evolutionData = await evolutionResponse.json();

    console.log('✅ Orçamento enviado com sucesso:', evolutionData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Orçamento enviado via WhatsApp com sucesso',
        data: evolutionData,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro no send-budget-whatsapp-module:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message || 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

