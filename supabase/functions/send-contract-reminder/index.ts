import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role key (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar lembretes que devem ser enviados agora
    const now = new Date().toISOString();
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: reminders, error: remindersError } = await supabase
      .from('contract_reminders')
      .select(`
        *,
        contract:contracts(
          id,
          contract_number,
          status,
          lead:leads(id, name, phone, email),
          organization_id
        )
      `)
      .eq('sent_at', null) // Apenas lembretes não enviados
      .gte('scheduled_at', now) // Agendado para agora ou no passado
      .lte('scheduled_at', fiveMinutesFromNow) // Mas não mais de 5 minutos no futuro
      .limit(50); // Processar até 50 por vez

    if (remindersError) {
      console.error('Erro ao buscar lembretes:', remindersError);
      throw remindersError;
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum lembrete para enviar', processed: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let processed = 0;
    let errors = 0;

    // Processar cada lembrete
    for (const reminder of reminders) {
      try {
        const contract = reminder.contract as any;
        if (!contract) {
          console.error('Contrato não encontrado para lembrete:', reminder.id);
          continue;
        }

        // Verificar se contrato ainda está ativo
        if (contract.status === 'cancelled' || contract.status === 'expired') {
          // Marcar lembrete como enviado (mas não enviar)
          await supabase
            .from('contract_reminders')
            .update({ sent_at: now })
            .eq('id', reminder.id);
          continue;
        }

        let sent = false;

        // Enviar baseado no tipo de envio
        switch (reminder.sent_via) {
          case 'whatsapp':
            sent = await sendWhatsAppReminder(reminder, contract, supabase);
            break;
          case 'email':
            sent = await sendEmailReminder(reminder, contract, supabase);
            break;
          case 'sms':
            // SMS pode ser implementado via API específica
            console.log('SMS não implementado ainda para lembrete:', reminder.id);
            break;
          case 'system':
            // Sistema: apenas criar notificação interna
            sent = await createSystemNotification(reminder, contract, supabase);
            break;
        }

        if (sent) {
          // Marcar como enviado
          await supabase
            .from('contract_reminders')
            .update({ sent_at: now })
            .eq('id', reminder.id);

          // Criar log de auditoria
          await supabase.from('contract_audit_log').insert({
            contract_id: contract.id,
            action: 'reminder_sent',
            details: {
              reminder_id: reminder.id,
              reminder_type: reminder.reminder_type,
              sent_via: reminder.sent_via,
            },
          });

          processed++;
        } else {
          errors++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar lembrete ${reminder.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Lembretes processados',
        processed,
        errors,
        total: reminders.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar lembretes' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function sendWhatsAppReminder(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    const lead = contract.lead;
    if (!lead || !lead.phone) {
      console.error('Lead sem telefone para lembrete:', reminder.id);
      return false;
    }

    // Buscar instância Evolution conectada da organização
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('instance_id, api_key, api_url')
      .eq('organization_id', contract.organization_id)
      .eq('is_connected', true)
      .limit(1)
      .single();

    if (!evolutionConfig) {
      console.error('Nenhuma instância Evolution conectada para organização:', contract.organization_id);
      return false;
    }

    // Construir mensagem
    const message = reminder.message || buildDefaultReminderMessage(reminder, contract);

    // Enviar via Evolution API
    const evolutionUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_id}`;
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key,
      },
      body: JSON.stringify({
        number: lead.phone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar WhatsApp:', errorText);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Erro ao enviar lembrete WhatsApp:', error);
    return false;
  }
}

async function sendEmailReminder(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    const lead = contract.lead;
    if (!lead || !lead.email) {
      console.error('Lead sem email para lembrete:', reminder.id);
      return false;
    }

    // Usar Supabase Edge Function de email (se disponível)
    // Ou integrar com serviço de email externo
    const message = reminder.message || buildDefaultReminderMessage(reminder, contract);

    // Por enquanto, apenas logar (implementar integração de email depois)
    console.log('Email não implementado ainda. Mensagem seria:', message);
    return false; // Retornar false até implementar
  } catch (error: any) {
    console.error('Erro ao enviar lembrete email:', error);
    return false;
  }
}

async function createSystemNotification(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    // Criar notificação no sistema (se tiver tabela de notificações)
    // Por enquanto, apenas retornar true (lembrete processado)
    return true;
  } catch (error: any) {
    console.error('Erro ao criar notificação:', error);
    return false;
  }
}

function buildDefaultReminderMessage(reminder: any, contract: any): string {
  const lead = contract.lead;
  const contractNumber = contract.contract_number;

  switch (reminder.reminder_type) {
    case 'signature_due':
      return `Olá ${lead?.name || 'Cliente'}! Lembramos que o contrato ${contractNumber} está aguardando sua assinatura. Por favor, acesse o link de assinatura para finalizar.`;
    case 'expiration_approaching':
      return `Olá ${lead?.name || 'Cliente'}! O contrato ${contractNumber} está próximo do vencimento. Entre em contato conosco para renovação.`;
    case 'follow_up':
      return `Olá ${lead?.name || 'Cliente'}! Seguindo sobre o contrato ${contractNumber}. Como podemos ajudar?`;
    case 'custom':
      return `Olá ${lead?.name || 'Cliente'}! Lembrete sobre o contrato ${contractNumber}.`;
    default:
      return `Olá ${lead?.name || 'Cliente'}! Lembrete sobre o contrato ${contractNumber}.`;
  }
}


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role key (bypass RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar lembretes que devem ser enviados agora
    const now = new Date().toISOString();
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: reminders, error: remindersError } = await supabase
      .from('contract_reminders')
      .select(`
        *,
        contract:contracts(
          id,
          contract_number,
          status,
          lead:leads(id, name, phone, email),
          organization_id
        )
      `)
      .eq('sent_at', null) // Apenas lembretes não enviados
      .gte('scheduled_at', now) // Agendado para agora ou no passado
      .lte('scheduled_at', fiveMinutesFromNow) // Mas não mais de 5 minutos no futuro
      .limit(50); // Processar até 50 por vez

    if (remindersError) {
      console.error('Erro ao buscar lembretes:', remindersError);
      throw remindersError;
    }

    if (!reminders || reminders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum lembrete para enviar', processed: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let processed = 0;
    let errors = 0;

    // Processar cada lembrete
    for (const reminder of reminders) {
      try {
        const contract = reminder.contract as any;
        if (!contract) {
          console.error('Contrato não encontrado para lembrete:', reminder.id);
          continue;
        }

        // Verificar se contrato ainda está ativo
        if (contract.status === 'cancelled' || contract.status === 'expired') {
          // Marcar lembrete como enviado (mas não enviar)
          await supabase
            .from('contract_reminders')
            .update({ sent_at: now })
            .eq('id', reminder.id);
          continue;
        }

        let sent = false;

        // Enviar baseado no tipo de envio
        switch (reminder.sent_via) {
          case 'whatsapp':
            sent = await sendWhatsAppReminder(reminder, contract, supabase);
            break;
          case 'email':
            sent = await sendEmailReminder(reminder, contract, supabase);
            break;
          case 'sms':
            // SMS pode ser implementado via API específica
            console.log('SMS não implementado ainda para lembrete:', reminder.id);
            break;
          case 'system':
            // Sistema: apenas criar notificação interna
            sent = await createSystemNotification(reminder, contract, supabase);
            break;
        }

        if (sent) {
          // Marcar como enviado
          await supabase
            .from('contract_reminders')
            .update({ sent_at: now })
            .eq('id', reminder.id);

          // Criar log de auditoria
          await supabase.from('contract_audit_log').insert({
            contract_id: contract.id,
            action: 'reminder_sent',
            details: {
              reminder_id: reminder.id,
              reminder_type: reminder.reminder_type,
              sent_via: reminder.sent_via,
            },
          });

          processed++;
        } else {
          errors++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar lembrete ${reminder.id}:`, error);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Lembretes processados',
        processed,
        errors,
        total: reminders.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar lembretes' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function sendWhatsAppReminder(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    const lead = contract.lead;
    if (!lead || !lead.phone) {
      console.error('Lead sem telefone para lembrete:', reminder.id);
      return false;
    }

    // Buscar instância Evolution conectada da organização
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('instance_id, api_key, api_url')
      .eq('organization_id', contract.organization_id)
      .eq('is_connected', true)
      .limit(1)
      .single();

    if (!evolutionConfig) {
      console.error('Nenhuma instância Evolution conectada para organização:', contract.organization_id);
      return false;
    }

    // Construir mensagem
    const message = reminder.message || buildDefaultReminderMessage(reminder, contract);

    // Enviar via Evolution API
    const evolutionUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_id}`;
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key,
      },
      body: JSON.stringify({
        number: lead.phone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar WhatsApp:', errorText);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('Erro ao enviar lembrete WhatsApp:', error);
    return false;
  }
}

async function sendEmailReminder(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    const lead = contract.lead;
    if (!lead || !lead.email) {
      console.error('Lead sem email para lembrete:', reminder.id);
      return false;
    }

    // Usar Supabase Edge Function de email (se disponível)
    // Ou integrar com serviço de email externo
    const message = reminder.message || buildDefaultReminderMessage(reminder, contract);

    // Por enquanto, apenas logar (implementar integração de email depois)
    console.log('Email não implementado ainda. Mensagem seria:', message);
    return false; // Retornar false até implementar
  } catch (error: any) {
    console.error('Erro ao enviar lembrete email:', error);
    return false;
  }
}

async function createSystemNotification(reminder: any, contract: any, supabase: any): Promise<boolean> {
  try {
    // Criar notificação no sistema (se tiver tabela de notificações)
    // Por enquanto, apenas retornar true (lembrete processado)
    return true;
  } catch (error: any) {
    console.error('Erro ao criar notificação:', error);
    return false;
  }
}

function buildDefaultReminderMessage(reminder: any, contract: any): string {
  const lead = contract.lead;
  const contractNumber = contract.contract_number;

  switch (reminder.reminder_type) {
    case 'signature_due':
      return `Olá ${lead?.name || 'Cliente'}! Lembramos que o contrato ${contractNumber} está aguardando sua assinatura. Por favor, acesse o link de assinatura para finalizar.`;
    case 'expiration_approaching':
      return `Olá ${lead?.name || 'Cliente'}! O contrato ${contractNumber} está próximo do vencimento. Entre em contato conosco para renovação.`;
    case 'follow_up':
      return `Olá ${lead?.name || 'Cliente'}! Seguindo sobre o contrato ${contractNumber}. Como podemos ajudar?`;
    case 'custom':
      return `Olá ${lead?.name || 'Cliente'}! Lembrete sobre o contrato ${contractNumber}.`;
    default:
      return `Olá ${lead?.name || 'Cliente'}! Lembrete sobre o contrato ${contractNumber}.`;
  }
}













