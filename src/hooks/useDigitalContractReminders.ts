import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DigitalContractReminder, DigitalReminderType, DigitalReminderSentVia, isValidDigitalContractId } from '@/types/digital-contract';
import { useToast } from './use-toast';

export function useDigitalContractReminders(contractId: string) {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<DigitalContractReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isValidDigitalContractId(contractId)) {
      fetchReminders();
    } else {
      setReminders([]);
      setLoading(false);
    }
  }, [contractId]);

  const fetchReminders = async () => {
    if (!isValidDigitalContractId(contractId)) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_reminders')
        .select('*')
        .eq('contract_id', contractId)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setReminders((data || []) as DigitalContractReminder[]);
    } catch (error: any) {
      console.error('Erro ao carregar lembretes:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar lembretes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createReminder = async (reminderData: {
    reminder_type: DigitalReminderType;
    scheduled_at: string;
    message?: string;
    sent_via?: DigitalReminderSentVia;
  }) => {
    if (!isValidDigitalContractId(contractId)) {
      throw new Error('ID de contrato inválido');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('contract_reminders')
        .insert({
          ...reminderData,
          contract_id: contractId,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Lembrete criado',
        description: 'Lembrete criado com sucesso',
      });

      await fetchReminders();
      return data as DigitalContractReminder;
    } catch (error: any) {
      console.error('Erro ao criar lembrete:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar lembrete',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateReminder = async (id: string, updates: Partial<DigitalContractReminder>) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de lembrete inválido');
    }

    // Não permitir editar se já foi enviado
    const reminder = reminders.find(r => r.id === id);
    if (reminder?.sent_at) {
      throw new Error('Não é possível editar um lembrete que já foi enviado');
    }

    try {
      const { data, error } = await supabase
        .from('contract_reminders')
        .update(updates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Lembrete não encontrado');
      }

      toast({
        title: 'Lembrete atualizado',
        description: 'Lembrete atualizado com sucesso',
      });

      await fetchReminders();
      return data as DigitalContractReminder;
    } catch (error: any) {
      console.error('Erro ao atualizar lembrete:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar lembrete',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteReminder = async (id: string) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de lembrete inválido');
    }

    try {
      const { error } = await supabase
        .from('contract_reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Lembrete deletado',
        description: 'Lembrete deletado com sucesso',
      });

      await fetchReminders();
    } catch (error: any) {
      console.error('Erro ao deletar lembrete:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao deletar lembrete',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    reminders,
    loading,
    createReminder,
    updateReminder,
    deleteReminder,
    refetch: fetchReminders,
  };
}

