import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Normaliza número removendo todos os caracteres não numéricos
function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// Extrai os últimos N dígitos para comparação flexível
function getLastDigits(phone: string, count: number = 8): string {
  const normalized = normalizePhone(phone);
  return normalized.slice(-count);
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
      console.error('❌ Instância não encontrada:', configError);
      return new Response(
        JSON.stringify({ error: 'Instância não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Iniciando validação de ${phones.length} números em lotes de ${batchSize}`);
    console.log(`📡 Usando instância: ${config.instance_name} em ${config.api_url}`);

    const results: Array<{ phone: string; hasWhatsApp: boolean; jid?: string; error?: string }> = [];

    // Processar em lotes
    for (let i = 0; i < phones.length; i += batchSize) {
      const batch = phones.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(phones.length / batchSize);
      
      console.log(`📦 Processando lote ${batchNumber}/${totalBatches} com ${batch.length} números`);

      // Normalizar números do lote - adicionar 55 se não tiver
      const formattedBatch = batch.map((phone: string) => {
        const cleanPhone = normalizePhone(phone);
        return cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
      });

      console.log(`📱 Números formatados para validação:`, formattedBatch);

      try {
        // Chamar Evolution API para validar lote
        const evolutionUrl = `${config.api_url}/chat/whatsappNumbers/${config.instance_name}`;
        console.log(`🌐 Chamando: ${evolutionUrl}`);
        
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

        const responseText = await evolutionResponse.text();
        console.log(`📥 Resposta da API (status ${evolutionResponse.status}):`, responseText);

        if (!evolutionResponse.ok) {
          console.error(`❌ Erro no lote ${batchNumber}:`, responseText);
          
          batch.forEach((phone: string, index: number) => {
            results.push({
              phone: formattedBatch[index],
              hasWhatsApp: false,
              error: `Erro API: ${evolutionResponse.status}`
            });
          });
        } else {
          let batchResults;
          try {
            batchResults = JSON.parse(responseText);
          } catch (e) {
            console.error('❌ Erro ao parsear resposta:', e);
            batch.forEach((phone: string, index: number) => {
              results.push({
                phone: formattedBatch[index],
                hasWhatsApp: false,
                error: 'Resposta inválida da API'
              });
            });
            continue;
          }

          // Evolution API retorna array direto: [{exists, jid, number}]
          // Mas pode vir em diferentes formatos dependendo da versão
          let apiResults: any[] = [];
          
          if (Array.isArray(batchResults)) {
            apiResults = batchResults;
          } else if (batchResults && typeof batchResults === 'object') {
            // Pode vir como objeto com array dentro
            apiResults = batchResults.data || batchResults.results || batchResults.numbers || [];
            if (!Array.isArray(apiResults)) {
              apiResults = [batchResults]; // Single result as object
            }
          }

          console.log(`📊 Resultados da API (${apiResults.length} itens):`, JSON.stringify(apiResults, null, 2));

          // Criar mapa de resultados usando múltiplas chaves para matching flexível
          const resultsMap = new Map<string, any>();
          
          for (const result of apiResults) {
            if (!result) continue;
            
            // Usar número completo normalizado
            if (result.number) {
              const fullNumber = normalizePhone(result.number);
              resultsMap.set(fullNumber, result);
              
              // Também mapear pelos últimos 8-11 dígitos para matching flexível
              const last8 = getLastDigits(result.number, 8);
              const last9 = getLastDigits(result.number, 9);
              const last10 = getLastDigits(result.number, 10);
              const last11 = getLastDigits(result.number, 11);
              
              if (!resultsMap.has(last8)) resultsMap.set(last8, result);
              if (!resultsMap.has(last9)) resultsMap.set(last9, result);
              if (!resultsMap.has(last10)) resultsMap.set(last10, result);
              if (!resultsMap.has(last11)) resultsMap.set(last11, result);
            }
            
            // Também mapear pelo JID se disponível
            if (result.jid) {
              const jidNumber = normalizePhone(result.jid.split('@')[0]);
              resultsMap.set(jidNumber, result);
            }
          }

          console.log(`🗺️ Mapa de resultados criado com ${resultsMap.size} entradas`);

          // Processar cada número do lote
          for (let j = 0; j < formattedBatch.length; j++) {
            const phone = formattedBatch[j];
            const originalPhone = batch[j];
            const normalized = normalizePhone(phone);
            
            // Tentar encontrar o resultado usando várias estratégias
            let apiResult = resultsMap.get(normalized);
            
            if (!apiResult) {
              // Tentar pelos últimos dígitos
              apiResult = resultsMap.get(getLastDigits(phone, 11)) ||
                         resultsMap.get(getLastDigits(phone, 10)) ||
                         resultsMap.get(getLastDigits(phone, 9)) ||
                         resultsMap.get(getLastDigits(phone, 8));
            }

            // Se ainda não encontrou, procurar pelo índice (ordem de resposta)
            if (!apiResult && apiResults[j]) {
              apiResult = apiResults[j];
              console.log(`⚠️ Usando resultado por índice para ${phone}`);
            }

            if (apiResult) {
              // Verificar múltiplas formas de indicar que existe WhatsApp
              const hasWhatsApp = 
                apiResult.exists === true || 
                apiResult.exists === "true" ||
                (apiResult.jid && apiResult.jid.length > 0 && apiResult.jid.includes('@s.whatsapp.net'));

              console.log(`✅ ${phone}: exists=${apiResult.exists}, jid=${apiResult.jid}, hasWhatsApp=${hasWhatsApp}`);

              results.push({
                phone: phone,
                hasWhatsApp: hasWhatsApp,
                jid: apiResult.jid || null,
              });
            } else {
              console.warn(`⚠️ Número não encontrado na resposta: ${phone}`);
              results.push({
                phone: phone,
                hasWhatsApp: false,
                error: 'Número não retornado pela API'
              });
            }
          }

          const validInBatch = results.slice(-batch.length).filter(r => r.hasWhatsApp && !r.error).length;
          console.log(`✅ Lote ${batchNumber} processado: ${validInBatch}/${batch.length} com WhatsApp`);
        }

        // Delay entre lotes (exceto no último)
        if (i + batchSize < phones.length) {
          console.log(`⏳ Aguardando ${delayBetweenBatches}ms antes do próximo lote...`);
          await delay(delayBetweenBatches);
        }

      } catch (error) {
        console.error(`❌ Erro ao processar lote ${batchNumber}:`, error);
        
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
    console.log(`📋 Resultados detalhados:`, JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ 
        results,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro ao validar números WhatsApp:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
