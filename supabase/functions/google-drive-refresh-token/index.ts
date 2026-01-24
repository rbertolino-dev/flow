import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google OAuth 2.0 credentials
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Obter token de autenticação do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { refresh_token, config_id } = await req.json();

    if (!refresh_token) {
      return new Response(
        JSON.stringify({ error: 'refresh_token é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Renovar token usando refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || 'Erro ao renovar token do Google');
    }

    const tokens = await tokenResponse.json();

    // Se config_id foi fornecido, atualizar banco de dados
    if (config_id) {
      try {
        // Criar cliente Supabase com service role para bypass RLS
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          
          // Calcular nova data de expiração
          const expiresIn = tokens.expires_in || 3600; // Default 1 hora
          const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();
          
          // Atualizar configuração no banco
          const { error: updateError } = await supabase
            .from('client_google_drive_configs')
            .update({
              access_token: tokens.access_token,
              token_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', config_id);
          
          if (updateError) {
            console.error('Erro ao atualizar token no banco:', updateError);
            // Não falha a requisição se atualização do banco falhar
            // O token foi renovado com sucesso, apenas não foi salvo
          }
        }
      } catch (dbError) {
        console.error('Erro ao atualizar banco de dados:', dbError);
        // Não falha a requisição se atualização do banco falhar
      }
    }

    return new Response(
      JSON.stringify({ 
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erro ao renovar token do Google Drive:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

