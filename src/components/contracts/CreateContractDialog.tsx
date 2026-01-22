import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { useContracts } from '@/hooks/useContracts';
import { useLeads } from '@/hooks/useLeads';
import { useContractCategories } from '@/hooks/useContractCategories';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, FileText, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TestVersionBadge, TestVersionBanner } from '@/components/shared/TestVersionBadge';

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (contractId?: string, isPdfUpload?: boolean) => void;
  defaultLeadId?: string;
}

type CreationMode = 'template' | 'upload';

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultLeadId,
}: CreateContractDialogProps) {
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useContractTemplates();
  const { createContract } = useContracts();
  const { leads, loading: leadsLoading } = useLeads();
  const { categories, fetchCategories } = useContractCategories();
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();

  const [creationMode, setCreationMode] = useState<CreationMode>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(defaultLeadId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [submitting, setSubmitting] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    if (open) {
      // Refetch templates e categorias quando abrir o dialog para pegar os mais recentes
      // Aguardar refetch para garantir que dados estejam atualizados
      let isMounted = true;
      
      const refreshData = async () => {
        try {
          await Promise.all([
            refetchTemplates(),
            fetchCategories(),
          ]);
          if (isMounted) {
            console.log('[CreateContractDialog] Templates e categorias atualizados após refetch');
          }
        } catch (error) {
          if (isMounted) {
            console.error('[CreateContractDialog] Erro ao atualizar templates/categorias:', error);
          }
        }
      };
      refreshData();
      
      if (defaultLeadId) {
        setSelectedLeadId(defaultLeadId);
      } else {
        setSelectedLeadId('');
      }
      setCreationMode('template');
      setSelectedTemplateId('');
      setSelectedCategoryId('');
      setContractNumber('');
      setExpiresAt(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
      setPdfFile(null);
      
      return () => {
        isMounted = false;
      };
    }
  }, [open, defaultLeadId]); // Removido refetchTemplates e fetchCategories das dependências para evitar loops

  if (!open) return null;

  const generateContent = async (template: any, lead: any): Promise<string> => {
    if (!template || !lead) {
      return '';
    }
    
    if (!template.content || template.content.trim() === '') {
      return `CONTRATO\n\nEntre ${lead.name || 'Cliente'} e a empresa, fica estabelecido o seguinte contrato.\n\nData: ${format(new Date(), 'dd/MM/yyyy')}\n\nValidade: ${expiresAt ? format(new Date(expiresAt), 'dd/MM/yyyy') : 'Não especificada'}`;
    }
    
    // Buscar dados da organização (remetente)
    let organizationData: any = null;
    if (activeOrgId) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name, address, city, state, company_profile, tax_regime, business_type, tagline, social_media')
        .eq('id', activeOrgId)
        .single();
      organizationData = orgData;
    }

    // Parse social_media se for string
    let socialMedia: any = {};
    if (organizationData?.social_media) {
      if (typeof organizationData.social_media === 'string') {
        try {
          socialMedia = JSON.parse(organizationData.social_media);
        } catch {
          socialMedia = {};
        }
      } else {
        socialMedia = organizationData.social_media;
      }
    }
    
    let content = template.content;
    
    // Substituir tags do DESTINATÁRIO (Cliente/Lead)
    content = content.replace(/\{\{nome\}\}/g, lead.name || '');
    content = content.replace(/\{\{telefone\}\}/g, lead.phone || '');
    content = content.replace(/\{\{email\}\}/g, lead.email || '');
    content = content.replace(/\{\{empresa\}\}/g, lead.company || '');
    content = content.replace(/\{\{cpf_cnpj\}\}/g, lead.cpf_cnpj || '');
    content = content.replace(/\{\{valor\}\}/g, lead.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value) : '');
    content = content.replace(/\{\{etapa_funil\}\}/g, lead.status || '');
    content = content.replace(/\{\{status\}\}/g, lead.status || '');
    content = content.replace(/\{\{produto\}\}/g, lead.product?.name || '');
    content = content.replace(/\{\{origem\}\}/g, lead.source || '');
    content = content.replace(/\{\{notas\}\}/g, lead.notes || '');
    content = content.replace(/\{\{data_criacao\}\}/g, lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yyyy') : '');
    content = content.replace(/\{\{ultimo_contato\}\}/g, lead.last_contact ? format(new Date(lead.last_contact), 'dd/MM/yyyy') : '');
    
    // Substituir tags do REMETENTE (Empresa/Organização)
    content = content.replace(/\{\{empresa_nome\}\}/g, organizationData?.name || '');
    content = content.replace(/\{\{empresa_endereco\}\}/g, organizationData?.address || '');
    content = content.replace(/\{\{empresa_cidade\}\}/g, organizationData?.city || '');
    content = content.replace(/\{\{empresa_estado\}\}/g, organizationData?.state || '');
    content = content.replace(/\{\{empresa_perfil\}\}/g, organizationData?.company_profile || '');
    content = content.replace(/\{\{empresa_regime_tributario\}\}/g, organizationData?.tax_regime || '');
    content = content.replace(/\{\{empresa_tipo_negocio\}\}/g, organizationData?.business_type || '');
    content = content.replace(/\{\{empresa_tagline\}\}/g, organizationData?.tagline || '');
    content = content.replace(/\{\{empresa_instagram\}\}/g, socialMedia?.instagram || '');
    content = content.replace(/\{\{empresa_facebook\}\}/g, socialMedia?.facebook || '');
    content = content.replace(/\{\{empresa_linkedin\}\}/g, socialMedia?.linkedin || '');
    content = content.replace(/\{\{empresa_twitter\}\}/g, socialMedia?.twitter || '');
    content = content.replace(/\{\{empresa_youtube\}\}/g, socialMedia?.youtube || '');
    content = content.replace(/\{\{empresa_website\}\}/g, socialMedia?.website || '');
    
    // Substituir tags GERAIS
    content = content.replace(/\{\{data_hoje\}\}/g, format(new Date(), 'dd/MM/yyyy'));
    content = content.replace(/\{\{data_vencimento\}\}/g, expiresAt ? format(new Date(expiresAt), 'dd/MM/yyyy') : '');
    content = content.replace(/\{\{numero_contrato\}\}/g, contractNumber || 'XXX-YYYYMMDD-XXXX');
    
    return content;
  };

  const handlePdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo PDF',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O PDF deve ter no máximo 10MB',
        variant: 'destructive',
      });
      return;
    }

    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLeadId) {
      toast({
        title: 'Erro',
        description: 'Lead/Cliente é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (creationMode === 'template' && !selectedTemplateId) {
      toast({
        title: 'Erro',
        description: 'Template é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (creationMode === 'upload' && !pdfFile) {
      toast({
        title: 'Erro',
        description: 'Por favor, faça upload do PDF',
        variant: 'destructive',
      });
      return;
    }

    const lead = leads.find((l) => l.id === selectedLeadId);
    if (!lead) {
      toast({
        title: 'Erro',
        description: 'Lead não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    setUploadingPdf(creationMode === 'upload');
    
    try {
      let content = '';
      let pdfUrl: string | undefined = undefined;

      if (creationMode === 'template') {
        const template = templates.find((t) => t.id === selectedTemplateId);
        if (!template) {
          throw new Error('Template não encontrado');
        }
        content = await generateContent(template, lead);
      } else {
        // Modo upload: fazer upload do PDF e criar contrato
        if (!activeOrgId) {
          throw new Error('Organização não selecionada');
        }

        const fileExt = pdfFile!.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        // Path correto: organizationId/contracts/filename.pdf (sem duplicar "contracts")
        const filePath = `${activeOrgId}/contracts/${fileName}`;
        const BUCKET_ID = 'whatsapp-workflow-media'; // Bucket correto conforme SupabaseStorageService

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_ID)
          .upload(filePath, pdfFile!, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/pdf',
          });

        if (uploadError) {
          console.error('Erro no upload:', uploadError);
          throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_ID)
          .getPublicUrl(filePath);

        pdfUrl = publicUrl;
        content = `Contrato em PDF: ${lead.name || 'Cliente'}\n\nArquivo: ${pdfFile!.name}\n\nData: ${format(new Date(), 'dd/MM/yyyy')}`;
      }

      if (!content || content.trim() === '') {
        throw new Error('Não foi possível gerar o conteúdo do contrato');
      }

      const contractData = {
        template_id: creationMode === 'template' ? selectedTemplateId : undefined,
        lead_id: selectedLeadId,
        content: content,
        contract_number: contractNumber || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        category_id: selectedCategoryId || undefined,
        pdf_url: pdfUrl,
      };
      
      const newContract = await createContract(contractData);

      // Atualizar categorias imediatamente após criar contrato
      // Isso garante que a contagem seja atualizada mesmo se realtime não funcionar
      try {
        await fetchCategories();
        console.log('[CreateContractDialog] Categorias atualizadas após criar contrato');
      } catch (error) {
        console.error('[CreateContractDialog] Erro ao atualizar categorias:', error);
        // Não bloquear o fluxo se falhar
      }

      toast({
        title: 'Sucesso',
        description: 'Contrato criado com sucesso',
      });

      // Se foi upload de PDF, passar o ID do contrato para abrir builder de assinaturas
      if (creationMode === 'upload' && newContract?.id) {
        toast({
          title: 'Próximo passo',
          description: 'Configure as posições de assinatura no PDF',
        });
        onSuccess?.(newContract.id, true);
        onOpenChange(false);
        return;
      }

      onSuccess?.(newContract?.id, false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar contrato',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      setUploadingPdf(false);
    }
  };

  // Filtrar templates válidos: is_active pode ser true, null ou undefined (tratar null/undefined como true)
  // Isso garante que templates recém-criados apareçam mesmo se is_active não estiver definido
  const validTemplates = templates.filter((t) => {
    if (!t.id || t.id.trim() === '') return false;
    // Se is_active é null, undefined ou true, considerar como ativo
    // Apenas filtrar se is_active for explicitamente false
    return t.is_active !== false;
  });
  const validLeads = leads.filter((l) => l.id && l.id.trim() !== '');
  const validCategories = (categories || []).filter((c) => c.id && c.id.trim() !== '');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Criar Novo Contrato</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Seleção do modo de criação */}
          <div className="space-y-3">
            <Label>Como deseja criar o contrato? *</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCreationMode('template')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  creationMode === 'template'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className={`w-8 h-8 mx-auto mb-2 ${creationMode === 'template' ? 'text-primary' : 'text-gray-400'}`} />
                <div className="font-semibold">Usar Template</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Criar a partir de um template existente
                </div>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('upload')}
                className={`p-4 border-2 rounded-lg transition-all relative ${
                  creationMode === 'upload'
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="absolute top-2 right-2">
                  <TestVersionBadge size="sm" />
                </div>
                <Upload className={`w-8 h-8 mx-auto mb-2 ${creationMode === 'upload' ? 'text-primary' : 'text-gray-400'}`} />
                <div className="font-semibold">Upload de PDF</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Fazer upload de PDF e adicionar assinaturas
                </div>
              </button>
            </div>
          </div>

          {/* Opções específicas do modo template */}
          {creationMode === 'template' && (
            <div className="space-y-2">
              <Label htmlFor="template">Template *</Label>
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                disabled={templatesLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">
                  {templatesLoading 
                    ? 'Carregando templates...' 
                    : validTemplates.length === 0 
                      ? 'Nenhum template disponível' 
                      : 'Selecione um template'}
                </option>
                {validTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {!templatesLoading && validTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Nenhum template encontrado. Crie um template primeiro.
                </p>
              )}
            </div>
          )}

          {/* Opções específicas do modo upload */}
          {creationMode === 'upload' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="pdf-upload">Arquivo PDF *</Label>
                <TestVersionBadge size="sm" />
              </div>
              <TestVersionBanner 
                message="Esta funcionalidade está em versão de teste. Pode conter inconsistências e está sujeita a mudanças."
                className="mb-2"
              />
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                {pdfFile ? (
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-primary" />
                    <p className="font-medium">{pdfFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfFile(null)}
                    >
                      Trocar arquivo
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <Label htmlFor="pdf-upload" className="cursor-pointer">
                      <Button variant="outline" type="button" asChild>
                        <span>
                          <Upload className="w-4 h-4 mr-2" />
                          Fazer Upload do PDF
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="pdf-upload"
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePdfUpload(file);
                      }}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Tamanho máximo: 10MB
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Campos comuns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead">Lead/Cliente *</Label>
              <select
                id="lead"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                disabled={leadsLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">{leadsLoading ? 'Carregando...' : 'Selecione um lead'}</option>
                {validLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} - {lead.phone || 'Sem telefone'}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-number">Número do Contrato</Label>
              <Input
                id="contract-number"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Gerar automaticamente"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria (opcional)</Label>
            <select
              id="category"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Selecione uma categoria</option>
              {validCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires-at">Data de Vigência</Label>
            <Input
              id="expires-at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
            />
          </div>
        </form>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={submitting || !selectedLeadId || (creationMode === 'template' && !selectedTemplateId) || (creationMode === 'upload' && !pdfFile)}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {creationMode === 'upload' && uploadingPdf ? 'Fazendo upload...' : 'Criar Contrato'}
          </Button>
        </div>
      </div>
    </div>
  );
}
