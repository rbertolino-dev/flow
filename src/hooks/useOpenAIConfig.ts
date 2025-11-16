import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActiveOrganization } from './useActiveOrganization';

interface OpenAIConfig {
  id: string;
  organization_id: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export function useOpenAIConfig() {
  const [config, setConfig] = useState<OpenAIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { activeOrgId } = useActiveOrganization();

  useEffect(() => {
    if (activeOrgId) {
      fetchConfig();
    }
  }, [activeOrgId]);

  const fetchConfig = async () => {
    if (!activeOrgId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('openai_configs')
        .select('*')
        .eq('organization_id', activeOrgId)
        .maybeSingle();

      if (error) throw error;
      setConfig(data);
    } catch (error) {
      console.error('Erro ao buscar configuração OpenAI:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a configuração OpenAI.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (apiKey: string) => {
    if (!activeOrgId) {
      toast({
        title: 'Erro',
        description: 'Organização não identificada.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('openai_configs')
        .upsert({
          organization_id: activeOrgId,
          api_key: apiKey,
        })
        .select()
        .single();

      if (error) throw error;

      setConfig(data);
      toast({
        title: 'Sucesso',
        description: 'Configuração OpenAI salva com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao salvar configuração OpenAI:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a configuração OpenAI.',
        variant: 'destructive',
      });
    }
  };

  const deleteConfig = async () => {
    if (!config?.id) return;

    try {
      const { error } = await supabase
        .from('openai_configs')
        .delete()
        .eq('id', config.id);

      if (error) throw error;

      setConfig(null);
      toast({
        title: 'Sucesso',
        description: 'Configuração OpenAI removida.',
      });
    } catch (error) {
      console.error('Erro ao deletar configuração OpenAI:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover a configuração OpenAI.',
        variant: 'destructive',
      });
    }
  };

  return {
    config,
    loading,
    saveConfig,
    deleteConfig,
    refetch: fetchConfig,
  };
}
