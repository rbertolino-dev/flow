import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar se usuário é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é admin
    const { data: isAdmin } = await supabase.rpc('has_role', { 
      _user_id: user.id, 
      _role: 'admin' 
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem executar este script.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DISABLE-EMAIL-CONFIRMATION] Tentando desabilitar confirmação de email...');

    // NOTA: O Supabase não permite alterar configurações de auth via API direta
    // A configuração deve ser feita no Dashboard
    // Mas podemos verificar a configuração atual e fornecer instruções

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Não é possível desabilitar confirmação de email via API',
        reason: 'O Supabase não expõe esta configuração via API por questões de segurança',
        instructions: {
          step1: 'Acesse o Dashboard do Supabase',
          step2: 'Vá em Authentication > Providers > Email',
          step3: 'Desabilite "Confirm email"',
          step4: 'Salve as alterações'
        },
        dashboard_url: `https://supabase.com/dashboard/project/${supabaseUrl.split('//')[1].split('.')[0]}/auth/providers`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DISABLE-EMAIL-CONFIRMATION] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

