import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DigitalContractAuditLog, isValidDigitalContractId } from '@/types/digital-contract';
import { useToast } from './use-toast';

export function useDigitalContractAuditLog(contractId: string) {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<DigitalContractAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isValidDigitalContractId(contractId)) {
      fetchAuditLogs();
    } else {
      setAuditLogs([]);
      setLoading(false);
    }
  }, [contractId]);

  const fetchAuditLogs = async () => {
    if (!isValidDigitalContractId(contractId)) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_audit_log')
        .select(`
          *,
          user:profiles(id, email, full_name)
        `)
        .eq('contract_id', contractId)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setAuditLogs((data || []) as DigitalContractAuditLog[]);
    } catch (error: any) {
      console.error('Erro ao carregar histórico de auditoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar histórico de auditoria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    auditLogs,
    loading,
    refetch: fetchAuditLogs,
  };
}

