import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContractSignature, SignerType } from '@/types/contract';
import { useToast } from './use-toast';

export function useContractSignatures(contractId?: string) {
  const { toast } = useToast();
  const [signatures, setSignatures] = useState<ContractSignature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignatures = useCallback(async () => {
    if (!contractId) {
      setSignatures([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('📋 [useContractSignatures] Buscando assinaturas para contrato:', contractId);
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: false });

      if (error) throw error;
      const signaturesData = (data || []) as ContractSignature[];
      console.log('📋 [useContractSignatures] Assinaturas encontradas:', signaturesData.length, signaturesData.map(s => ({ type: s.signer_type, name: s.signer_name })));
      setSignatures(signaturesData);
    } catch (error: any) {
      console.error('❌ [useContractSignatures] Erro ao carregar assinaturas:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar assinaturas',
        variant: 'destructive',
      });
      // Manter assinaturas existentes em caso de erro
    } finally {
      setLoading(false);
    }
  }, [contractId, toast]);

  useEffect(() => {
    if (contractId) {
      fetchSignatures();

      // Configurar realtime para atualizar automaticamente quando nova assinatura for adicionada
      const channel = supabase
        .channel(`contract-signatures-${contractId}`)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'contract_signatures',
            filter: `contract_id=eq.${contractId}`,
          },
          (payload) => {
            console.log('🔄 Realtime: Assinatura atualizada', payload);
            // Recarregar assinaturas quando houver mudança
            fetchSignatures();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setSignatures([]);
      setLoading(false);
    }
  }, [contractId, fetchSignatures]);

  const addSignature = async (
    contractId: string,
    signerType: SignerType,
    signerName: string,
    signatureData: string // base64 PNG
  ) => {
    try {
      const { data, error } = await supabase
        .from('contract_signatures')
        .insert({
          contract_id: contractId,
          signer_type: signerType,
          signer_name: signerName,
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Assinatura adicionada',
        description: 'Assinatura adicionada com sucesso',
      });

      await fetchSignatures();
      return data as ContractSignature;
    } catch (error: any) {
      console.error('Erro ao adicionar assinatura:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao adicionar assinatura',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    signatures,
    loading,
    addSignature,
    refetch: fetchSignatures,
  };
}


