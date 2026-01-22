import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrganization } from './useActiveOrganization';
import { Contract, ContractStatus, AuditAction } from '@/types/contract';
import { useToast } from './use-toast';
import { generateContractPDF } from '@/lib/contractPdfGenerator';
import { getSignaturePositions } from '@/lib/pdfAnnotationUtils';
// StorageService agora é obtido via StorageFactory

// Helper function para criar log de auditoria
async function createAuditLog(
  contractId: string,
  action: AuditAction,
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

interface ContractFilters {
  status?: ContractStatus;
  lead_id?: string;
  template_id?: string;
  category_id?: string; // Nova: filtro por categoria
  search?: string;
  date_from?: string; // Data de criação a partir de
  date_to?: string; // Data de criação até
  expires_from?: string; // Vencimento a partir de
  expires_to?: string; // Vencimento até
}

export function useContracts(filters?: ContractFilters) {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
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
        .is('deleted_at', null) // Apenas contratos não deletados (soft delete)
        .order('created_at', { ascending: false });
      
      // Garantir que whatsapp_message_template seja sempre selecionado
      // (já está incluído no *, mas explicitamente garantimos)

      if (filters?.status) {
        // Tratar filtros especiais
        if (filters.status === 'expiring_soon') {
          // Contratos que expiram nos próximos 7 dias
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          query = query
            .not('expires_at', 'is', null)
            .lte('expires_at', sevenDaysFromNow.toISOString())
            .gte('expires_at', new Date().toISOString());
        } else if (filters.status === 'approved') {
          // Contratos aprovados = assinados
          query = query.eq('status', 'signed');
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters?.lead_id) {
        query = query.eq('lead_id', filters.lead_id);
      }

      if (filters?.template_id) {
        query = query.eq('template_id', filters.template_id);
      }

      if (filters?.category_id) {
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
      setContracts((data || []) as Contract[]);
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
    contract_number?: string; // Opcional: se fornecido, usa esse; senão, gera automaticamente
    category_id?: string; // Nova: categoria do contrato
    expires_at?: string;
  }) => {
    if (!activeOrgId) throw new Error('Organização não encontrada');

    try {
      // Gerar número do contrato (se não foi fornecido)
      let contractNumber = contractData.contract_number;
      if (!contractNumber) {
        const { data: generatedNumber, error: numberError } = await supabase.rpc(
          'generate_contract_number',
          { p_org_id: activeOrgId }
        );

        if (numberError) throw numberError;
        contractNumber = generatedNumber;
      }

      // Buscar dados do lead e template para gerar PDF
      const { data: leadData } = await supabase
        .from('leads')
        .select('name, phone, email, company')
        .eq('id', contractData.lead_id)
        .single();

      // Buscar template para pegar a folha de rosto
      let templateData = null;
      if (contractData.template_id) {
        const { data: template } = await supabase
          .from('contract_templates')
          .select('cover_page_url')
          .eq('id', contractData.template_id)
          .single();
        templateData = template;
      }

      // Validar que content não está vazio
      if (!contractData.content || contractData.content.trim() === '') {
        console.error('❌ ERRO: content está vazio ou null!', contractData);
        throw new Error('O conteúdo do contrato não pode estar vazio. Verifique se o template tem conteúdo válido.');
      }

      console.log('📝 Criando contrato no banco:', {
        organization_id: activeOrgId,
        contract_number: contractNumber,
        content_length: contractData.content.length,
        content_preview: contractData.content.substring(0, 100) + '...',
      });

      // Criar contrato primeiro (sem PDF ainda)
      const { data: contract, error: insertError } = await supabase
        .from('contracts')
        .insert({
          ...contractData,
          organization_id: activeOrgId,
          contract_number: contractNumber,
          status: 'draft',
          content: contractData.content, // Garantir que content está presente
        })
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .single();

      if (insertError) {
        console.error('❌ Erro ao inserir contrato:', insertError);
        throw insertError;
      }
      
      console.log('✅ Contrato criado com sucesso:', contract?.id);

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
          leadName: leadData?.name,
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
          // Não falhar a criação do contrato se o PDF falhar
        }

        // Atualizar objeto local com URL do PDF
        (contract as any).pdf_url = pdfUrl;
      } catch (pdfError: any) {
        console.error('Erro ao gerar PDF:', pdfError);
        // Não falhar a criação do contrato se o PDF falhar
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
      return contract as Contract;
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

  const updateContract = async (id: string, updates: Partial<Contract>) => {
    try {
      // Buscar valores antigos para auditoria
      const { data: oldContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('contracts')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          template:contract_templates(*),
          lead:leads(id, name, phone, email, company)
        `)
        .single();

      if (error) throw error;

      // Criar log de auditoria
      await createAuditLog(id, 'updated', {
        updated_fields: Object.keys(updates),
      }, oldContract || undefined, updates);

      toast({
        title: 'Contrato atualizado',
        description: 'Contrato atualizado com sucesso',
      });

      await fetchContracts();
      return data as Contract;
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

  const updateContractStatus = async (id: string, status: ContractStatus) => {
    // Buscar status antigo para auditoria
    const { data: oldContract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', id)
      .single();

    const updates: Partial<Contract> = { status };

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
    try {
      // Buscar dados do contrato antes de deletar para auditoria
      const { data: oldContract } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .single();

      if (!oldContract) {
        throw new Error('Contrato não encontrado');
      }

      // Obter usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Soft delete: atualizar deleted_at e deleted_by ao invés de deletar
      const { error } = await supabase
        .from('contracts')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', id);

      if (error) throw error;

      // Criar log de auditoria com informações completas
      await createAuditLog(id, 'deleted', {
        contract_number: oldContract?.contract_number,
        deleted_by: user.id,
        deleted_at: new Date().toISOString(),
        organization_id: oldContract?.organization_id,
      }, oldContract || undefined);

      toast({
        title: 'Contrato excluído',
        description: 'Contrato excluído com sucesso. Você pode visualizar o histórico de exclusões.',
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
        .single();

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
          .single();
        coverPageUrl = templateData?.cover_page_url;
      }

      // Buscar assinaturas com dados de autenticação (se houver)
      const { data: signatures } = await supabase
        .from('contract_signatures')
        .select('signer_name, signature_data, signed_at, signer_type, ip_address, user_agent, signed_ip_country, validation_hash')
        .eq('contract_id', contractId)
        .order('signed_at', { ascending: true });

      // Buscar posições de assinatura definidas no builder (se houver)
      const signaturePositions = await getSignaturePositions(contractId);

      // Buscar dados completos da organização para o PDF
      let organizationData: any = null;
      if (activeOrgId) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('name, logo_url, address, company_profile, city, state, cnpj, phone, contact_email')
          .eq('id', activeOrgId)
          .single();
        
        if (orgData) {
          organizationData = {
            name: orgData.name,
            logo_url: orgData.logo_url,
            address: orgData.address,
            company_profile: orgData.company_profile,
            city: orgData.city,
            state: orgData.state,
            cnpj: orgData.cnpj,
            phone: orgData.phone,
            contact_email: orgData.contact_email,
          };
        }
      }

      // Gerar PDF com assinaturas e dados de autenticação
      const pdfBlob = await generateContractPDF({
        content: contract.content,
        contractNumber: contract.contract_number,
        leadName: contract.lead?.name,
        coverPageUrl: coverPageUrl,
        organizationData,
        signatures: signatures?.map(sig => ({
          name: sig.signer_name,
          signatureData: sig.signature_data,
          signedAt: sig.signed_at,
          signerType: sig.signer_type as 'user' | 'client',
          ipAddress: sig.ip_address || undefined,
          userAgent: sig.user_agent || undefined,
          signedIpCountry: sig.signed_ip_country || undefined,
          validationHash: sig.validation_hash || undefined,
        })) || [],
        signaturePositions: signaturePositions.length > 0 ? signaturePositions.map(pos => ({
          signerType: pos.signer_type,
          pageNumber: pos.page_number,
          x: pos.x_position,
          y: pos.y_position,
          width: pos.width,
          height: pos.height,
        })) : undefined,
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
