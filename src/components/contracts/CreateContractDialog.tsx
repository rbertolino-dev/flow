import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { useContracts } from '@/hooks/useContracts';
import { useLeads } from '@/hooks/useLeads';
import { useContractCategories } from '@/hooks/useContractCategories';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';

interface CreateContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultLeadId?: string;
}

export function CreateContractDialog({
  open,
  onOpenChange,
  onSuccess,
  defaultLeadId,
}: CreateContractDialogProps) {
  const { templates, loading: templatesLoading } = useContractTemplates();
  const { createContract } = useContracts();
  const { leads, loading: leadsLoading } = useLeads();
  const { categories } = useContractCategories();
  const { toast } = useToast();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(defaultLeadId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (defaultLeadId) {
        setSelectedLeadId(defaultLeadId);
      } else {
        setSelectedLeadId('');
      }
      setSelectedTemplateId('');
      setSelectedCategoryId('');
      setContractNumber('');
      setExpiresAt(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
    }
  }, [open, defaultLeadId]);

  if (!open) return null;

  const generateContent = (template: any, lead: any): string => {
    console.log('🔵 generateContent chamado:', { template: template?.id, lead: lead?.id });
    
    if (!template || !lead) {
      console.error('❌ Template ou Lead não fornecido:', { template: !!template, lead: !!lead });
      return '';
    }
    
    // Verificar se template tem conteúdo
    if (!template.content || template.content.trim() === '') {
      console.error('❌ Template não tem conteúdo:', template);
      // Retornar conteúdo padrão se template estiver vazio
      return `CONTRATO\n\nEntre ${lead.name || 'Cliente'} e a empresa, fica estabelecido o seguinte contrato.\n\nData: ${format(new Date(), 'dd/MM/yyyy')}\n\nValidade: ${expiresAt ? format(new Date(expiresAt), 'dd/MM/yyyy') : 'Não especificada'}`;
    }
    
    let content = template.content;
    console.log('📝 Conteúdo original do template:', content.substring(0, 100) + '...');
    
    // Substituir variáveis do template
    content = content.replace(/\{\{nome\}\}/g, lead.name || '');
    content = content.replace(/\{\{telefone\}\}/g, lead.phone || '');
    content = content.replace(/\{\{email\}\}/g, lead.email || '');
    content = content.replace(/\{\{empresa\}\}/g, lead.company || '');
    content = content.replace(/\{\{valor\}\}/g, lead.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lead.value) : '');
    content = content.replace(/\{\{data_hoje\}\}/g, format(new Date(), 'dd/MM/yyyy'));
    content = content.replace(/\{\{data_vencimento\}\}/g, expiresAt ? format(new Date(expiresAt), 'dd/MM/yyyy') : '');
    content = content.replace(/\{\{numero_contrato\}\}/g, contractNumber || 'XXX-YYYYMMDD-XXXX');
    content = content.replace(/\{\{etapa_funil\}\}/g, lead.status || '');
    content = content.replace(/\{\{produto\}\}/g, lead.product?.name || '');
    
    console.log('✅ Conteúdo gerado:', content.substring(0, 100) + '...');
    return content;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplateId || !selectedLeadId) {
      toast({
        title: 'Erro',
        description: 'Template e Lead são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    // Buscar template e lead selecionados
    const template = templates.find((t) => t.id === selectedTemplateId);
    const lead = leads.find((l) => l.id === selectedLeadId);

    console.log('🔵 Criando contrato:', {
      selectedTemplateId,
      selectedLeadId,
      templateFound: !!template,
      leadFound: !!lead,
      templateContent: template?.content ? template.content.substring(0, 50) + '...' : 'VAZIO',
    });

    if (!template || !lead) {
      console.error('❌ Template ou Lead não encontrado:', { template: !!template, lead: !!lead });
      toast({
        title: 'Erro',
        description: 'Template ou Lead não encontrado',
        variant: 'destructive',
      });
      return;
    }

    // Gerar conteúdo do contrato
    const content = generateContent(template, lead);

    if (!content || content.trim() === '') {
      console.error('❌ Conteúdo gerado está vazio!');
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o conteúdo do contrato. Verifique se o template tem conteúdo válido.',
        variant: 'destructive',
      });
      return;
    }

    console.log('✅ Enviando contrato com content:', content.substring(0, 100) + '...');

    setSubmitting(true);
    try {
      const contractData = {
        template_id: selectedTemplateId,
        lead_id: selectedLeadId,
        content: content, // ✅ Campo content obrigatório
        contract_number: contractNumber || undefined,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        category_id: selectedCategoryId || undefined,
      };
      
      console.log('📤 Dados do contrato:', {
        ...contractData,
        content: contractData.content.substring(0, 50) + '...',
      });
      
      await createContract(contractData);

      toast({
        title: 'Sucesso',
        description: 'Contrato criado com sucesso',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar contrato',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const validTemplates = templates.filter((t) => t.is_active && t.id && t.id.trim() !== '');
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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
              <option value="">{templatesLoading ? 'Carregando...' : 'Selecione um template'}</option>
              {validTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

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
            disabled={submitting || !selectedTemplateId || !selectedLeadId}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Contrato
          </Button>
        </div>
      </div>
    </div>
  );
}
