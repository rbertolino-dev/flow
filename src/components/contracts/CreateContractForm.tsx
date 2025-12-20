import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleDropdown } from '@/components/ui/simple-dropdown';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { useContracts } from '@/hooks/useContracts';
import { useLeads } from '@/hooks/useLeads';
import { useContractCategories } from '@/hooks/useContractCategories';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';

interface CreateContractFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultLeadId?: string;
}

export function CreateContractForm({
  open,
  onClose,
  onSuccess,
  defaultLeadId,
}: CreateContractFormProps) {
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

    setSubmitting(true);
    try {
      await createContract({
        template_id: selectedTemplateId,
        lead_id: selectedLeadId,
        contract_number: contractNumber || undefined,
        expires_at: expiresAt,
        category_id: selectedCategoryId || undefined,
      });

      toast({
        title: 'Sucesso',
        description: 'Contrato criado com sucesso',
      });

      onSuccess?.();
      onClose();
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

  if (!open) return null;

  const templateOptions = templates
    .filter((t) => t.is_active && t.id && t.id.trim() !== '')
    .map((t) => ({
      value: t.id!.trim(),
      label: t.name,
    }));

  const leadOptions = leads
    .filter((l) => l.id && l.id.trim() !== '')
    .map((l) => ({
      value: l.id!.trim(),
      label: `${l.name} - ${l.phone || 'Sem telefone'}`,
    }));

  const categoryOptions = (categories || [])
    .filter((c) => c.id && c.id.trim() !== '')
    .map((c) => ({
      value: c.id!.trim(),
      label: c.name,
    }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Criar Novo Contrato</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template">Template *</Label>
            <SimpleDropdown
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              options={templateOptions}
              placeholder={templatesLoading ? 'Carregando...' : 'Selecione um template'}
              disabled={templatesLoading}
              searchable={true}
              emptyMessage="Nenhum template disponível"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lead">Lead/Cliente *</Label>
              <SimpleDropdown
                value={selectedLeadId}
                onChange={setSelectedLeadId}
                options={leadOptions}
                placeholder={leadsLoading ? 'Carregando...' : 'Selecione um lead'}
                disabled={leadsLoading}
                searchable={true}
                emptyMessage="Nenhum lead disponível"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-number">Número do Contrato</Label>
              <Input
                id="contract-number"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                placeholder="Deixe vazio para gerar automaticamente"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria (opcional)</Label>
            <SimpleDropdown
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              options={categoryOptions}
              placeholder="Selecione uma categoria"
              searchable={true}
              emptyMessage="Nenhuma categoria disponível"
            />
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

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !selectedTemplateId || !selectedLeadId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Contrato
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


