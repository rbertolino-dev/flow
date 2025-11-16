import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔧 [apply-fix-recipient-type] Iniciando correção...');

    // 1. Adicionar coluna recipient_type se não existir
    const addColumnResult = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.whatsapp_workflows
          ADD COLUMN IF NOT EXISTS recipient_type text DEFAULT 'list'
            CHECK (recipient_type IN ('list', 'single', 'group'));
      `
    });

    // 2. Atualizar valores existentes usando RPC
    const { error: updateError } = await supabase
      .rpc('exec_sql', {
        sql: `
          UPDATE public.whatsapp_workflows
          SET recipient_type = CASE 
            WHEN recipient_mode = 'single' THEN 'single'
            ELSE 'list'
          END
          WHERE recipient_type IS NULL;
        `
      });

    // 3. Tornar NOT NULL
    const { error: alterError } = await supabase
      .rpc('exec_sql', {
        sql: `
          DO $$
          BEGIN
            UPDATE public.whatsapp_workflows
            SET recipient_type = 'list'
            WHERE recipient_type IS NULL;
            
            ALTER TABLE public.whatsapp_workflows
              ALTER COLUMN recipient_type SET NOT NULL,
              ALTER COLUMN recipient_type SET DEFAULT 'list';
          END $$;
        `
      });

    // 4. Adicionar group_id
    const { error: groupIdError } = await supabase
      .rpc('exec_sql', {
        sql: `
          DO $$
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_workflow_groups') THEN
              ALTER TABLE public.whatsapp_workflows
                ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.whatsapp_workflow_groups(id) ON DELETE SET NULL;
            ELSE
              ALTER TABLE public.whatsapp_workflows
                ADD COLUMN IF NOT EXISTS group_id uuid;
            END IF;
          END $$;
        `
      });

    // 5. Criar índices
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_recipient_type
          ON public.whatsapp_workflows (recipient_type);
        
        CREATE INDEX IF NOT EXISTS idx_whatsapp_workflows_group
          ON public.whatsapp_workflows (group_id)
          WHERE group_id IS NOT NULL;
      `
    });

    console.log('✅ [apply-fix-recipient-type] Correção aplicada com sucesso!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Coluna recipient_type adicionada com sucesso',
        applied: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ [apply-fix-recipient-type] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao aplicar correção',
        details: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

