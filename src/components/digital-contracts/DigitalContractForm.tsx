import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useDigitalContracts } from '@/hooks/useDigitalContracts';
import { useDigitalContractTemplates } from '@/hooks/useDigitalContractTemplates';
import { useDigitalContractCategories } from '@/hooks/useDigitalContractCategories';
import { useLeads } from '@/hooks/useLeads';
import { isValidDigitalContractId } from '@/types/digital-contract';
import { format, addDays } from 'date-fns';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DigitalContractFormProps {
  defaultLeadId?: string;
}

export function DigitalContractForm({ defaultLeadId }: DigitalContractFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createContract } = useDigitalContracts();
  const { templates, loading: templatesLoading } = useDigitalContractTemplates();
  const { categories, loading: categoriesLoading } = useDigitalContractCategories();
  const { leads, loading: leadsLoading } = useLeads();

  const [templateId, setTemplateId] = useState<string>('');
  const [leadId, setLeadId] = useState<string>(defaultLeadId || '');
  const [categoryId, setCategoryId] = useState<string>('');
  const [contractNumber, setContractNumber] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Validação de IDs
  const [templateError, setTemplateError] = useState<string>('');
  const [leadError, setLeadError] = useState<string>('');
  const [categoryError, setCategoryError] = useState<string>('');

  useEffect(() => {
    // Definir data padrão (+30 dias)
    if (!expiresAt) {
      const defaultDate = addDays(new Date(), 30);
      setExpiresAt(format(defaultDate, 'yyyy-MM-dd'));
    }
  }, []);

  useEffect(() => {
    if (defaultLeadId && isValidDigitalContractId(defaultLeadId)) {
      setLeadId(defaultLeadId);
    }
  }, [defaultLeadId]);

  // Validar template
  const validateTemplate = (id: string) => {
    if (!id || id.trim() === '') {
      setTemplateError('Template é obrigatório');
      return false;
    }
    if (!isValidDigitalContractId(id)) {
      setTemplateError('Template inválido');
      return false;
    }
    const template = templates.find(t => t.id === id);
    if (!template) {
      setTemplateError('Template não encontrado');
      return false;
    }
    if (!template.is_active) {
      setTemplateError('Template está inativo');
      return false;
    }
    setTemplateError('');
    return true;
  };

  // Validar lead
  const validateLead = (id: string) => {
    if (!id || id.trim() === '') {
      setLeadError('Lead é obrigatório');
      return false;
    }
    if (!isValidDigitalContractId(id)) {
      setLeadError('Lead inválido');
      return false;
    }
    const lead = leads.find(l => l.id === id);
    if (!lead) {
      setLeadError('Lead não encontrado');
      return false;
    }
    setLeadError('');
    return true;
  };

  // Validar categoria (opcional)
  const validateCategory = (id: string) => {
    if (!id || id.trim() === '') {
      setCategoryError('');
      return true; // Categoria é opcional
    }
    if (!isValidDigitalContractId(id)) {
      setCategoryError('Categoria inválida');
      return false;
    }
    const category = categories.find(c => c.id === id);
    if (!category) {
      setCategoryError('Categoria não encontrada');
      return false;
    }
    setCategoryError('');
    return true;
  };

  // Validar todos os campos
  const validateAll = (): boolean => {
    const templateValid = validateTemplate(templateId);
    const leadValid = validateLead(leadId);
    const categoryValid = validateCategory(categoryId);

    return templateValid && leadValid && categoryValid;
  };

  // Filtrar apenas IDs válidos
  const validTemplates = templates.filter(t => 
    t.is_active && 
    t.id && 
    isValidDigitalContractId(t.id)
  );

  const validLeads = leads.filter(l => 
    l.id && 
    isValidDigitalContractId(l.id)
  );

  const validCategories = categories.filter(c => 
    c.id && 
    isValidDigitalContractId(c.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar todos os campos antes de submeter
    if (!validateAll()) {
      toast({
        title: 'Erro de validação',
        description: 'Corrija os erros antes de continuar',
        variant: 'destructive',
      });
      return;
    }

    // Buscar template para pegar conteúdo
    const selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) {
      toast({
        title: 'Erro',
        description: 'Template não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await createContract({
        template_id: templateId,
        lead_id: leadId,
        content: selectedTemplate.content,
        contract_number: contractNumber.trim() || undefined,
        category_id: categoryId || undefined,
        expires_at: expiresAt,
      });

      toast({
        title: 'Sucesso',
        description: 'Contrato criado com sucesso',
      });

      navigate('/contratos-digitais');
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

  const loadingAny = templatesLoading || leadsLoading || categoriesLoading;

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/contratos-digitais')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Novo Contrato Digital</h1>
          <p className="text-muted-foreground">
            Crie um novo contrato digital preenchendo os dados abaixo
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Contrato</CardTitle>
          <CardDescription>
            Preencha os campos obrigatórios para criar o contrato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Template */}
            <div className="space-y-2">
              <Label htmlFor="template">
                Template <span className="text-destructive">*</span>
              </Label>
              <select
                id="template"
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  validateTemplate(e.target.value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loadingAny || submitting}
                required
              >
                <option value="">Selecione um template</option>
                {validTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {templateError && (
                <p className="text-sm text-destructive">{templateError}</p>
              )}
              {validTemplates.length === 0 && !templatesLoading && (
                <p className="text-sm text-muted-foreground">
                  Nenhum template ativo disponível. Crie um template primeiro.
                </p>
              )}
            </div>

            {/* Lead */}
            <div className="space-y-2">
              <Label htmlFor="lead">
                Cliente/Lead <span className="text-destructive">*</span>
              </Label>
              <select
                id="lead"
                value={leadId}
                onChange={(e) => {
                  setLeadId(e.target.value);
                  validateLead(e.target.value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loadingAny || submitting}
                required
              >
                <option value="">Selecione um cliente</option>
                {validLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} - {lead.phone || 'Sem telefone'}
                  </option>
                ))}
              </select>
              {leadError && (
                <p className="text-sm text-destructive">{leadError}</p>
              )}
              {validLeads.length === 0 && !leadsLoading && (
                <p className="text-sm text-muted-foreground">
                  Nenhum lead disponível. Crie um lead primeiro.
                </p>
              )}
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <select
                id="category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  validateCategory(e.target.value);
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loadingAny || submitting}
              >
                <option value="">Nenhuma categoria</option>
                {validCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categoryError && (
                <p className="text-sm text-destructive">{categoryError}</p>
              )}
            </div>

            {/* Número do Contrato */}
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Número do Contrato</Label>
              <Input
                id="contractNumber"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Deixe vazio para gerar automaticamente"
                disabled={submitting}
              />
              <p className="text-sm text-muted-foreground">
                Deixe vazio para gerar automaticamente
              </p>
            </div>

            {/* Data de Vigência */}
            <div className="space-y-2">
              <Label htmlFor="expiresAt">
                Data de Vigência <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expiresAt"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                required
                disabled={submitting}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-4 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/contratos-digitais')}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  submitting ||
                  loadingAny ||
                  !templateId ||
                  !leadId ||
                  !expiresAt ||
                  !!templateError ||
                  !!leadError ||
                  !!categoryError
                }
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Contrato
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

