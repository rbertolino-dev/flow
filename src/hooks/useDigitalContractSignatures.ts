import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DigitalContractSignature, isValidDigitalContractId } from '@/types/digital-contract';
import { useToast } from './use-toast';

export function useDigitalContractSignatures(contractId: string) {
  const { toast } = useToast();
  const [signatures, setSignatures] = useState<DigitalContractSignature[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isValidDigitalContractId(contractId)) {
      fetchSignatures();
    } else {
      setSignatures([]);
      setLoading(false);
    }
  }, [contractId]);

  const fetchSignatures = async () => {
    if (!isValidDigitalContractId(contractId)) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: false });

      if (error) throw error;
      setSignatures((data || []) as DigitalContractSignature[]);
    } catch (error: any) {
      console.error('Erro ao carregar assinaturas:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar assinaturas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createSignature = async (signatureData: {
    signer_type: 'user' | 'client';
    signer_name: string;
    signature_data: string; // base64 PNG
    ip_address?: string;
    user_agent?: string;
    device_info?: Record<string, any>;
    geolocation?: Record<string, any>;
    validation_hash?: string;
    signed_ip_country?: string;
  }) => {
    if (!isValidDigitalContractId(contractId)) {
      throw new Error('ID de contrato inválido');
    }

    try {
      const { data, error } = await supabase
        .from('contract_signatures')
        .insert({
          ...signatureData,
          contract_id: contractId,
          signed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Assinatura registrada',
        description: 'Assinatura registrada com sucesso',
      });

      await fetchSignatures();
      return data as DigitalContractSignature;
    } catch (error: any) {
      console.error('Erro ao criar assinatura:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar assinatura',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    signatures,
    loading,
    createSignature,
    refetch: fetchSignatures,
  };
}

