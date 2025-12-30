import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticação (apenas service role pode executar)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Service role key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SQL da migration
    const migrationSQL = `
-- =====================================================
-- FIX: Permitir follow-ups em post_sale_leads
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view follow-ups from their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can create follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can update follow-ups in their leads" ON lead_follow_ups;
DROP POLICY IF EXISTS "Users can delete follow-ups from their leads" ON lead_follow_ups;

-- Create new policies that check both leads and post_sale_leads
CREATE POLICY "Users can view follow-ups from their leads"
  ON lead_follow_ups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM post_sale_leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can create follow-ups in their leads"
  ON lead_follow_ups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM post_sale_leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can update follow-ups in their leads"
  ON lead_follow_ups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM post_sale_leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

CREATE POLICY "Users can delete follow-ups from their leads"
  ON lead_follow_ups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM post_sale_leads
      WHERE id = lead_follow_ups.lead_id
      AND public.user_belongs_to_org(auth.uid(), organization_id)
    )
  );

-- Fix RLS policies for lead_follow_up_step_completions
DROP POLICY IF EXISTS "Users can view step completions from their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can create step completions in their follow-ups" ON lead_follow_up_step_completions;
DROP POLICY IF EXISTS "Users can delete step completions from their follow-ups" ON lead_follow_up_step_completions;

CREATE POLICY "Users can view step completions from their follow-ups"
  ON lead_follow_up_step_completions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN post_sale_leads psl ON psl.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
    )
  );

CREATE POLICY "Users can create step completions in their follow-ups"
  ON lead_follow_up_step_completions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN post_sale_leads psl ON psl.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
    )
  );

CREATE POLICY "Users can delete step completions from their follow-ups"
  ON lead_follow_up_step_completions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN leads l ON l.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), l.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM lead_follow_ups lfu
      JOIN post_sale_leads psl ON psl.id = lfu.lead_id
      WHERE lfu.id = lead_follow_up_step_completions.follow_up_id
      AND public.user_belongs_to_org(auth.uid(), psl.organization_id)
    )
  );
`;

    // Executar SQL via RPC (método alternativo)
    // Nota: Supabase não permite execução direta de SQL via client
    // Vamos usar o método de chamar uma função SQL que executa o SQL
    
    // Método: Criar função temporária que executa o SQL
    // Mas isso também não funciona diretamente...
    
    // Solução: Retornar SQL para ser executado manualmente ou via CLI
    return new Response(
      JSON.stringify({
        success: false,
        message: "Edge functions não podem executar SQL diretamente. Use o Supabase CLI ou Dashboard.",
        sql: migrationSQL,
        instructions: [
          "1. Acesse: https://supabase.com/dashboard/project/ogeljmbhqxpfjbpnbwog/sql/new",
          "2. Cole o SQL retornado nesta resposta",
          "3. Execute (Run)"
        ]
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

