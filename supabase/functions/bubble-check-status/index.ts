import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BUBBLE_API_KEY = Deno.env.get('BUBBLE_API_KEY');
    const apiKey = req.headers.get('x-api-key');

    // Validar API Key
    if (!apiKey || apiKey !== BUBBLE_API_KEY) {
      console.error('❌ API Key inválida ou ausente');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const messageId = url.searchParams.get('messageId');

    if (!messageId) {
      return new Response(
        JSON.stringify({ error: 'Missing messageId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verificando status da mensagem:', messageId);

    // Criar cliente Supabase com Service Role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar tracking da mensagem
    const { data: tracking, error } = await supabase
      .from('bubble_message_tracking')
      .select('*')
      .eq('message_id', messageId)
      .single();

    if (error || !tracking) {
      console.log('❌ Mensagem não encontrada:', messageId);
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Status encontrado:', tracking.status);

    // Retornar status
    return new Response(
      JSON.stringify({
        messageId: tracking.message_id,
        phone: tracking.phone,
        status: tracking.status,
        sentAt: tracking.sent_at,
        deliveredAt: tracking.delivered_at,
        readAt: tracking.read_at,
        metadata: tracking.metadata
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro ao verificar status:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
