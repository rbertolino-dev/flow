import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DigitalContractStatusBadge } from '@/components/digital-contracts/DigitalContractStatusBadge';
import { useDigitalContracts } from '@/hooks/useDigitalContracts';
import { useOrganizationFeatures } from '@/hooks/useOrganizationFeatures';
import { supabase } from '@/integrations/supabase/client';
import { DigitalContract } from '@/types/digital-contract';
import { format } from 'date-fns';
import { ArrowLeft, Download, FileSignature, Send, X, Lock } from 'lucide-react';
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

export default function DigitalContractView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();
  const { updateContractStatus, regenerateContractPDF } = useDigitalContracts();
  const [contract, setContract] = useState<DigitalContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchContract();
    }
  }, [id]);

  const fetchContract = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select(`
          *,
          template:contract_templates(*),
          category:contract_categories(*),
          lead:leads(id, name, phone, email, company)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: 'Erro',
          description: 'Contrato não encontrado',
          variant: 'destructive',
        });
        navigate('/contratos-digitais');
        return;
      }

      setContract(data as DigitalContract);
    } catch (error: any) {
      console.error('Erro ao carregar contrato:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao carregar contrato',
        variant: 'destructive',
      });
      navigate('/contratos-digitais');
    } finally {
      setLoading(false);
    }
  };

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
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Entre em contato com o administrador do sistema para solicitar acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  if (loading) {
    return (
      <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Carregando contrato...</p>
        </div>
      </CRMLayout>
    );
  }

  if (!contract) {
    return (
      <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Contrato não encontrado</p>
        </div>
      </CRMLayout>
    );
  }

  const handleDownload = () => {
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

  const handleSign = () => {
    navigate(`/contratos-digitais/${contract.id}?action=sign`);
  };

  const handleSend = async () => {
    try {
      await updateContractStatus(contract.id, 'sent');
      toast({
        title: 'Contrato enviado',
        description: 'O contrato será enviado via WhatsApp',
      });
      await fetchContract();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao enviar contrato',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = async () => {
    try {
      await updateContractStatus(contract.id, 'cancelled');
      toast({
        title: 'Contrato cancelado',
        description: 'Contrato cancelado com sucesso',
      });
      navigate('/contratos-digitais');
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao cancelar contrato',
        variant: 'destructive',
      });
    }
  };

  return (
    <CRMLayout activeView="digital-contracts" onViewChange={() => {}}>
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/contratos-digitais')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Contrato {contract.contract_number}</h1>
            <p className="text-muted-foreground">
              Visualização detalhada do contrato
            </p>
          </div>
        </div>

        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Contrato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <DigitalContractStatusBadge status={contract.status} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Número</p>
                <p className="font-mono">{contract.contract_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="font-medium">{contract.lead?.name || 'N/A'}</p>
                {contract.lead?.phone && (
                  <p className="text-sm text-muted-foreground">{contract.lead.phone}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Template</p>
                <p>{contract.template?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Criação</p>
                <p>
                  {contract.created_at
                    ? format(new Date(contract.created_at), 'dd/MM/yyyy HH:mm')
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data de Vigência</p>
                <p>
                  {contract.expires_at
                    ? format(new Date(contract.expires_at), 'dd/MM/yyyy')
                    : 'N/A'}
                </p>
              </div>
              {contract.signed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de Assinatura</p>
                  <p>{format(new Date(contract.signed_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}
              {contract.sent_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Data de Envio</p>
                  <p>{format(new Date(contract.sent_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PDF */}
        {contract.pdf_url && (
          <Card>
            <CardHeader>
              <CardTitle>PDF do Contrato</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe
                src={contract.pdf_url}
                className="w-full border rounded-md"
                style={{ height: '600px' }}
                title="PDF do Contrato"
              />
            </CardContent>
          </Card>
        )}

        {/* Ações */}
        <div className="flex gap-4">
          {contract.pdf_url && (
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Baixar PDF
            </Button>
          )}
          {contract.status !== 'signed' && (
            <Button onClick={handleSign} variant="outline">
              <FileSignature className="mr-2 h-4 w-4" />
              Assinar
            </Button>
          )}
          {contract.status !== 'sent' && contract.status !== 'signed' && (
            <Button onClick={handleSend} variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Enviar via WhatsApp
            </Button>
          )}
          {contract.status !== 'cancelled' && (
            <Button onClick={handleCancel} variant="destructive">
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de confirmação */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este contrato? Esta ação não pode ser desfeita.
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

