import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  const first = forwarded.split(',')[0]?.trim();
  return first || null;
}

async function productBelongsToOrg(productId: string, organizationId: string): Promise<boolean> {
  const postgresHost = Deno.env.get('POSTGRES_HOST') || 'localhost';
  const postgresPort = parseInt(Deno.env.get('POSTGRES_PORT') || '5432');
  const postgresPassword = Deno.env.get('POSTGRES_PASSWORD');
  if (!postgresPassword) return false;

  let finalHost = postgresHost;
  if (postgresHost === 'localhost' || postgresHost === '127.0.0.1') {
    finalHost = Deno.env.get('POSTGRES_SERVER_IP') || '95.217.2.116';
  }

  const client = new Client({
    hostname: finalHost,
    port: postgresPort,
    database: Deno.env.get('POSTGRES_DB') || 'budget_services',
    user: Deno.env.get('POSTGRES_USER') || 'budget_user',
    password: postgresPassword,
    tls: { enforce: false, caCertificates: [] },
    connection: { keepAlive: true, connectTimeout: 10000 },
  });

  try {
    await client.connect();
    const result = await client.queryObject<{ id: string }>(
      `SELECT id FROM products WHERE id = $1 AND organization_id = $2 AND is_active = true LIMIT 1`,
      [productId, organizationId],
    );
    return result.rows.length > 0;
  } finally {
    try { await client.end(); } catch { /* conexão já encerrada */ }
  }
}

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
      user_agent,
    } = body;

    if (!landing_page_id || !organization_id || !name || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'landing_page_id, organization_id, name e phone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, organization_id, is_active, form_enabled, form_destination')
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

    if (landingPage.form_enabled === false) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formulário desativado nesta página' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (product_id) {
      const belongs = await productBelongsToOrg(String(product_id), organization_id);
      if (!belongs) {
        return new Response(
          JSON.stringify({ success: false, error: 'Produto não pertence a esta organização' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const destination = landingPage.form_destination || 'leads';

    const { data: leadData, error: leadError } = await supabase
      .from('landing_page_leads')
      .insert({
        landing_page_id,
        organization_id,
        name: String(name).trim(),
        phone: String(phone).trim(),
        email: (email || '').trim() || null,
        message: (message || '').trim() || null,
        product_id: product_id || null,
        product_name: product_name || null,
        source: 'landing_page',
        page_url: page_url || null,
        ip_address: clientIp(req),
        user_agent: user_agent || req.headers.get('user-agent'),
      })
      .select()
      .single();

    if (leadError) {
      console.error('Erro ao criar landing_page_lead:', leadError);
      const rateLimited = /rate limit/i.test(leadError.message || '');
      return new Response(
        JSON.stringify({
          success: false,
          error: rateLimited ? 'Muitas mensagens deste endereço. Tente novamente mais tarde.' : leadError.message,
        }),
        { status: rateLimited ? 429 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (destination === 'leads') {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organization_id)
        .limit(10);

      const owner = members?.find((m) => m.role === 'owner');
      const admin = members?.find((m) => m.role === 'admin');
      const userId = owner?.user_id || admin?.user_id || members?.[0]?.user_id;

      if (userId) {
        const { data: crmLead, error: crmError } = await supabase
          .from('leads')
          .insert({
            organization_id,
            user_id: userId,
            name: String(name).trim(),
            phone: String(phone).trim(),
            email: (email || '').trim() || null,
            source: 'landing_page',
            status: 'new',
            notes: (message || '').trim() || null,
          })
          .select('id')
          .single();

        if (crmError) {
          console.error('Erro ao criar lead no CRM:', crmError);
        } else if (crmLead?.id) {
          await supabase
            .from('landing_page_leads')
            .update({
              lead_id: crmLead.id,
              is_processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('id', leadData.id)
            .eq('organization_id', organization_id);
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
