import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContractAuditLog, AuditAction } from '@/types/contract';
import { useToast } from './use-toast';

export function useContractAuditLog(contractId?: string) {
  const { toast } = useToast();
  const [auditLogs, setAuditLogs] = useState<ContractAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    if (!contractId) {
      setAuditLogs([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_audit_log')
        .select('*')
        .eq('contract_id', contractId)
        .order('timestamp', { ascending: false })
        .limit(100); // Limitar a 100 logs mais recentes

      if (error) throw error;
      setAuditLogs((data || []) as ContractAuditLog[]);
    } catch (error: any) {
      console.error('Erro ao carregar logs de auditoria:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar logs de auditoria',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [contractId, toast]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Função helper para criar log de auditoria
  const createAuditLog = async (
    contractId: string,
    action: AuditAction,
    details?: Record<string, any>,
    oldValue?: Record<string, any>,
    newValue?: Record<string, any>
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Capturar IP e User Agent (se disponível no cliente)
      const ipAddress = (details as any)?.ip_address;
      const userAgent = (details as any)?.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined);

      const { error } = await supabase
        .from('contract_audit_log')
        .insert({
          contract_id: contractId,
          user_id: user?.id,
          action,
          details: details || {},
          old_value: oldValue,
          new_value: newValue,
          ip_address: ipAddress,
          user_agent: userAgent,
        });

      if (error) {
        console.error('Erro ao criar log de auditoria:', error);
        // Não mostrar toast para erros de auditoria (não é crítico)
      }
    } catch (error: any) {
      console.error('Erro ao criar log de auditoria:', error);
      // Não mostrar toast para erros de auditoria
    }
  };

  return {
    auditLogs,
    loading,
    fetchAuditLogs,
    createAuditLog,
  };
}

