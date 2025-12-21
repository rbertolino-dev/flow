import { useState, useEffect } from 'react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SimpleDropdown } from '@/components/ui/simple-dropdown';
import { ContractsList } from '@/components/contracts/ContractsList';
import { ContractViewer } from '@/components/contracts/ContractViewer';
import { CreateContractDialog } from '@/components/contracts/CreateContractDialog';
import { ContractTemplateEditor } from '@/components/contracts/ContractTemplateEditor';
import { ContractSignatureDialog } from '@/components/contracts/ContractSignatureDialog';
import { EditMessageDialog } from '@/components/contracts/EditMessageDialog';
import { SendContractDialog } from '@/components/contracts/SendContractDialog';
import { ContractFilters } from '@/components/contracts/ContractFilters';
import { ContractCategories } from '@/components/contracts/ContractCategories';
import { useContracts } from '@/hooks/useContracts';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { Contract, ContractStatus, ContractTemplate } from '@/types/contract';
import { Plus, FileText, Search, Filter, X, Lock, Loader2, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEvolutionConfigs } from '@/hooks/useEvolutionConfigs';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';

export default function Contracts() {
  const [statusFilter, setStatusFilter] = useState<ContractStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [dateFromFilter, setDateFromFilter] = useState<string | undefined>();
  const [dateToFilter, setDateToFilter] = useState<string | undefined>();
  const [expiresFromFilter, setExpiresFromFilter] = useState<string | undefined>();
  const [expiresToFilter, setExpiresToFilter] = useState<string | undefined>();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedTemplateToEdit, setSelectedTemplateToEdit] = useState<ContractTemplate | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showEditMessageDialog, setShowEditMessageDialog] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const { contracts, loading, updateContractStatus, deleteContract, regenerateContractPDF, refetch } = useContracts({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery || undefined,
    category_id: categoryFilter,
    date_from: dateFromFilter,
    date_to: dateToFilter,
    expires_from: expiresFromFilter,
    expires_to: expiresToFilter,
  });
  const { templates } = useContractTemplates();
  const { configs: evolutionConfigs, loading: configsLoading } = useEvolutionConfigs();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  // Debug: verificar instâncias disponíveis
  const connectedInstances = evolutionConfigs.filter((config) => config.is_connected);

  // Verificar se tem acesso à feature de contratos
  const canAccessContracts = hasFeature('contracts');

  // Se não tem acesso, mostrar mensagem
  if (!featuresLoading && !canAccessContracts) {
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
                Entre em contato com o administrador do sistema para solicitar acesso ao módulo de Contratos.
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  const handleView = async (contract: Contract) => {
    // Buscar contrato completo com todos os campos atualizados
    const { data: fullContract } = await supabase
      .from('contracts')
      .select('*, lead:leads(*), template:contract_templates(*)')
      .eq('id', contract.id)
      .single();
    
    if (fullContract) {
      setSelectedContract(fullContract as Contract);
    } else {
      setSelectedContract(contract);
    }
  };

  // Realtime: Atualizar contratos quando assinaturas mudarem
  useEffect(() => {
    if (!activeOrgId) return;

    console.log('🔄 Configurando realtime para assinaturas de contratos...');
    
    const channel = supabase
      .channel('contract-signatures-realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'contract_signatures',
        },
        (payload) => {
          console.log('🔄 Realtime: Assinatura de contrato alterada', payload);
          // Refetch contratos para atualizar a lista
          refetch();
          // Se houver um contrato selecionado, atualizar também
          if (selectedContract) {
            handleView(selectedContract);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Desconectando realtime de assinaturas...');
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, selectedContract?.id, refetch]);

  const handleSign = (contract: Contract) => {
    setSelectedContract(contract);
    setShowSignatureDialog(true);
  };

  const handleSend = (contract: Contract) => {
    setSelectedContract(contract);
    setShowSendDialog(true);
  };

  const handleEditMessage = (contract: Contract) => {
    setSelectedContract(contract);
    setShowEditMessageDialog(true);
  };

  const handleEditTemplate = (template: ContractTemplate) => {
    setSelectedTemplateToEdit(template);
    setShowTemplateEditor(true);
  };

  const handleEditTemplateFromContract = (contract: Contract) => {
    if (contract.template) {
      setSelectedTemplateToEdit(contract.template);
      setShowTemplateEditor(true);
    }
  };

  const handleCancel = async (contract: Contract) => {
    if (!confirm('Tem certeza que deseja cancelar este contrato?')) return;

    try {
      await updateContractStatus(contract.id, 'cancelled');
      await refetch(); // Atualizar lista
      toast({
        title: 'Contrato cancelado',
        description: 'Contrato cancelado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar contrato',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (contract: Contract) => {
    const pdfUrl = contract.signed_pdf_url || contract.pdf_url;
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedContract || !selectedInstanceId) {
      toast({
        title: 'Erro',
        description: 'Selecione uma instância do WhatsApp',
        variant: 'destructive',
      });
      return;
    }

    setSendingWhatsApp(true);

    try {
      let pdfUrl = selectedContract.signed_pdf_url || selectedContract.pdf_url;
      
      // Se não houver PDF, tentar regenerar
      if (!pdfUrl) {
        toast({
          title: 'PDF não encontrado',
          description: 'Regenerando PDF do contrato...',
        });

        try {
          pdfUrl = await regenerateContractPDF(selectedContract.id);
          
          // Atualizar o contrato selecionado com a nova URL
          selectedContract.pdf_url = pdfUrl;
        } catch (regenerateError: any) {
          toast({
            title: 'Erro ao regenerar PDF',
            description: regenerateError.message || 'Não foi possível gerar o PDF. Verifique se o contrato tem conteúdo válido.',
            variant: 'destructive',
          });
          setSendingWhatsApp(false);
          return;
        }
      }

      // Mostrar toast de "Enviando..."
      const sendingToast = toast({
        title: 'Enviando contrato...',
        description: 'Aguarde, isso pode levar alguns segundos',
      });

      // Chamar edge function para enviar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contract-whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            contract_id: selectedContract.id,
            instance_id: selectedInstanceId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || 'Erro ao enviar contrato');
      }

      await updateContractStatus(selectedContract.id, 'sent');

      // Atualizar lista de contratos
      await refetch();

      toast({
        title: 'Contrato enviado',
        description: 'Contrato enviado via WhatsApp com sucesso',
      });

      setShowSendDialog(false);
      setSelectedInstanceId('');
    } catch (error: any) {
      console.error('Erro ao enviar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar contrato',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  return (
    <CRMLayout activeView="contracts" onViewChange={() => {}}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contratos</h1>
            <p className="text-muted-foreground">
              Gerencie seus contratos, templates e assinaturas
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTemplateToEdit(null);
                setShowTemplateEditor(true);
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCategories(true)}
            >
              <Tag className="w-4 h-4 mr-2" />
              Categorias
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Contrato
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 items-center flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por número ou conteúdo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <SimpleDropdown
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            options={[
              { value: 'all', label: 'Todos os status' },
              { value: 'draft', label: 'Rascunho' },
              { value: 'sent', label: 'Enviado' },
              { value: 'signed', label: 'Assinado' },
              { value: 'expired', label: 'Expirado' },
              { value: 'cancelled', label: 'Cancelado' },
            ]}
            placeholder="Filtrar por status"
          />
          <ContractFilters
            status={statusFilter}
            categoryId={categoryFilter}
            search={searchQuery}
            dateFrom={dateFromFilter}
            dateTo={dateToFilter}
            expiresFrom={expiresFromFilter}
            expiresTo={expiresToFilter}
            onFiltersChange={(filters) => {
              setStatusFilter(filters.status || 'all');
              setCategoryFilter(filters.categoryId);
              setDateFromFilter(filters.dateFrom);
              setDateToFilter(filters.dateTo);
              setExpiresFromFilter(filters.expiresFrom);
              setExpiresToFilter(filters.expiresTo);
            }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Lista ou Visualização */}
        {selectedContract ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setSelectedContract(null)}
            >
              ← Voltar para lista
            </Button>
            <ContractViewer
              contract={selectedContract}
              onSign={handleSign}
              onSend={handleSend}
              onCancel={handleCancel}
              onDownload={handleDownload}
              onEditMessage={handleEditMessage}
              onEditTemplate={handleEditTemplate}
            />
          </div>
        ) : (
          <ContractsList
            contracts={contracts}
            loading={loading}
            onView={handleView}
            onSign={handleSign}
            onSend={handleSend}
            onCancel={handleCancel}
            onDownload={handleDownload}
            onEditMessage={handleEditMessage}
            onEditTemplate={handleEditTemplateFromContract}
          />
        )}

        {/* Dialogs */}
        <CreateContractDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={() => {
            refetch();
            setShowCreateDialog(false);
          }}
        />

        <ContractTemplateEditor
          open={showTemplateEditor}
          onOpenChange={(open) => {
            setShowTemplateEditor(open);
            if (!open) {
              setSelectedTemplateToEdit(null);
            }
          }}
          template={selectedTemplateToEdit || undefined}
          onSuccess={async () => {
            await refetch();
            setSelectedTemplateToEdit(null);
            // Templates são atualizados automaticamente pelo hook
          }}
        />

        <Dialog open={showCategories} onOpenChange={setShowCategories}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Categorias</DialogTitle>
              <DialogDescription>
                Organize seus contratos em categorias para facilitar a busca e organização
              </DialogDescription>
            </DialogHeader>
            <ContractCategories />
          </DialogContent>
        </Dialog>

        {selectedContract && (
          <>
            <ContractSignatureDialog
              open={showSignatureDialog}
              onOpenChange={setShowSignatureDialog}
              contract={selectedContract}
              signerType="user"
              onSuccess={async () => {
                await refetch();
                // Atualizar contrato selecionado também
                const updated = await supabase
                  .from('contracts')
                  .select('*, lead:leads(*), template:contract_templates(*)')
                  .eq('id', selectedContract.id)
                  .single();
                if (updated.data) {
                  setSelectedContract(updated.data as Contract);
                }
                setShowSignatureDialog(false);
              }}
            />
            <EditMessageDialog
              open={showEditMessageDialog}
              onOpenChange={setShowEditMessageDialog}
              contract={selectedContract}
              onSuccess={async () => {
                await refetch();
                // Atualizar contrato selecionado também
                const updated = await supabase
                  .from('contracts')
                  .select('*, lead:leads(*), template:contract_templates(*)')
                  .eq('id', selectedContract.id)
                  .single();
                if (updated.data) {
                  setSelectedContract(updated.data as Contract);
                }
              }}
            />
          </>
        )}

        {selectedContract && (
          <SendContractDialog
            open={showSendDialog}
            onOpenChange={setShowSendDialog}
            contract={selectedContract}
            onSuccess={async () => {
              await refetch();
              // Atualizar contrato selecionado também
              const updated = await supabase
                .from('contracts')
                .select('*, lead:leads(*), template:contract_templates(*)')
                .eq('id', selectedContract.id)
                .single();
              if (updated.data) {
                setSelectedContract(updated.data as Contract);
              }
            }}
          />
        )}

      </div>
    </CRMLayout>
  );
}
