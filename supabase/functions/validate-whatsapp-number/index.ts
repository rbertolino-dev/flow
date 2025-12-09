import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para adicionar delay entre requisições
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para normalizar número de telefone para comparação
function normalizePhoneForComparison(phone: string): string {
  if (!phone) return "";
  // Remove todos os caracteres não numéricos
  return phone.replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { instanceId, phones, batchSize = 5, delayBetweenBatches = 3000 } = await req.json();

    if (!instanceId || !phones || !Array.isArray(phones)) {
      return new Response(
        JSON.stringify({ error: 'instanceId e phones (array) são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da Evolution API
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from('evolution_config')
      .select('api_url, api_key, instance_name')
      .eq('id', instanceId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Iniciando validação de ${phones.length} números em lotes de ${batchSize}`);

    const results: Array<{ phone: string; hasWhatsApp: boolean; jid?: string; error?: string }> = [];

    // Processar em lotes
    for (let i = 0; i < phones.length; i += batchSize) {
      const batch = phones.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(phones.length / batchSize);
      
      console.log(`📦 Processando lote ${batchNumber}/${totalBatches} com ${batch.length} números`);

      // Normalizar números do lote
      const formattedBatch = batch.map((phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '');
        return cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      });

      try {
        // Chamar Evolution API para validar lote
        const evolutionUrl = `${config.api_url}/chat/whatsappNumbers/${config.instance_name}`;
        const evolutionResponse = await fetch(evolutionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.api_key,
          },
          body: JSON.stringify({
            numbers: formattedBatch
          }),
        });

        if (!evolutionResponse.ok) {
          const errorText = await evolutionResponse.text();
          console.error(`❌ Erro no lote ${batchNumber}:`, errorText);
          
          // Adicionar erro para todos os números do lote
          batch.forEach((phone: string, index: number) => {
            results.push({
              phone: formattedBatch[index],
              hasWhatsApp: false,
              error: 'Erro ao validar'
            });
          });
        } else {
          let batchResults = await evolutionResponse.json();
          
          // Tratar diferentes formatos de resposta
          if (batchResults && !Array.isArray(batchResults)) {
            // Pode ser objeto com array dentro
            batchResults = batchResults.data || batchResults.results || batchResults.numbers || [];
          }
          
          if (!Array.isArray(batchResults)) {
            console.warn(`⚠️ Formato de resposta inesperado no lote ${batchNumber}`);
            batchResults = [];
          }

          // Criar mapa de resultados por número normalizado
          const resultsMap = new Map<string, any>();
          for (const result of batchResults) {
            if (result && result.number) {
              const normalized = normalizePhoneForComparison(result.number);
              if (normalized) {
                // Priorizar resultados com exists: true
                if (!resultsMap.has(normalized) || result.exists === true) {
                  resultsMap.set(normalized, result);
                }
              }
            }
          }

          // Processar cada número do lote e buscar na resposta
          for (const phone of formattedBatch) {
            const normalized = normalizePhoneForComparison(phone);
            const apiResult = resultsMap.get(normalized);

            if (apiResult) {
              // Verificar múltiplas formas de indicar que existe WhatsApp
              const hasWhatsApp = 
                apiResult.exists === true || 
                apiResult.exists === "true" ||
                apiResult.hasWhatsApp === true ||
                (apiResult.jid && apiResult.jid.length > 0) ||
                apiResult.status === "valid";

              results.push({
                phone: phone,
                hasWhatsApp: hasWhatsApp,
                jid: apiResult.jid || null,
              });
            } else {
              // Número não encontrado na resposta
              console.warn(`⚠️ Número não encontrado na resposta: ${phone} (normalizado: ${normalized})`);
              results.push({
                phone: phone,
                hasWhatsApp: false,
                error: 'Número não retornado pela API'
              });
            }
          }

          const validCount = results.filter(r => r.hasWhatsApp && !r.error).length;
          console.log(`✅ Lote ${batchNumber} processado: ${validCount}/${batch.length} com WhatsApp`);
        }

        // Delay entre lotes (exceto no último)
        if (i + batchSize < phones.length) {
          console.log(`⏳ Aguardando ${delayBetweenBatches}ms antes do próximo lote...`);
          await delay(delayBetweenBatches);
        }

      } catch (error) {
        console.error(`❌ Erro ao processar lote ${batchNumber}:`, error);
        
        // Adicionar erro para todos os números do lote
        batch.forEach((phone: string, index: number) => {
          results.push({
            phone: formattedBatch[index],
            hasWhatsApp: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          });
        });
      }
    }

    const summary = {
      total: results.length,
      valid: results.filter(r => r.hasWhatsApp).length,
      invalid: results.filter(r => !r.hasWhatsApp && !r.error).length,
      errors: results.filter(r => r.error).length,
    };

    console.log(`📊 Validação concluída:`, summary);

    return new Response(
      JSON.stringify({ 
        results,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao validar números WhatsApp:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
