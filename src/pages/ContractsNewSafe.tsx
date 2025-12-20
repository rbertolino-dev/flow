import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useContracts } from '@/hooks/useContracts';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { useContractCategories } from '@/hooks/useContractCategories';
import { useLeads } from '@/hooks/useLeads';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Loader2, Lock, ArrowLeft } from 'lucide-react';

const isValidId = (id?: string | null) =>
  typeof id === 'string' && id.trim() !== '' && id !== 'null' && id !== 'undefined';

export default function ContractsNewSafe() {
  const navigate = useNavigate();
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const { createContract } = useContracts();
  const { templates, loading: templatesLoading } = useContractTemplates();
  const { leads, loading: leadsLoading } = useLeads();
  const { categories, loading: categoriesLoading } = useContractCategories();
  const { toast } = useToast();

  const [templateId, setTemplateId] = useState('');
  const [leadId, setLeadId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState(
    format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Reset ao entrar na página
    setTemplateId('');
    setLeadId('');
    setCategoryId('');
    setContractNumber('');
    setExpiresAt(format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  }, []);

  const validTemplates = useMemo(
    () => templates.filter((t) => t.is_active && isValidId(t.id)),
    [templates],
  );
  const validLeads = useMemo(() => leads.filter((l) => isValidId(l.id)), [leads]);
  const validCategories = useMemo(
    () => (categories || []).filter((c) => isValidId(c.id)),
    [categories],
  );

  const loadingAny = templatesLoading || leadsLoading || categoriesLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidId(templateId) || !isValidId(leadId)) {
      toast({
        title: 'Erro',
        description: 'Template e Lead são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await createContract({
        template_id: templateId,
        lead_id: leadId,
        contract_number: contractNumber || undefined,
        expires_at: expiresAt,
        category_id: categoryId || undefined,
      });
      toast({
        title: 'Sucesso',
        description: 'Contrato criado com sucesso',
      });
      navigate('/contracts');
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

  // Restrições de feature
  const canAccess = hasFeature('contracts');
  if (!featuresLoading && !canAccess) {
    return (
      <CRMLayout activeView="contracts" onViewChange={() => {}}>
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Acesso Restrito</CardTitle>
              </div>
              <CardDescription>
                Esta funcionalidade não está disponível para sua organização.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Entre em contato com o administrador do sistema para solicitar acesso ao módulo de
                Contratos.
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout activeView="contracts" onViewChange={() => {}}>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Novo Contrato (Seguro)</h1>
            <p className="text-muted-foreground">
              Formulário dedicado, com selects nativos, para evitar erros de seleção.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/contracts')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar para contratos
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados do contrato</CardTitle>
            <CardDescription>Preencha os campos obrigatórios para criar o contrato.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="template">Template *</Label>
                <select
                  id="template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={loadingAny}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  required
                >
                  <option value="">{loadingAny ? 'Carregando...' : 'Selecione um template'}</option>
                  {validTemplates.map((template) => (
                    <option key={template.id} value={template.id!.trim()}>
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
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                    disabled={loadingAny}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="">{loadingAny ? 'Carregando...' : 'Selecione um lead'}</option>
                    {validLeads.map((lead) => (
                      <option key={lead.id} value={lead.id!.trim()}>
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
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={loadingAny}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecione uma categoria</option>
                  {validCategories.map((category) => (
                    <option key={category.id} value={category.id!.trim()}>
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

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/contracts')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || loadingAny || !templateId || !leadId}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Contrato
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}

