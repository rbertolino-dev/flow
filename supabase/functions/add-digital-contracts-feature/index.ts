// Edge Function para adicionar digital_contracts ao enum organization_feature
// Pode ser chamada via HTTP POST

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // SQL para adicionar digital_contracts ao enum
    const sql = `
      -- Criar função auxiliar se não existir
      CREATE OR REPLACE FUNCTION public.add_enum_value_if_not_exists(
        _enum_type TEXT,
        _enum_value TEXT
      )
      RETURNS VOID
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_exists BOOLEAN;
      BEGIN
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = _enum_value
            AND enumtypid = (
              SELECT oid
              FROM pg_type
              WHERE typname = _enum_type
            )
        ) INTO v_exists;
        
        IF NOT v_exists THEN
          EXECUTE format('ALTER TYPE %I ADD VALUE %L', _enum_type, _enum_value);
        END IF;
      END;
      $$;

      -- Adicionar digital_contracts
      DO $$
      BEGIN
        PERFORM public.add_enum_value_if_not_exists('organization_feature', 'digital_contracts');
      END $$;

      -- Verificar se foi adicionado
      SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM pg_enum 
            WHERE enumlabel = 'digital_contracts'
            AND enumtypid = (
              SELECT oid 
              FROM pg_type 
              WHERE typname = 'organization_feature'
            )
          ) THEN '✅ SUCESSO: digital_contracts EXISTE'
          ELSE '❌ ERRO: digital_contracts NÃO EXISTE'
        END as resultado;
    `

    // Executar SQL via RPC (usando função SQL)
    const { data, error } = await supabase.rpc('exec_sql', { 
      query: sql 
    }).catch(async () => {
      // Se RPC não existir, tentar executar diretamente via query
      // Dividir SQL em partes executáveis
      const parts = sql.split(';').filter(p => p.trim())
      
      for (const part of parts) {
        if (part.trim()) {
          await supabase.from('_').select('*').limit(0) // Dummy query para conectar
          // Não podemos executar DDL via client, então retornar instruções
        }
      }
      
      return { data: null, error: { message: 'Não é possível executar DDL via client. Use SQL Editor.' } }
    })

    if (error) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          message: 'Execute o SQL manualmente no Supabase Dashboard',
          sql: sql
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'digital_contracts adicionado ao enum organization_feature',
        data 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message,
        message: 'Execute o SQL manualmente no Supabase Dashboard: APLICAR-AGORA-SIMPLES.sql'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

