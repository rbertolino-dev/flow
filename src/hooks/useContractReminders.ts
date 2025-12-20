import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContractReminder, ReminderType, ReminderSentVia } from '@/types/contract';
import { useToast } from './use-toast';

export function useContractReminders(contractId?: string) {
  const { toast } = useToast();
  const [reminders, setReminders] = useState<ContractReminder[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReminders = useCallback(async () => {
    if (!contractId) {
      setReminders([]);
      return;
    }

    try {
      setLoading(true);
      let query = supabase
        .from('contract_reminders')
        .select('*')
        .eq('contract_id', contractId)
        .order('scheduled_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setReminders((data || []) as ContractReminder[]);
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
  }, [contractId, toast]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const createReminder = async (reminderData: {
    contract_id: string;
    reminder_type: ReminderType;
    scheduled_at: string;
    message?: string;
    sent_via?: ReminderSentVia;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('contract_reminders')
        .insert({
          ...reminderData,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      await fetchReminders();
      toast({ title: 'Sucesso', description: 'Lembrete criado com sucesso' });
      return data as ContractReminder;
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

  const updateReminder = async (reminderId: string, updates: Partial<ContractReminder>) => {
    try {
      const { data, error } = await supabase
        .from('contract_reminders')
        .update(updates)
        .eq('id', reminderId)
        .select()
        .single();

      if (error) throw error;
      await fetchReminders();
      toast({ title: 'Sucesso', description: 'Lembrete atualizado com sucesso' });
      return data as ContractReminder;
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

  const deleteReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('contract_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      await fetchReminders();
      toast({ title: 'Sucesso', description: 'Lembrete removido com sucesso' });
    } catch (error: any) {
      console.error('Erro ao remover lembrete:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao remover lembrete',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    reminders,
    loading,
    fetchReminders,
    createReminder,
    updateReminder,
    deleteReminder,
  };
}

