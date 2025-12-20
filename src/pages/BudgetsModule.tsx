import { useState } from 'react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BudgetList } from '@/components/budgets/BudgetList';
import { BudgetViewer } from '@/components/budgets/BudgetViewer';
import { CreateBudgetDialog } from '@/components/budgets/CreateBudgetDialog';
import { useBudgets } from '@/hooks/useBudgets';
import { useBudget } from '@/hooks/useBudget';
import { useDeleteBudget } from '@/hooks/useDeleteBudget';
import { Budget } from '@/types/budget-module';
import { Plus, Search, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { generateBudgetPDF } from '@/lib/budgetPdfModule';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function BudgetsModule() {
  const [searchQuery, setSearchQuery] = useState('');
  const [leadIdFilter, setLeadIdFilter] = useState<string>('');
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const { data: budgets = [], isLoading, refetch } = useBudgets({
    search: searchQuery || undefined,
    lead_id: leadIdFilter || undefined,
    expired_only: expiredOnly,
  });

  const { data: budgetDetails } = useBudget(selectedBudget?.id || null);
  const { mutate: deleteBudget } = useDeleteBudget();
  const { toast } = useToast();

  const handleView = (budget: Budget) => {
    setSelectedBudget(budget);
  };

  const handleCloseViewer = () => {
    setSelectedBudget(null);
  };

  const handleDelete = (budget: Budget) => {
    if (confirm(`Tem certeza que deseja excluir o orçamento ${budget.budget_number}?`)) {
      deleteBudget(budget.id, {
        onSuccess: () => {
          if (selectedBudget?.id === budget.id) {
            setSelectedBudget(null);
          }
          refetch();
        },
      });
    }
  };

  const handleDownload = async (budget: Budget) => {
    if (!budget.pdf_url) {
      toast({
        title: 'Erro',
        description: 'PDF não disponível. Regenere o PDF primeiro.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = budget.pdf_url;
      link.download = `Orcamento_${budget.budget_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao baixar PDF',
        variant: 'destructive',
      });
    }
  };

  const handleRegeneratePDF = async () => {
    if (!selectedBudget) return;

    setRegeneratingId(selectedBudget.id);

    try {
      // Gerar PDF
      const pdfBlob = await generateBudgetPDF({
        budget: selectedBudget,
        headerColor: selectedBudget.header_color,
        logoUrl: selectedBudget.logo_url,
      });

      // Upload para Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const fileName = `budget-${selectedBudget.id}.pdf`;
      const filePath = `${selectedBudget.organization_id}/budgets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('budget-pdfs')
        .upload(filePath, pdfBlob, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('budget-pdfs')
        .getPublicUrl(filePath);

      // Atualizar orçamento com URL do PDF
      const { error: updateError } = await supabase
        .from('budgets')
        .update({ pdf_url: urlData.publicUrl })
        .eq('id', selectedBudget.id);

      if (updateError) throw updateError;

      toast({
        title: 'PDF regenerado',
        description: 'O PDF foi regenerado com sucesso.',
      });

      refetch();
      if (selectedBudget) {
        setSelectedBudget({ ...selectedBudget, pdf_url: urlData.publicUrl });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao regenerar PDF',
        variant: 'destructive',
      });
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedBudget) return;

    const client = selectedBudget.client_data || selectedBudget.lead;
    if (!client?.phone) {
      toast({
        title: 'Erro',
        description: 'Cliente não possui telefone cadastrado',
        variant: 'destructive',
      });
      return;
    }

    setSendingId(selectedBudget.id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('send-budget-whatsapp-module', {
        body: {
          budget_id: selectedBudget.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;

      toast({
        title: 'Enviado',
        description: 'Orçamento enviado via WhatsApp com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar via WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleCreateSuccess = () => {
    refetch();
  };

  return (
    <CRMLayout activeView="budgets-module" onViewChange={() => {}}>
      <div className="flex-1 flex flex-col h-full">
        {/* Header */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Orçamento Digital</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus orçamentos
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou observações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="expiredOnly"
                checked={expiredOnly}
                onCheckedChange={(checked) => setExpiredOnly(checked === true)}
              />
              <Label htmlFor="expiredOnly" className="cursor-pointer">
                Apenas expirados
              </Label>
            </div>
            {(searchQuery || expiredOnly) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setExpiredOnly(false);
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {selectedBudget ? (
            <div>
              <Button
                variant="ghost"
                onClick={handleCloseViewer}
                className="mb-4"
              >
                ← Voltar para lista
              </Button>
              <BudgetViewer
                budget={budgetDetails || selectedBudget}
                onRegeneratePDF={handleRegeneratePDF}
                onDownload={() => handleDownload(selectedBudget)}
                onSendWhatsApp={handleSendWhatsApp}
                onDelete={() => handleDelete(selectedBudget)}
                regenerating={regeneratingId === selectedBudget.id}
                sending={sendingId === selectedBudget.id}
              />
            </div>
          ) : (
            <BudgetList
              budgets={budgets}
              loading={isLoading}
              onView={handleView}
              onDelete={handleDelete}
              onDownload={handleDownload}
              onSendWhatsApp={(budget) => {
                setSelectedBudget(budget);
                setTimeout(() => handleSendWhatsApp(), 100);
              }}
            />
          )}
        </div>
      </div>

      {/* Dialog de criação */}
      <CreateBudgetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />
    </CRMLayout>
  );
}

