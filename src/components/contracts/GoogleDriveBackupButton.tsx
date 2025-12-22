import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useGoogleDriveOAuth } from '@/hooks/useGoogleDriveOAuth';
import { createGoogleDriveServiceForClient } from '@/services/contractStorage/createGoogleDriveServiceForClient';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Cloud, CloudOff, CheckCircle2 } from 'lucide-react';
import { Contract } from '@/types/contract';
import { useActiveOrganization } from '@/hooks/useActiveOrganization';

interface GoogleDriveBackupButtonProps {
  contract: Contract;
  onSuccess?: () => void;
}

export function GoogleDriveBackupButton({ contract, onSuccess }: GoogleDriveBackupButtonProps) {
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();
  const [hasGoogleDrive, setHasGoogleDrive] = useState(false);
  const [checking, setChecking] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  const { connectGoogleDrive, disconnectGoogleDrive, loading: oauthLoading } = useGoogleDriveOAuth({
    leadId: contract.lead_id || '',
    organizationId: activeOrgId || '',
    onSuccess: () => {
      checkGoogleDriveConfig();
    },
  });

  const checkGoogleDriveConfig = async () => {
    if (!contract.lead_id || !activeOrgId) {
      setHasGoogleDrive(false);
      setChecking(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('client_google_drive_configs')
        .select('id, is_active')
        .eq('lead_id', contract.lead_id)
        .eq('organization_id', activeOrgId)
        .eq('is_active', true)
        .maybeSingle();

      setHasGoogleDrive(!!data);
    } catch (error) {
      console.error('Erro ao verificar Google Drive:', error);
      setHasGoogleDrive(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkGoogleDriveConfig();
  }, [contract.lead_id, activeOrgId]);

  const handleBackup = async () => {
    if (!contract.lead_id || !activeOrgId) {
      toast({
        title: 'Erro',
        description: 'Lead não encontrado',
        variant: 'destructive',
      });
      return;
    }

    setBackingUp(true);
    try {
      // Buscar serviço do Google Drive do cliente
      const googleDriveService = await createGoogleDriveServiceForClient(
        contract.lead_id,
        activeOrgId
      );

      if (!googleDriveService) {
        toast({
          title: 'Google Drive não configurado',
          description: 'Configure o Google Drive do cliente primeiro',
          variant: 'destructive',
        });
        return;
      }

      // Buscar PDF do contrato
      const pdfUrl = contract.signed_pdf_url || contract.pdf_url;
      if (!pdfUrl) {
        toast({
          title: 'PDF não encontrado',
          description: 'O contrato precisa ter um PDF para fazer backup',
          variant: 'destructive',
        });
        return;
      }

      // Baixar PDF
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('Erro ao baixar PDF');
      }

      const pdfBlob = await response.blob();

      // Fazer upload para Google Drive
      await googleDriveService.uploadPDF(pdfBlob, contract.id, 'contract');

      setBackedUp(true);
      toast({
        title: 'Backup realizado',
        description: 'Contrato salvo no Google Drive do cliente com sucesso',
      });

      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao fazer backup no Google Drive:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao fazer backup no Google Drive',
        variant: 'destructive',
      });
    } finally {
      setBackingUp(false);
    }
  };

  if (checking) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Verificando...
      </Button>
    );
  }

  if (!hasGoogleDrive) {
    return (
      <Button variant="outline" onClick={connectGoogleDrive} disabled={oauthLoading}>
        {oauthLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Conectando...
          </>
        ) : (
          <>
            <Cloud className="w-4 h-4 mr-2" />
            Conectar Google Drive
          </>
        )}
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      {backedUp ? (
        <Button variant="outline" disabled>
          <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
          Salvo no Google Drive
        </Button>
      ) : (
        <Button variant="outline" onClick={handleBackup} disabled={backingUp}>
          {backingUp ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Cloud className="w-4 h-4 mr-2" />
              Salvar no Google Drive
            </>
          )}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={disconnectGoogleDrive} disabled={oauthLoading}>
        <CloudOff className="w-4 h-4" />
      </Button>
    </div>
  );
}

