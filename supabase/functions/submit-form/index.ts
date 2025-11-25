import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { form_id, data, metadata } = await req.json();

    if (!form_id || !data) {
      return new Response(
        JSON.stringify({ success: false, error: 'form_id e data são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar formulário
    const { data: form, error: formError } = await supabase
      .from('form_builders')
      .select('*')
      .eq('id', form_id)
      .eq('is_active', true)
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formulário não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extrair dados do lead do formulário
    const name = data.name || data.nome || data.full_name || '';
    const phone = data.phone || data.telefone || data.celular || '';
    const email = data.email || data.e_mail || '';
    const company = data.company || data.empresa || data.organization || '';
    const notes = Object.entries(data)
      .filter(([key]) => !['name', 'nome', 'full_name', 'phone', 'telefone', 'celular', 'email', 'e_mail', 'company', 'empresa', 'organization'].includes(key))
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome e telefone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone (remover caracteres não numéricos)
    const normalizedPhone = phone.replace(/\D/g, '');

    // Criar lead usando a função RPC segura
    const { data: leadId, error: leadError } = await supabase.rpc('create_lead_secure', {
      p_org_id: form.organization_id,
      p_name: name,
      p_phone: normalizedPhone,
      p_email: email || null,
      p_company: company || null,
      p_value: null,
      p_stage_id: form.stage_id || null,
      p_notes: notes || null,
      p_source: `form_${form.name}`,
    });

    if (leadError) {
      console.error('Erro ao criar lead:', leadError);
      return new Response(
        JSON.stringify({ success: false, error: leadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Salvar submissão do formulário (opcional, para histórico)
    await supabase.from('form_submissions').insert({
      form_id: form.id,
      organization_id: form.organization_id,
      lead_id: leadId as string,
      data: data,
      metadata: metadata || {},
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: leadId,
        message: form.success_message 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao processar submissão:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

