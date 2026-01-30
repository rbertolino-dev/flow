import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const {
      landing_page_id,
      organization_id,
      name,
      phone,
      email,
      message,
      product_id,
      product_name,
      page_url,
      ip_address,
      user_agent,
      form_destination,
    } = body;

    if (!landing_page_id || !organization_id || !name || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'landing_page_id, organization_id, name e phone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar que landing page existe, está ativa e pertence à organização
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, organization_id, is_active, form_destination')
      .eq('id', landing_page_id)
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .maybeSingle();

    if (lpError || !landingPage) {
      return new Response(
        JSON.stringify({ success: false, error: 'Landing page não encontrada ou inativa' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const destination = form_destination || landingPage.form_destination || 'leads';

    // Inserir em landing_page_leads
    const { data: leadData, error: leadError } = await supabase
      .from('landing_page_leads')
      .insert({
        landing_page_id,
        organization_id,
        name: name.trim(),
        phone: phone.trim(),
        email: (email || '').trim() || null,
        message: (message || '').trim() || null,
        product_id: product_id || null,
        product_name: product_name || null,
        source: 'landing_page',
        page_url: page_url || null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Erro ao criar landing_page_lead:', leadError);
      return new Response(
        JSON.stringify({ success: false, error: leadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se destino é leads, criar lead no CRM com user_id do primeiro owner da organização
    if (destination === 'leads') {
      // Buscar primeiro owner ou admin da organização para atribuir o lead
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organization_id)
        .limit(10);

      const owner = members?.find(m => m.role === 'owner');
      const admin = members?.find(m => m.role === 'admin');
      const userId = owner?.user_id || admin?.user_id || members?.[0]?.user_id;

      if (userId) {
        const { error: crmError } = await supabase.from('leads').insert({
          organization_id,
          user_id: userId,
          name: name.trim(),
          phone: phone.trim(),
          email: (email || '').trim() || null,
          source: 'landing_page',
          status: 'new',
          notes: (message || '').trim() || null,
        });

        if (crmError) {
          console.error('Erro ao criar lead no CRM:', crmError);
          // Não falhar - landing_page_leads já foi criado
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadData?.id,
        message: 'Mensagem enviada com sucesso!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro ao processar formulário:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro ao processar formulário' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
