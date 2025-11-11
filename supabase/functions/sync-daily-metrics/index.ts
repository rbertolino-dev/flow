import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.79.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CostConfig {
  cost_per_incoming_message: number;
  cost_per_broadcast_message: number;
  cost_per_scheduled_message: number;
  cost_per_lead_storage: number;
  cost_per_database_read: number;
  cost_per_database_write: number;
  cost_per_edge_function_call: number;
  cost_per_storage_gb: number;
  cost_per_auth_user: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Iniciando coleta de métricas diárias...');

    // Data de ontem (métricas sempre são do dia anterior)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
    const startOfDay = new Date(targetDate + 'T00:00:00Z');
    const endOfDay = new Date(targetDate + 'T23:59:59Z');

    console.log(`📅 Coletando métricas para: ${targetDate}`);

    // 1. Buscar configuração de custos
    const { data: costConfig, error: configError } = await supabase
      .from('cloud_cost_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !costConfig) {
      console.error('❌ Erro ao buscar configuração de custos:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração de custos não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config: CostConfig = costConfig as CostConfig;

    // 2. Buscar todas as organizações
    const { data: organizations, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgsError) {
      console.error('❌ Erro ao buscar organizações:', orgsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar organizações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const metrics = [];

    // 3. Coletar métricas por organização
    for (const org of organizations || []) {
      console.log(`📊 Processando organização: ${org.name}`);

      // 3.1. Mensagens recebidas (incoming)
      const { count: incomingCount } = await supabase
        .from('whatsapp_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('direction', 'incoming')
        .gte('timestamp', startOfDay.toISOString())
        .lte('timestamp', endOfDay.toISOString());

      if (incomingCount) {
        metrics.push({
          date: targetDate,
          organization_id: org.id,
          metric_type: 'incoming_messages',
          metric_value: incomingCount,
          cost_per_unit: config.cost_per_incoming_message,
          total_cost: incomingCount * config.cost_per_incoming_message
        });
      }

      // 3.2. Mensagens de broadcast enviadas
      const { count: broadcastCount } = await supabase
        .from('broadcast_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      if (broadcastCount) {
        const { data: campaigns } = await supabase
          .from('broadcast_campaigns')
          .select('organization_id')
          .in('id', 
            (await supabase
              .from('broadcast_queue')
              .select('campaign_id')
              .eq('status', 'sent')
              .gte('sent_at', startOfDay.toISOString())
              .lte('sent_at', endOfDay.toISOString())
            ).data?.map(q => q.campaign_id) || []
          );

        const orgBroadcasts = campaigns?.filter(c => c.organization_id === org.id).length || 0;

        if (orgBroadcasts > 0) {
          metrics.push({
            date: targetDate,
            organization_id: org.id,
            metric_type: 'broadcast_messages',
            metric_value: orgBroadcasts,
            cost_per_unit: config.cost_per_broadcast_message,
            total_cost: orgBroadcasts * config.cost_per_broadcast_message
          });
        }
      }

      // 3.3. Mensagens agendadas enviadas
      const { count: scheduledCount } = await supabase
        .from('scheduled_messages')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .eq('status', 'sent')
        .gte('sent_at', startOfDay.toISOString())
        .lte('sent_at', endOfDay.toISOString());

      if (scheduledCount) {
        metrics.push({
          date: targetDate,
          organization_id: org.id,
          metric_type: 'scheduled_messages',
          metric_value: scheduledCount,
          cost_per_unit: config.cost_per_scheduled_message,
          total_cost: scheduledCount * config.cost_per_scheduled_message
        });
      }

      // 3.4. Leads armazenados (snapshot do final do dia)
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .is('deleted_at', null)
        .lte('created_at', endOfDay.toISOString());

      if (leadsCount) {
        metrics.push({
          date: targetDate,
          organization_id: org.id,
          metric_type: 'leads_stored',
          metric_value: leadsCount,
          cost_per_unit: config.cost_per_lead_storage,
          total_cost: leadsCount * config.cost_per_lead_storage
        });
      }

      // 3.5. Estimativa de leituras de banco (baseado em operações)
      // Cada mensagem incoming = ~5 reads (verificar lead, update, etc)
      // Cada lead visualizado = ~3 reads
      const estimatedReads = (incomingCount || 0) * 5 + (leadsCount || 0) * 0.1; // 10% dos leads lidos por dia
      if (estimatedReads > 0) {
        metrics.push({
          date: targetDate,
          organization_id: org.id,
          metric_type: 'database_reads',
          metric_value: Math.round(estimatedReads),
          cost_per_unit: config.cost_per_database_read,
          total_cost: Math.round(estimatedReads) * config.cost_per_database_read
        });
      }

      // 3.6. Estimativa de escritas de banco
      // Cada mensagem incoming = ~2 writes (insert message, update lead)
      // Cada lead criado = ~1 write
      const { count: newLeadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', org.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      const estimatedWrites = (incomingCount || 0) * 2 + (newLeadsCount || 0);
      if (estimatedWrites > 0) {
        metrics.push({
          date: targetDate,
          organization_id: org.id,
          metric_type: 'database_writes',
          metric_value: Math.round(estimatedWrites),
          cost_per_unit: config.cost_per_database_write,
          total_cost: Math.round(estimatedWrites) * config.cost_per_database_write
        });
      }
    }

    // 3.7. Métricas globais (não por organização)
    // Usuários autenticados ativos
    const { count: authUsersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (authUsersCount) {
      metrics.push({
        date: targetDate,
        organization_id: null,
        metric_type: 'auth_users',
        metric_value: authUsersCount,
        cost_per_unit: config.cost_per_auth_user,
        total_cost: authUsersCount * config.cost_per_auth_user
      });
    }

    // 4. Salvar métricas no banco
    console.log(`💾 Salvando ${metrics.length} métricas...`);

    if (metrics.length > 0) {
      const { error: insertError } = await supabase
        .from('daily_usage_metrics')
        .insert(metrics);

      if (insertError) {
        console.error('❌ Erro ao salvar métricas:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao salvar métricas', details: insertError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('✅ Métricas coletadas e salvas com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        metricsCollected: metrics.length,
        organizations: organizations?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('💥 Erro geral:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
