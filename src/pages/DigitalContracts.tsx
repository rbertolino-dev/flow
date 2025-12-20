import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { DigitalContractsList } from '@/components/digital-contracts/DigitalContractsList';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDigitalContracts } from '@/hooks/useDigitalContracts';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
import { DigitalContract, DigitalContractStatus } from '@/types/digital-contract';
import { Plus, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function DigitalContracts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const [statusFilter, setStatusFilter] = useState<DigitalContractStatus | 'all'>('all');
  const [selectedContract, setSelectedContract] = useState<DigitalContract | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const filters = statusFilter !== 'all' ? { status: statusFilter } : undefined;
  const { contracts, loading, deleteContract, updateContractStatus } = useDigitalContracts(filters);

  // Verificar feature flag
  const canAccess = hasFeature('digital_contracts');
  if (!featuresLoading && !canAccess) {
    return (
      <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
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
                Contrato Digital.
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  const handleView = (contract: DigitalContract) => {
    navigate(`/contratos-digitais/${contract.id}`);
  };

  const handleSend = async (contract: DigitalContract) => {
    try {
      await updateContractStatus(contract.id, 'sent');
      toast({
        title: 'Contrato enviado',
        description: 'O contrato será enviado via WhatsApp',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar contrato',
        variant: 'destructive',
      });
    }
  };

  const handleSign = (contract: DigitalContract) => {
    navigate(`/contratos-digitais/${contract.id}?action=sign`);
  };

  const handleCancel = (contract: DigitalContract) => {
    setSelectedContract(contract);
    setShowCancelDialog(true);
  };

  const confirmCancel = async () => {
    if (!selectedContract) return;

    try {
      await updateContractStatus(selectedContract.id, 'cancelled');
      toast({
        title: 'Contrato cancelado',
        description: 'Contrato cancelado com sucesso',
      });
      setShowCancelDialog(false);
      setSelectedContract(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar contrato',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (contract: DigitalContract) => {
    if (contract.pdf_url) {
      window.open(contract.pdf_url, '_blank');
    } else {
      toast({
        title: 'Erro',
        description: 'PDF não disponível',
        variant: 'destructive',
      });
    }
  };

  const handleEditMessage = (contract: DigitalContract) => {
    navigate(`/contratos-digitais/${contract.id}?action=edit-message`);
  };

  const handleEditTemplate = (contract: DigitalContract) => {
    if (contract.template_id) {
      // Navegar para edição de template (implementar depois)
      toast({
        title: 'Em desenvolvimento',
        description: 'Edição de template será implementada em breve',
      });
    }
  };

  return (
    <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contratos Digitais</h1>
            <p className="text-muted-foreground">
              Gerencie seus contratos digitais, templates e assinaturas
            </p>
          </div>
          <Button onClick={() => navigate('/contratos-digitais/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Contrato
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 items-center flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('draft')}
          >
            Rascunho
          </Button>
          <Button
            variant={statusFilter === 'sent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('sent')}
          >
            Enviado
          </Button>
          <Button
            variant={statusFilter === 'signed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('signed')}
          >
            Assinado
          </Button>
          <Button
            variant={statusFilter === 'expired' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('expired')}
          >
            Expirado
          </Button>
          <Button
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('cancelled')}
          >
            Cancelado
          </Button>
        </div>

        {/* Lista */}
        <DigitalContractsList
          contracts={contracts}
          loading={loading}
          onView={handleView}
          onSend={handleSend}
          onSign={handleSign}
          onCancel={handleCancel}
          onDownload={handleDownload}
          onEditMessage={handleEditMessage}
          onEditTemplate={handleEditTemplate}
        />
      </div>

      {/* Dialog de confirmação de cancelamento */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar o contrato {selectedContract?.contract_number}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Sim, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CRMLayout>
  );
}

