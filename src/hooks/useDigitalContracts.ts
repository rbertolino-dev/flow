import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { 
  DigitalContract, 
  DigitalContractStatus, 
  DigitalAuditAction,
  isValidDigitalContractId 
} from '@/types/digital-contract';
import { useToast } from './use-toast';
import { generateContractPDF } from '@/lib/contractPdfGenerator';
// StorageService agora é obtido via StorageFactory

// Helper function para criar log de auditoria
async function createAuditLog(
  contractId: string,
  action: DigitalAuditAction,
  details?: Record<string, any>,
  oldValue?: Record<string, any>,
  newValue?: Record<string, any>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('contract_audit_log')
      .insert({
        contract_id: contractId,
        user_id: user?.id,
        action,
        details: details || {},
        old_value: oldValue,
        new_value: newValue,
      });

    if (error) {
      console.error('Erro ao criar log de auditoria:', error);
    }
  } catch (error: any) {
    console.error('Erro ao criar log de auditoria:', error);
  }
}

interface DigitalContractFilters {
  status?: DigitalContractStatus;
  lead_id?: string;
  template_id?: string;
  category_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  expires_from?: string;
  expires_to?: string;
}

export function useDigitalContracts(filters?: DigitalContractFilters) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<DigitalContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      fetchContracts();
    } else {
      setContracts([]);
      setLoading(false);
    }
  }, [activeOrgId, filters?.status, filters?.lead_id, filters?.template_id, filters?.category_id, filters?.search, filters?.date_from, filters?.date_to, filters?.expires_from, filters?.expires_to]);

  const fetchContracts = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      let query = supabase
        .from('contracts')
        .select(`
          *,
          template:contract_templates(*),
          category:contract_categories(*),
          lead:leads(id, name, phone, email, company)
        `)
        .eq('organization_id', activeOrgId)
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.lead_id && isValidDigitalContractId(filters.lead_id)) {
        query = query.eq('lead_id', filters.lead_id);
      }

      if (filters?.template_id && isValidDigitalContractId(filters.template_id)) {
        query = query.eq('template_id', filters.template_id);
      }

      if (filters?.category_id && isValidDigitalContractId(filters.category_id)) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      if (filters?.expires_from) {
        query = query.gte('expires_at', filters.expires_from);
      }

      if (filters?.expires_to) {
        query = query.lte('expires_at', filters.expires_to);
      }

      if (filters?.search) {
        query = query.or(`contract_number.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContracts((data || []) as DigitalContract[]);
    } catch (error: any) {
      console.error('Erro ao carregar contratos:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar contratos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createContract = async (contractData: {
    template_id?: string;
    lead_id: string;
    content: string;
    contract_number?: string;
    category_id?: string;
    expires_at?: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    // VALIDAÇÃO CRÍTICA DE IDs
    if (!isValidDigitalContractId(contractData.lead_id)) {
      throw new Error('Lead inválido. Selecione um lead válido.');
    }

    if (contractData.template_id && !isValidDigitalContractId(contractData.template_id)) {
      throw new Error('Template inválido. Selecione um template válido.');
    }

    if (contractData.category_id && !isValidDigitalContractId(contractData.category_id)) {
      throw new Error('Categoria inválida. Selecione uma categoria válida.');
    }

    // Validar que template existe e está ativo (se fornecido)
    if (contractData.template_id) {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('id, is_active')
        .eq('id', contractData.template_id)
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (templateError) {
        throw new Error(`Erro ao validar template: ${templateError.message}`);
      }

      if (!template) {
        throw new Error('Template não encontrado.');
      }

      if (!template.is_active) {
        throw new Error('Template selecionado está inativo. Selecione um template ativo.');
      }
    }

    // Validar que lead existe
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone, email, company')
      .eq('id', contractData.lead_id)
      .eq('organization_id', activeOrgId)
      .maybeSingle();

    if (leadError) {
      throw new Error(`Erro ao validar lead: ${leadError.message}`);
    }

    if (!lead) {
      throw new Error('Lead não encontrado.');
    }

    // Validar categoria (se fornecido)
    if (contractData.category_id) {
      const { data: category, error: categoryError } = await supabase
        .from('contract_categories')
        .select('id')
        .eq('id', contractData.category_id)
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (categoryError) {
        throw new Error(`Erro ao validar categoria: ${categoryError.message}`);
      }

      if (!category) {
        throw new Error('Categoria não encontrada.');
      }
    }

    try {
      // Gerar número do contrato (se não foi fornecido)
      let contractNumber = contractData.contract_number;
      if (!contractNumber || contractNumber.trim() === '') {
        const { data: generatedNumber, error: numberError } = await supabase.rpc(
          'generate_contract_number',
          { p_org_id: activeOrgId }
        );

        if (numberError) throw numberError;
        contractNumber = generatedNumber;
      }

      // Buscar template para pegar a folha de rosto
      let templateData = null;
      if (contractData.template_id) {
        const { data: template } = await supabase
          .from('contract_templates')
          .select('cover_page_url')
          .eq('id', contractData.template_id)
          .maybeSingle();
        templateData = template;
      }

      // Criar contrato primeiro (sem PDF ainda)
      const { data: contract, error: insertError } = await supabase
        .from('contracts')
        .insert({
          ...contractData,
          organization_id: activeOrgId,
          contract_number: contractNumber,
          status: 'draft',
        })
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .single();

      if (insertError) throw insertError;

      // Criar log de auditoria
      await createAuditLog(contract.id, 'created', {
        contract_number: contractNumber,
        lead_id: contractData.lead_id,
        template_id: contractData.template_id,
        category_id: contractData.category_id,
      });

      // Gerar PDF do contrato
      try {
        const pdfBlob = await generateContractPDF({
          content: contractData.content,
          contractNumber: contractNumber as string,
          leadName: lead?.name,
          coverPageUrl: templateData?.cover_page_url,
        });

        // Fazer upload do PDF usando StorageFactory
        const { createStorageService } = await import('@/services/contractStorage/StorageFactory');
        const storageService = await createStorageService(activeOrgId);
        const pdfUrl = await storageService.uploadPDF(pdfBlob, contract.id);

        // Atualizar contrato com URL do PDF
        const { error: updateError } = await supabase
          .from('contracts')
          .update({ pdf_url: pdfUrl })
          .eq('id', contract.id);

        if (updateError) {
          console.error('Erro ao atualizar URL do PDF:', updateError);
        }

        // Atualizar objeto local com URL do PDF
        (contract as any).pdf_url = pdfUrl;
      } catch (pdfError: any) {
        console.error('Erro ao gerar PDF:', pdfError);
        toast({
          title: 'Aviso',
          description: 'Contrato criado, mas houve um erro ao gerar o PDF. Você pode tentar gerar novamente mais tarde.',
          variant: 'default',
        });
      }

      toast({
        title: 'Contrato criado',
        description: 'Contrato criado com sucesso',
      });

      await fetchContracts();
      return contract as DigitalContract;
    } catch (error: any) {
      console.error('Erro ao criar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar contrato',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateContract = async (id: string, updates: Partial<DigitalContract>) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de contrato inválido');
    }

    try {
      // Buscar valores antigos para auditoria
      const { data: oldContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error('Contrato não encontrado');
      }

      // Criar log de auditoria
      await createAuditLog(id, 'updated', {
        updated_fields: Object.keys(updates),
      }, oldContract || undefined, updates);

      toast({
        title: 'Contrato atualizado',
        description: 'Contrato atualizado com sucesso',
      });

      await fetchContracts();
      return data as DigitalContract;
    } catch (error: any) {
      console.error('Erro ao atualizar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao atualizar contrato',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateContractStatus = async (id: string, status: DigitalContractStatus) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de contrato inválido');
    }

    // Buscar status antigo para auditoria
    const { data: oldContract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    const updates: Partial<DigitalContract> = { status };

    if (status === 'sent') {
      updates.sent_at = new Date().toISOString();
    } else if (status === 'signed') {
      updates.signed_at = new Date().toISOString();
    }

    // Criar log de auditoria específico para mudança de status
    await createAuditLog(id, 'status_changed', {
      old_status: oldContract?.status,
      new_status: status,
    }, { status: oldContract?.status }, { status });

    return updateContract(id, updates);
  };

  const deleteContract = async (id: string) => {
    if (!isValidDigitalContractId(id)) {
      throw new Error('ID de contrato inválido');
    }

    try {
      // Buscar dados do contrato antes de deletar para auditoria
      const { data: oldContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase
        .from('contracts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Criar log de auditoria
      await createAuditLog(id, 'deleted', {
        contract_number: oldContract?.contract_number,
      }, oldContract || undefined);

      toast({
        title: 'Contrato deletado',
        description: 'Contrato deletado com sucesso',
      });

      await fetchContracts();
    } catch (error: any) {
      console.error('Erro ao deletar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao deletar contrato',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const regenerateContractPDF = async (contractId: string): Promise<string> => {
    if (!activeOrgId) throw new Error('Organização não encontrada');
    if (!isValidDigitalContractId(contractId)) {
      throw new Error('ID de contrato inválido');
    }

    try {
      // Buscar contrato completo
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .eq('id', contractId)
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (contractError || !contract) {
        throw new Error('Contrato não encontrado');
      }

      // Buscar folha de rosto do template
      let coverPageUrl = contract.template?.cover_page_url;
      if (contract.template_id && !coverPageUrl) {
        const { data: templateData } = await supabase
          .from('contract_templates')
          .select('cover_page_url')
          .eq('id', contract.template_id)
          .maybeSingle();
        coverPageUrl = templateData?.cover_page_url;
      }

      // Buscar assinaturas com dados de autenticação (se houver)
      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('signer_name, signature_data, signed_at, ip_address, user_agent, signed_ip_country, validation_hash')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: true });

      // Gerar PDF com assinaturas e dados de autenticação
      const pdfBlob = await generateContractPDF({
        content: contract.content,
        contractNumber: contract.contract_number,
        leadName: contract.lead?.name,
        coverPageUrl: coverPageUrl,
        signatures: signatures?.map(sig => ({
          name: sig.signer_name,
          signatureData: sig.signature_data,
          signedAt: sig.signed_at,
          ipAddress: sig.ip_address || undefined,
          userAgent: sig.user_agent || undefined,
          signedIpCountry: sig.signed_ip_country || undefined,
          validationHash: sig.validation_hash || undefined,
        })) || [],
      });

      // Fazer upload do PDF
      const storageService = new SupabaseStorageService(activeOrgId);
      const pdfUrl = await storageService.uploadPDF(pdfBlob, contract.id);

      // Atualizar contrato com URL do PDF
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ pdf_url: pdfUrl })
        .eq('id', contract.id);

      if (updateError) {
        throw new Error(`Erro ao atualizar URL do PDF: ${updateError.message}`);
      }

      toast({
        title: 'PDF regenerado',
        description: 'PDF do contrato foi gerado com sucesso',
      });

      await fetchContracts();
      return pdfUrl;
    } catch (error: any) {
      console.error('Erro ao regenerar PDF:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao regenerar PDF do contrato',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    contracts,
    loading,
    createContract,
    updateContract,
    updateContractStatus,
    deleteContract,
    regenerateContractPDF,
    refetch: fetchContracts,
  };
}

