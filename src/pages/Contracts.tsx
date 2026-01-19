import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
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
// Import dinâmico do ContractPdfBuilder para evitar carregar react-pdf na inicialização
// Com tratamento de erro robusto para cache de navegador com hash antigo
const ContractPdfBuilderLazy = React.lazy(() => 
  import('@/components/contracts/ContractPdfBuilder')
    .then(module => ({ default: module.ContractPdfBuilder }))
    .catch((error) => {
      // Se falhar ao carregar (ex: hash antigo no cache), recarregar página
      console.error('Erro ao carregar ContractPdfBuilder:', error);
      if (error.message && error.message.includes('Failed to fetch dynamically imported module')) {
        console.warn('Hash antigo detectado no cache. Recarregando página para pegar versão atual...');
        // Aguardar um pouco antes de recarregar para evitar loop
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      // Retornar componente de erro
      return {
        default: () => (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-red-600 mb-4">Erro ao carregar visualizador de PDF</p>
            <p className="text-sm text-muted-foreground mb-4">
              O arquivo pode ter sido atualizado. Recarregando página...
            </p>
            <Button onClick={() => window.location.reload()}>
              Recarregar Página
            </Button>
          </div>
        )
      };
    })
);
import { ContractFilters } from '@/components/contracts/ContractFilters';
import { ContractCategories } from '@/components/contracts/ContractCategories';
import { DeletedContractsList } from '@/components/contracts/DeletedContractsList';
import { useContracts } from '@/hooks/useContracts';
import { useContractTemplates } from '@/hooks/useContractTemplates';
import { Contract, ContractStatus, ContractTemplate } from '@/types/contract';
import { Plus, FileText, Search, Filter, X, Lock, Loader2, Tag, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
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
  const [showPdfBuilder, setShowPdfBuilder] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showDeletedContracts, setShowDeletedContracts] = useState(false);
  const [monthStats, setMonthStats] = useState<{ current: number; previous: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  
  // Memoizar filtros para evitar recriação do objeto a cada render
  const contractFilters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery || undefined,
    category_id: categoryFilter,
    date_from: dateFromFilter,
    date_to: dateToFilter,
    expires_from: expiresFromFilter,
    expires_to: expiresToFilter,
  }), [statusFilter, searchQuery, categoryFilter, dateFromFilter, dateToFilter, expiresFromFilter, expiresToFilter]);
  
  const { contracts, loading, updateContractStatus, deleteContract, regenerateContractPDF, refetch } = useContracts(contractFilters);
  const { templates } = useContractTemplates();
  const { configs: evolutionConfigs, loading: configsLoading } = useEvolutionConfigs();
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  // Debug: verificar instâncias disponíveis
  const connectedInstances = evolutionConfigs.filter((config) => config.is_connected);

  // TODOS OS HOOKS DEVEM SER CHAMADOS ANTES DE QUALQUER EARLY RETURN
  // Isso é CRÍTICO para evitar erro React #300
  
  const handleView = useCallback(async (contract: Contract) => {
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
  }, []);

  // Usar refs para armazenar funções que podem mudar
  const refetchRef = useRef(refetch);
  const handleViewRef = useRef(handleView);
  
  // Atualizar refs quando funções mudarem
  useEffect(() => {
    refetchRef.current = refetch;
    handleViewRef.current = handleView;
  }, [refetch, handleView]);

  // Carregar estatísticas do mês
  useEffect(() => {
    if (!activeOrgId) return;
    
    const fetchMonthStats = async () => {
      setLoadingStats(true);
      try {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Contar contratos do mês atual
        const { count: currentCount } = await supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', activeOrgId)
          .gte('created_at', startOfCurrentMonth.toISOString());

        // Contar contratos do mês anterior
        const { count: previousCount } = await supabase
          .from('contracts')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', activeOrgId)
          .gte('created_at', startOfPreviousMonth.toISOString())
          .lte('created_at', endOfPreviousMonth.toISOString());

        setMonthStats({
          current: currentCount || 0,
          previous: previousCount || 0,
        });
      } catch (error) {
        console.error('Erro ao contar contratos do mês:', error);
        setMonthStats({ current: 0, previous: 0 });
      } finally {
        setLoadingStats(false);
      }
    };

    fetchMonthStats();
  }, [activeOrgId, contracts.length]); // Atualizar quando contratos mudarem

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
          refetchRef.current();
          // Se houver um contrato selecionado, atualizar também
          if (selectedContract) {
            handleViewRef.current(selectedContract);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Desconectando realtime de assinaturas...');
      supabase.removeChannel(channel);
    };
  }, [activeOrgId, selectedContract?.id]);

  // Verificar se tem acesso à feature de contratos
  const canAccessContracts = hasFeature('contracts');

  // Se não tem acesso, mostrar mensagem (DEPOIS de todos os hooks)
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

  const handleConfigureSignatures = (contract: Contract) => {
    setSelectedContract(contract);
    setShowPdfBuilder(true);
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

  const handleDelete = async (contract: Contract) => {
    if (!confirm('Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.')) return;

    try {
      await deleteContract(contract.id);
      await refetch(); // Atualizar lista
      setSelectedContract(null); // Fechar visualização
      toast({
        title: 'Contrato excluído',
        description: 'Contrato excluído com sucesso. Você pode visualizar o histórico de exclusões.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir contrato',
        variant: 'destructive',
      });
    }
  };

  const handleReloadContract = async (contract: Contract) => {
    try {
      toast({
        title: 'Recarregando contrato...',
        description: 'Regenerando PDF com as últimas alterações do template...',
      });

      const newPdfUrl = await regenerateContractPDF(contract.id);
      
      // Atualizar o contrato selecionado com a nova URL
      if (selectedContract && selectedContract.id === contract.id) {
        setSelectedContract({
          ...selectedContract,
          pdf_url: newPdfUrl,
        });
      }

      // Recarregar lista de contratos
      await refetch();

      toast({
        title: 'Contrato recarregado',
        description: 'O PDF foi regenerado com sucesso com as últimas alterações do template.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao recarregar contrato',
        description: error.message || 'Não foi possível regenerar o PDF. Verifique se o contrato tem conteúdo válido.',
        variant: 'destructive',
      });
      throw error;
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
        {/* Indicador de Contratos do Mês */}
        {monthStats !== null && (
          <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Contratos criados este mês
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-4xl font-bold text-primary">
                      {loadingStats ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        monthStats.current
                      )}
                    </h2>
                    {!loadingStats && monthStats.previous > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        {monthStats.current >= monthStats.previous ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-green-600 font-medium">
                              +{monthStats.current - monthStats.previous} vs mês anterior
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="text-red-600 font-medium">
                              {monthStats.current - monthStats.previous} vs mês anterior
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Mês anterior: {monthStats.previous}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            <Button
              variant="outline"
              onClick={() => setShowDeletedContracts(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluídos
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
              onConfigureSignatures={handleConfigureSignatures}
              onDelete={handleDelete}
              onReload={handleReloadContract}
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
          onSuccess={async (contractId, isPdfUpload) => {
            await refetch();
            setShowCreateDialog(false);
            
            // Se foi upload de PDF, abrir builder de assinaturas automaticamente
            if (isPdfUpload && contractId) {
              // Buscar o contrato criado para selecioná-lo
              const { data: newContract } = await supabase
                .from('contracts')
                .select('*, lead:leads(*), template:contract_templates(*)')
                .eq('id', contractId)
                .single();
              
              if (newContract) {
                setSelectedContract(newContract as Contract);
                // Aguardar um pouco para garantir que o contrato foi selecionado
                setTimeout(() => {
                  setShowPdfBuilder(true);
                }, 300);
              }
            }
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

        <Dialog open={showDeletedContracts} onOpenChange={setShowDeletedContracts}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Contratos Excluídos</DialogTitle>
              <DialogDescription>
                Histórico de contratos excluídos com informações de quem excluiu e quando
              </DialogDescription>
            </DialogHeader>
            <DeletedContractsList />
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

        {/* Suspense sempre renderizado para manter ordem dos hooks */}
        <React.Suspense 
          fallback={null}
        >
          {showPdfBuilder && selectedContract && (
            <ContractPdfBuilderLazy
              open={showPdfBuilder}
              onOpenChange={setShowPdfBuilder}
              contractId={selectedContract.id}
              onSuccess={async () => {
                await refetch();
                toast({
                  title: 'Posições configuradas',
                  description: 'As posições de assinatura foram salvas com sucesso',
                });
              }}
            />
          )}
        </React.Suspense>

      </div>
    </CRMLayout>
  );
}
