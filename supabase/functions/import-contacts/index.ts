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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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
    const userId = user.id;

    console.log('Importing contacts for user:', userId);
    console.log('Date range:', { startDate, endDate });

    // Obter organization_id do usuário usando RPC
    const { data: orgId, error: orgError } = await supabaseClient
      .rpc('get_user_organization', { _user_id: userId });

    if (orgError || !orgId) {
      console.error('Organization error:', orgError);
      return new Response(JSON.stringify({ error: 'Usuário não pertence a nenhuma organização' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const organizationId = orgId;

    // Salvar log de início da importação
    await supabaseClient.from('evolution_logs').insert({
      user_id: userId,
      organization_id: organizationId,
      instance: 'import-contacts',
      event: 'import_start',
      level: 'info',
      message: `Iniciando importação para usuário ${userId}`,
      payload: { startDate, endDate },
    });

    // Buscar configuração da Evolution API da organização
    const { data: config, error: configError } = await supabaseClient
      .from('evolution_config')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const cleanApiUrl = (url: string) =>
      (url || '')
        .replace(/\/$/, '')
        .replace(/\/(manager|dashboard|app)$/i, '');


    if (configError || !config) {
      console.error('Config error:', configError);
      
      // Log do erro
      await supabaseClient.from('evolution_logs').insert({
        user_id: userId,
        organization_id: organizationId,
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

    const baseApiUrl = cleanApiUrl(config.api_url);
    const apiUrl = `${baseApiUrl}/chat/findContacts/${config.instance_name}`;

    console.log('Fetching contacts from:', apiUrl);

    // Buscar contatos da Evolution API
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'apikey': config.api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Evolution API error:', errorText);
      
      await supabaseClient.from('evolution_logs').insert({
        user_id: userId,
        organization_id: organizationId,
        instance: config.instance_name,
        event: 'import_error',
        level: 'error',
        message: 'Erro ao buscar contatos da Evolution API',
        payload: { error: errorText, status: response.status },
      });

      return new Response(
        JSON.stringify({ error: 'Erro ao buscar contatos da Evolution API' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const contacts = await response.json();
    console.log('Total contacts fetched:', contacts.length);

    // Filtrar contatos por data se fornecido
    let filteredContacts = contacts;
    
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();

      filteredContacts = contacts.filter((contact: any) => {
        const contactTimestamp = contact.timestamp || contact.createdAt || contact.lastMessageTimestamp;
        if (!contactTimestamp) return false;
        
        const contactDate = new Date(contactTimestamp * 1000).getTime();
        const isInRange = contactDate >= start && contactDate <= end;
        
        return isInRange;
      });
    }

    console.log('Contacts after date filter:', filteredContacts.length);

    // Separar contatos em 3 categorias
    const brazilianLeads: any[] = [];
    const internationalContacts: any[] = [];
    const lidContacts: any[] = [];

    filteredContacts.forEach((contact: any) => {
      const raw = contact.number || contact.phone || contact.remoteJid || contact.id || contact.key?.remoteJid || contact.wid?.user || contact.jid;
      const rawStr = typeof raw === 'string' ? raw : '';
      const contactDate = contact.timestamp || contact.createdAt || new Date().toISOString();
      
      // Verificar se é LID (WhatsApp Business/Canal)
      if (rawStr.includes('@lid')) {
        const lid = rawStr.split('@')[0];
        const name = contact.pushName || contact.name || lid;
        const profilePicUrl = contact.profilePicUrl || contact.profilePictureUrl || null;
        
        lidContacts.push({
          lid,
          name,
          profile_pic_url: profilePicUrl,
          last_contact: contactDate,
        });
        
        console.log('[IMPORT] LID contact:', { lid, name });
        return;
      }
      
      // Verificar se é grupo
      if (rawStr.includes('@g.us')) {
        console.log('[IMPORT] Skipping group:', rawStr.substring(0, 30));
        return;
      }
      
      // Extrair telefone
      const phoneDigits = rawStr.includes('@') 
        ? rawStr.split('@')[0].replace(/\D/g, '') 
        : rawStr.replace(/\D/g, '');
      
      if (phoneDigits.length < 10) {
        console.log('[IMPORT] Phone too short:', phoneDigits);
        return;
      }
      
      const name = contact.pushName || contact.name || phoneDigits;
      
      // Verificar se é brasileiro
      const isBrazilian = phoneDigits.startsWith('55') && phoneDigits.length >= 12 && phoneDigits.length <= 13;
      const isBRWithoutCode = phoneDigits.length >= 10 && phoneDigits.length <= 11 && !phoneDigits.startsWith('55');
      
      if (isBrazilian || isBRWithoutCode) {
        brazilianLeads.push({
          phone: phoneDigits,
          name,
          last_contact: contactDate,
        });
        console.log('[IMPORT] Brazilian lead:', { phone: phoneDigits, name });
      } else {
        // É internacional
        const countryCode = phoneDigits.length > 11 ? phoneDigits.substring(0, phoneDigits.length - 10) : null;
        internationalContacts.push({
          phone: phoneDigits,
          name,
          country_code: countryCode,
          last_contact: contactDate,
        });
        console.log('[IMPORT] International contact:', { phone: phoneDigits, name, countryCode });
      }
    });

    console.log('Import summary:', {
      brazilian: brazilianLeads.length,
      international: internationalContacts.length,
      lid: lidContacts.length
    });

    let importedBR = 0;
    let importedInt = 0;
    let importedLID = 0;

    // Inserir leads brasileiros com organization_id
    if (brazilianLeads.length > 0) {
      const { error: leadsError, count } = await supabaseAdmin
        .from('leads')
        .upsert(
          brazilianLeads.map(lead => ({
            user_id: userId,
            organization_id: organizationId,
            ...lead,
            status: 'new',
            source: 'whatsapp_import',
            assigned_to: 'Sistema',
          })),
          { onConflict: 'phone,organization_id', ignoreDuplicates: true, count: 'exact' }
        );

      if (leadsError) {
        console.error('Error inserting Brazilian leads:', leadsError);
      } else {
        importedBR = count || 0;
        console.log(`Inserted ${count} Brazilian leads`);
      }
    }

    // Inserir contatos internacionais com organization_id
    if (internationalContacts.length > 0) {
      const { error: intError, count } = await supabaseAdmin
        .from('international_contacts')
        .upsert(
          internationalContacts.map(contact => ({
            user_id: userId,
            organization_id: organizationId,
            ...contact,
            source: 'whatsapp_import',
          })),
          { onConflict: 'phone,organization_id', ignoreDuplicates: true, count: 'exact' }
        );

      if (intError) {
        console.error('Error inserting international contacts:', intError);
      } else {
        importedInt = count || 0;
        console.log(`Inserted ${count} international contacts`);
      }
    }

    // Inserir contatos LID com organization_id
    if (lidContacts.length > 0) {
      const { error: lidError, count } = await supabaseAdmin
        .from('whatsapp_lid_contacts')
        .upsert(
          lidContacts.map(contact => ({
            user_id: userId,
            organization_id: organizationId,
            ...contact,
          })),
          { onConflict: 'lid,organization_id', ignoreDuplicates: true, count: 'exact' }
        );

      if (lidError) {
        console.error('Error inserting LID contacts:', lidError);
      } else {
        importedLID = count || 0;
        console.log(`Inserted ${count} LID contacts`);
      }
    }

    const totalImported = importedBR + importedInt + importedLID;
    console.log(`Successfully imported: ${totalImported} (BR: ${importedBR}, Int: ${importedInt}, LID: ${importedLID})`);

    // Salvar log de sucesso
    await supabaseClient.from('evolution_logs').insert({
      user_id: userId,
      organization_id: organizationId,
      instance: config.instance_name,
      event: 'import_success',
      level: 'info',
      message: `Importação concluída: BR=${importedBR}, Int=${importedInt}, LID=${importedLID}`,
      payload: { brazilian: importedBR, international: importedInt, lid: importedLID, startDate, endDate },
    });

    return new Response(
      JSON.stringify({
        success: true,
        imported: {
          brazilian: importedBR,
          international: importedInt,
          lid: importedLID,
          total: totalImported
        },
        message: `${totalImported} contatos importados (BR: ${importedBR}, Int: ${importedInt}, LID: ${importedLID})`
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
