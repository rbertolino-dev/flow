import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Service } from "@/types/budget-module";
import { useToast } from "@/hooks/use-toast";

export function useServices() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar serviços via edge function
  const { data: services = [], isLoading, error } = useQuery({
    queryKey: ['services', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Usar fetch diretamente para poder passar query params (active_only=false)
      // Isso garante que TODOS os serviços sejam retornados, não apenas os ativos
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/get-services?active_only=false`;
      
      const fetchResponse = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey || '',
          'Content-Type': 'application/json',
        },
      });
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Erro ${fetchResponse.status}` };
        }
        console.error('Erro ao buscar serviços:', errorData);
        throw new Error(errorData.error || `Erro ${fetchResponse.status}`);
      }
      
      const responseData = await fetchResponse.json();

      // Garantir que retornamos um array mesmo se data for undefined
      const servicesData = responseData?.data || [];
      console.log('✅ Serviços carregados do servidor:', servicesData.length);
      if (servicesData.length > 0) {
        console.log('📋 IDs dos serviços:', servicesData.map((s: Service) => s.id));
        console.log('📋 Nomes dos serviços:', servicesData.map((s: Service) => s.name));
      }
      
      // Garantir que todos os serviços têm os campos obrigatórios
      const validServices = servicesData.filter((s: any) => {
        if (!s || !s.id || !s.name) {
          console.warn('⚠️ Serviço inválido filtrado:', s);
          return false;
        }
        return true;
      });
      
      if (validServices.length !== servicesData.length) {
        console.warn(`⚠️ ${servicesData.length - validServices.length} serviço(s) foram filtrados por falta de dados obrigatórios`);
      }
      
      return validServices as Service[];
    },
    enabled: !!activeOrgId,
    // Refetch quando a janela ganha foco para garantir dados atualizados
    refetchOnWindowFocus: true,
    // Cache por 30 segundos apenas (reduzido para garantir atualizações mais frequentes)
    staleTime: 30 * 1000,
    // Refetch a cada 1 minuto em background
    refetchInterval: 60 * 1000,
  });

  // Criar serviço
  const createService = useMutation({
    mutationFn: async (serviceData: {
      name: string;
      description?: string;
      price: number;
      category?: string;
      is_active?: boolean;
    }) => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('get-services', {
        method: 'POST',
        body: serviceData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        console.error('❌ Erro ao criar serviço:', response.error);
        throw response.error;
      }

      // Verificar se a resposta tem o formato correto
      const createdService = response.data?.data;
      if (!createdService) {
        console.error('❌ Resposta inválida da edge function:', response.data);
        throw new Error('Resposta inválida do servidor');
      }

      console.log('✅ Serviço criado com sucesso:', createdService);
      return createdService as Service;
    },
    onSuccess: (newService, variables, context) => {
      console.log('🔄 Atualizando cache com novo serviço:', newService);
      
      // Atualizar cache diretamente para aparecer imediatamente na lista
      queryClient.setQueryData<Service[]>(['services', activeOrgId], (oldData = []) => {
        // Verificar se o serviço já existe (evitar duplicatas)
        const exists = oldData.some(s => s.id === newService.id);
        if (exists) {
          console.log('⚠️ Serviço já existe no cache, atualizando...');
          return oldData.map(s => s.id === newService.id ? newService : s);
        }
        console.log('✅ Adicionando novo serviço ao cache');
        return [...oldData, newService];
      });
      
      // Refetch em background após um pequeno delay para garantir sincronização
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['services', activeOrgId] });
      }, 500);
      
      toast({
        title: "Serviço criado",
        description: "O serviço foi criado com sucesso.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Erro ao criar serviço:', error);
      toast({
        title: "Erro ao criar serviço",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    },
  });

  // Atualizar serviço
  const updateService = useMutation({
    mutationFn: async ({ id, ...serviceData }: Partial<Service> & { id: string }) => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('get-services', {
        method: 'POST',
        body: { id, ...serviceData },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;

      return response.data?.data as Service;
    },
    onSuccess: (updatedService) => {
      // Atualizar cache diretamente para aparecer imediatamente na lista
      queryClient.setQueryData<Service[]>(['services', activeOrgId], (oldData = []) => {
        return oldData.map(s => s.id === updatedService.id ? updatedService : s);
      });
      
      // Refetch em background para garantir sincronização
      queryClient.invalidateQueries({ queryKey: ['services', activeOrgId] });
      
      toast({
        title: "Serviço atualizado",
        description: "O serviço foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Deletar serviço
  const deleteService = useMutation({
    mutationFn: async (serviceId: string) => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Usar fetch diretamente para fazer DELETE
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/get-services?id=${serviceId}`;
      
      const fetchResponse = await fetch(functionUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey || '',
          'Content-Type': 'application/json',
        },
      });
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Erro ${fetchResponse.status}` };
        }
        throw new Error(errorData.error || `Erro ${fetchResponse.status}`);
      }

      return serviceId;
    },
    onSuccess: (deletedServiceId) => {
      // Remover do cache diretamente
      queryClient.setQueryData<Service[]>(['services', activeOrgId], (oldData = []) => {
        return oldData.filter(s => s.id !== deletedServiceId);
      });
      
      // Refetch em background para garantir sincronização
      queryClient.invalidateQueries({ queryKey: ['services', activeOrgId] });
      
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Criar múltiplos serviços (para importação em massa)
  const createServicesBulk = useMutation({
    mutationFn: async (servicesData: Array<{
      name: string;
      description?: string;
      price: number;
      category?: string;
      is_active?: boolean;
    }>) => {
      if (!activeOrgId) throw new Error('Organização não encontrada');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Limitar a 100 serviços por vez
      if (servicesData.length > 100) {
        throw new Error('Limite de 100 serviços por importação. Por favor, divida em múltiplas planilhas.');
      }

      // Criar serviços em lote
      const results = [];
      const errors = [];

      for (const serviceData of servicesData) {
        try {
          const response = await supabase.functions.invoke('get-services', {
            method: 'POST',
            body: serviceData,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (response.error) {
            errors.push({ service: serviceData.name, error: response.error.message });
          } else {
            results.push(response.data?.data as Service);
          }
        } catch (error: any) {
          errors.push({ service: serviceData.name, error: error.message });
        }
      }

      if (errors.length > 0) {
        throw new Error(`${errors.length} serviço(s) falharam: ${errors.map(e => e.service).join(', ')}`);
      }

      return results;
    },
    onSuccess: (newServices) => {
      // Atualizar cache diretamente
      queryClient.setQueryData<Service[]>(['services', activeOrgId], (oldData = []) => {
        const existingIds = new Set(oldData.map(s => s.id));
        const newServicesToAdd = newServices.filter(s => !existingIds.has(s.id));
        return [...oldData, ...newServicesToAdd];
      });
      
      // Refetch em background
      queryClient.invalidateQueries({ queryKey: ['services', activeOrgId] });
      
      toast({
        title: "Serviços importados",
        description: `${newServices.length} serviço(s) foram importados com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao importar serviços",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Serviços ativos
  const activeServices = services.filter(s => s.is_active);

  // Obter categorias únicas dos serviços
  const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean) as string[])).sort();

  return {
    services,
    activeServices,
    categories,
    loading: isLoading,
    error,
    createService, // Retornar objeto completo da mutation
    updateService, // Retornar objeto completo da mutation
    deleteService, // Retornar objeto completo da mutation
    createServicesBulk, // Retornar objeto completo da mutation
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['services', activeOrgId] });
      return queryClient.refetchQueries({ queryKey: ['services', activeOrgId] });
    },
  };
}
