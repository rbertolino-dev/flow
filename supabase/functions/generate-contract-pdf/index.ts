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

    const { contract_id } = await req.json();

    if (!contract_id) {
      return new Response(
        JSON.stringify({ error: 'contract_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar contrato
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      return new Response(
        JSON.stringify({ error: 'Contrato não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Por enquanto, retornar que o PDF deve ser gerado no frontend
    // No futuro, pode usar uma biblioteca de PDF ou API externa aqui
    // Por exemplo: Puppeteer, PDFKit, ou API como PDFShift
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'PDF deve ser gerado no frontend usando jsPDF',
        contract_id: contract_id,
        content: contract.content,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Erro ao gerar PDF:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


