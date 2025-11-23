import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { organizationId, conversationIds, action } = await req.json();

    const { data: config } = await supabase
      .from('chatwoot_configs')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (!config) {
      throw new Error('Chatwoot not configured');
    }

    const actionMap: Record<string, any> = {
      'resolve': { status: 'resolved' },
      'open': { status: 'open' },
      'mute': { muted: true },
    };

    const payload = actionMap[action];
    if (!payload) {
      throw new Error('Invalid action');
    }

    // Execute macro for each conversation
    const results = await Promise.all(
      conversationIds.map(async (convId: number) => {
        const response = await fetch(
          `${config.chatwoot_base_url}/api/v1/accounts/${config.chatwoot_account_id}/conversations/${convId}`,
          {
            method: 'PATCH',
            headers: {
              'api_access_token': config.chatwoot_api_access_token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );
        return response.json();
      })
    );

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
