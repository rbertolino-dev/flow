import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, success, error, ip, userAgent, method, userId } = await req.json();

    const forwardedIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null;
    const effectiveIp = ip || forwardedIp;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert auth audit log
    const { error: insertError } = await supabase
      .from('auth_audit_logs')
      .insert({
        email,
        success,
        error,
        ip: effectiveIp,
        user_agent: userAgent,
        method,
        user_id: userId || null,
      });

    if (insertError) {
      console.error('Error inserting auth audit log:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in log-auth-attempt:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
