import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Obter token de autorização
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(JSON.stringify({ error: 'Token de autorização não fornecido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verificar autenticação usando o token enviado no header
    const token = (authHeader || '').replace('Bearer', '').trim();
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(JSON.stringify({ error: 'Não autorizado. Por favor, faça login novamente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { startDate, endDate }: ImportRequest = await req.json();

    console.log('Importing contacts for user:', user.id);
    console.log('Date range:', { startDate, endDate });

    // Salvar log de início da importação
    await supabaseClient.from('evolution_logs').insert({
      user_id: user.id,
      instance: 'import-contacts',
      event: 'import_start',
      level: 'info',
      message: `Iniciando importação para usuário ${user.id}`,
      payload: { startDate, endDate },
    });

    // Buscar configuração da Evolution API
    const { data: config, error: configError } = await supabaseClient
      .from('evolution_config')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const cleanApiUrl = (url: string) =>
      (url || '')
        .replace(/\/$/, '')
        .replace(/\/(manager|dashboard|app)$/i, '');


    if (configError || !config) {
      console.error('Config error:', configError);
      
      // Log do erro
      await supabaseClient.from('evolution_logs').insert({
        user_id: user.id,
        event: 'import-contacts',
        level: 'error',
        message: 'Configuração da Evolution API não encontrada',
        payload: { error: configError?.message },
      });

      return new Response(
        JSON.stringify({ error: 'Configuração da Evolution API não encontrada' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar contatos da Evolution API
    const baseUrl = cleanApiUrl(config.api_url);
    const evolutionUrl = `${baseUrl}/chat/findContacts/${config.instance_name}`;
    console.log('Fetching contacts from:', evolutionUrl);

    const contactsResponse = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'apikey': config.api_key || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const contentType = contactsResponse.headers.get('content-type') || '';

    if (!contactsResponse.ok) {
      const errorText = await contactsResponse.text();
      console.error('Evolution API error:', contactsResponse.status, errorText?.slice(0, 500));
      return new Response(
        JSON.stringify({ error: `Erro na Evolution API: ${contactsResponse.status}`, details: errorText?.slice(0, 500) }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!contentType.includes('application/json')) {
      const rawText = await contactsResponse.text();
      console.error('Evolution API returned non-JSON:', rawText?.slice(0, 500));

      await supabaseClient.from('evolution_logs').insert({
        user_id: user.id,
        instance: config.instance_name,
        event: 'import_error',
        level: 'error',
        message: 'Evolution API retornou HTML (não JSON). URL pode estar incorreta.',
        payload: { url: evolutionUrl, response: rawText?.slice(0, 500) },
      });

      return new Response(
        JSON.stringify({ error: 'Resposta inválida da Evolution API (não JSON). Verifique URL/instance/apikey.', details: rawText?.slice(0, 500) }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const contacts = await contactsResponse.json();
    console.log('Total contacts fetched:', Array.isArray(contacts) ? contacts.length : Object.keys(contacts || {}).length);

    // Buscar primeiro estágio do pipeline
    const { data: firstStage } = await supabaseClient
      .from('pipeline_stages')
      .select('id')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .limit(1)
      .single();

    // Filtrar e preparar leads
    let filteredContacts = contacts;
    
    if (startDate || endDate) {
      filteredContacts = contacts.filter((contact: any) => {
        // Tentar obter data de criação do contato
        // A Evolution API pode retornar timestamp ou não ter essa info
        const contactDate = contact.timestamp || contact.createdAt || contact.date;
        
        if (!contactDate) return true; // Se não tem data, incluir
        
        const contactTimestamp = new Date(contactDate).getTime();
        
        if (startDate) {
          const startTimestamp = new Date(startDate).getTime();
          if (contactTimestamp < startTimestamp) return false;
        }
        
        if (endDate) {
          const endTimestamp = new Date(endDate).getTime();
          if (contactTimestamp > endTimestamp) return false;
        }
        
        return true;
      });
    }

    console.log('Contacts after date filter:', filteredContacts.length);

    const leadsToInsert = filteredContacts
      .filter((contact: any) => {
        // Filtrar apenas contatos válidos (não grupos) e com número extraível
        const raw = contact.number || contact.phone || contact.remoteJid || contact.id || contact.key?.remoteJid || contact.wid?.user || contact.jid;
        const rawStr = typeof raw === 'string' ? raw : '';
        const phoneDigits = (rawStr.match(/\d{7,15}/)?.[0] || '').replace(/\D/g, '');
        const isValid = phoneDigits.length >= 10 && !rawStr.includes('@g.us');
        
        console.log('[IMPORT] Filter check:', {
          raw: rawStr.substring(0, 30),
          digits: phoneDigits,
          length: phoneDigits.length,
          isValid,
          isGroup: rawStr.includes('@g.us')
        });
        
        return isValid;
      })
      .map((contact: any) => {
        const phoneNumber = (() => {
          const candidates = [
            contact.number,
            contact.phone,
            contact.remoteJid,
            contact.id,
            contact.key?.remoteJid,
            contact.wid?.user,
            contact.jid,
            contact.chatId,
          ];
          const raw = candidates.find((v: any) => typeof v === 'string' && v.length > 0) || '';
          let extracted = '';
          
          if (typeof raw === 'string') {
            // Tentar extrair número antes do @
            if (raw.includes('@')) {
              extracted = raw.split('@')[0].replace(/\D/g, '');
            } else {
              // Extrair sequência de dígitos
              const match = raw.match(/\d{10,15}/);
              extracted = match ? match[0] : raw.replace(/\D/g, '');
            }
          }
          
          console.log('[IMPORT] Phone extraction:', {
            source: candidates.filter(c => c).slice(0, 3),
            raw: typeof raw === 'string' ? raw.substring(0, 30) : raw,
            extracted: extracted,
            length: extracted.length
          });
          
          return extracted;
        })();
        const name = contact.pushName || contact.name || phoneNumber;
        
        return {
          user_id: user.id,
          name: name,
          phone: phoneNumber,
          source: 'whatsapp_import',
          status: 'new',
          assigned_to: user.email || 'Sistema',
          stage_id: firstStage?.id || null,
          created_at: contact.timestamp || contact.createdAt || new Date().toISOString(),
          last_contact: contact.timestamp || contact.createdAt || new Date().toISOString(),
        };
      });

    console.log('Leads to insert:', leadsToInsert.length);

    if (leadsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          imported: 0,
          message: 'Nenhum contato encontrado no período selecionado' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Inserir leads (ignorar duplicados)
    const { data: insertedLeads, error: insertError } = await supabaseClient
      .from('leads')
      .upsert(leadsToInsert, { 
        onConflict: 'user_id,phone',
        ignoreDuplicates: true 
      })
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      // Mesmo com erro, alguns podem ter sido inseridos
    }

    const importedCount = insertedLeads?.length || 0;
    console.log('Successfully imported:', importedCount);

    // Salvar log de sucesso
    await supabaseClient.from('evolution_logs').insert({
      user_id: user.id,
      instance: config.instance_name,
      event: 'import_success',
      level: 'info',
      message: `Importação concluída: ${importedCount}/${leadsToInsert.length} contatos`,
      payload: { total: leadsToInsert.length, imported: importedCount, startDate, endDate },
    });

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        total: leadsToInsert.length,
        message: `${importedCount} contatos importados com sucesso`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error importing contacts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
