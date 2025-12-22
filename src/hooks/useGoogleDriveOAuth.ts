import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface UseGoogleDriveOAuthOptions {
  leadId: string;
  organizationId: string;
  onSuccess?: () => void;
}

export function useGoogleDriveOAuth({ leadId, organizationId, onSuccess }: UseGoogleDriveOAuthOptions) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const connectGoogleDrive = async () => {
    if (!leadId || !organizationId) {
      toast({
        title: 'Erro',
        description: 'leadId e organizationId são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Obter URL de autorização
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-drive-oauth?action=get-auth-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ lead_id: leadId, organization_id: organizationId }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(error.error || 'Erro ao obter URL de autorização');
      }

      const { auth_url } = await response.json();

      // Abrir popup para autorização
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        auth_url,
        'Google Drive OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!popup) {
        throw new Error('Popup bloqueado. Permita popups para este site.');
      }

      // Aguardar callback
      const checkPopup = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkPopup);
          setLoading(false);
          
          // Verificar se conexão foi bem-sucedida
          const { data: config } = await supabase
            .from('client_google_drive_configs')
            .select('id')
            .eq('lead_id', leadId)
            .eq('organization_id', organizationId)
            .eq('is_active', true)
            .maybeSingle();

          if (config) {
            toast({
              title: 'Google Drive conectado',
              description: 'Conexão com Google Drive estabelecida com sucesso',
            });
            onSuccess?.();
          }
        }
      }, 1000);

      // Timeout após 5 minutos
      setTimeout(() => {
        if (!popup.closed) {
          popup.close();
          clearInterval(checkPopup);
          setLoading(false);
          toast({
            title: 'Timeout',
            description: 'Autorização cancelada ou expirada',
            variant: 'destructive',
          });
        }
      }, 300000);
    } catch (error: any) {
      console.error('Erro ao conectar Google Drive:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao conectar Google Drive',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const disconnectGoogleDrive = async () => {
    if (!leadId || !organizationId) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('client_google_drive_configs')
        .update({ is_active: false })
        .eq('lead_id', leadId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: 'Google Drive desconectado',
        description: 'Conexão com Google Drive removida',
      });
      onSuccess?.();
    } catch (error: any) {
      console.error('Erro ao desconectar Google Drive:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao desconectar Google Drive',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    connectGoogleDrive,
    disconnectGoogleDrive,
    loading,
  };
}

