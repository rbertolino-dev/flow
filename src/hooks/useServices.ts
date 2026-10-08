import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Service } from "@/types/budget-module";
import { useToast } from "@/hooks/use-toast";

function servicesFunctionUrl(pathQuery = "") {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/get-services${pathQuery}`;
}

function orgScopedHeaders(accessToken: string, organizationId: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    "Content-Type": "application/json",
    "x-organization-id": organizationId,
  };
}

function onlyOrgServices(rows: Service[] | undefined, organizationId: string): Service[] {
  return (rows || []).filter(
    (service) =>
      !!service?.id &&
      !!service?.name &&
      service.organization_id === organizationId
  );
}

export function useServices() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: servicesRaw = [], isLoading, error } = useQuery({
    queryKey: ["services", activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const functionUrl = `${servicesFunctionUrl(
        `?active_only=false&organization_id=${encodeURIComponent(activeOrgId)}`
      )}`;

      const fetchResponse = await fetch(functionUrl, {
        method: "GET",
        headers: orgScopedHeaders(session.access_token, activeOrgId),
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorData: { error?: string };
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Erro ${fetchResponse.status}` };
        }
        console.error("Erro ao buscar serviços:", errorData);
        throw new Error(errorData.error || `Erro ${fetchResponse.status}`);
      }

      const responseData = await fetchResponse.json();
      const servicesData = (responseData?.data || []) as Service[];
      return onlyOrgServices(servicesData, activeOrgId);
    },
    enabled: !!activeOrgId,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  const services = useMemo(
    () => (activeOrgId ? onlyOrgServices(servicesRaw, activeOrgId) : []),
    [servicesRaw, activeOrgId]
  );

  const createService = useMutation({
    mutationFn: async (serviceData: {
      name: string;
      description?: string;
      price: number;
      category?: string;
      image_url?: string | null;
      tax_class_ref?: string | null;
      is_active?: boolean;
    }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const fetchResponse = await fetch(servicesFunctionUrl(), {
        method: "POST",
        headers: orgScopedHeaders(session.access_token, activeOrgId),
        body: JSON.stringify({ ...serviceData, organization_id: activeOrgId }),
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({ error: "Erro ao criar serviço" }));
        throw new Error(errorData.error || "Erro ao criar serviço");
      }

      const responseData = await fetchResponse.json();
      const createdService = responseData?.data as Service | undefined;
      if (!createdService?.id || createdService.organization_id !== activeOrgId) {
        throw new Error("Resposta inválida do servidor (organização)");
      }

      return createdService;
    },
    onSuccess: (newService) => {
      queryClient.setQueryData<Service[]>(["services", activeOrgId], (oldData = []) => {
        const scoped = onlyOrgServices(oldData, activeOrgId!);
        const exists = scoped.some((s) => s.id === newService.id);
        if (exists) {
          return scoped.map((s) => (s.id === newService.id ? newService : s));
        }
        return [...scoped, newService];
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["services", activeOrgId] });
      }, 500);

      toast({
        title: "Serviço criado",
        description: "O serviço foi criado com sucesso nesta organização.",
      });
    },
    onError: (error: Error) => {
      console.error("Erro ao criar serviço:", error);
      toast({
        title: "Erro ao criar serviço",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, ...serviceData }: Partial<Service> & { id: string }) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const fetchResponse = await fetch(servicesFunctionUrl(), {
        method: "POST",
        headers: orgScopedHeaders(session.access_token, activeOrgId),
        body: JSON.stringify({ id, ...serviceData, organization_id: activeOrgId }),
      });

      if (!fetchResponse.ok) {
        const errorData = await fetchResponse.json().catch(() => ({ error: "Erro ao atualizar serviço" }));
        throw new Error(errorData.error || "Erro ao atualizar serviço");
      }

      const responseData = await fetchResponse.json();
      const updated = responseData?.data as Service | undefined;
      if (!updated?.id || updated.organization_id !== activeOrgId) {
        throw new Error("Resposta inválida do servidor (organização)");
      }
      return updated;
    },
    onSuccess: (updatedService) => {
      queryClient.setQueryData<Service[]>(["services", activeOrgId], (oldData = []) =>
        onlyOrgServices(oldData, activeOrgId!).map((s) =>
          s.id === updatedService.id ? updatedService : s
        )
      );
      queryClient.invalidateQueries({ queryKey: ["services", activeOrgId] });
      toast({
        title: "Serviço atualizado",
        description: "O serviço foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (serviceId: string) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const functionUrl = servicesFunctionUrl(
        `?id=${encodeURIComponent(serviceId)}&organization_id=${encodeURIComponent(activeOrgId)}`
      );

      const fetchResponse = await fetch(functionUrl, {
        method: "DELETE",
        headers: orgScopedHeaders(session.access_token, activeOrgId),
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        let errorData: { error?: string };
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
      queryClient.setQueryData<Service[]>(["services", activeOrgId], (oldData = []) =>
        onlyOrgServices(oldData, activeOrgId!).filter((s) => s.id !== deletedServiceId)
      );
      queryClient.invalidateQueries({ queryKey: ["services", activeOrgId] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso desta organização.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir serviço",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createServicesBulk = useMutation({
    mutationFn: async (
      servicesData: Array<{
        name: string;
        description?: string;
        price: number;
        category?: string;
        is_active?: boolean;
      }>
    ) => {
      if (!activeOrgId) throw new Error("Organização não encontrada");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      if (servicesData.length > 100) {
        throw new Error(
          "Limite de 100 serviços por importação. Por favor, divida em múltiplas planilhas."
        );
      }

      const results: Service[] = [];
      const errors: Array<{ service: string; error: string }> = [];

      for (const serviceData of servicesData) {
        try {
          const fetchResponse = await fetch(servicesFunctionUrl(), {
            method: "POST",
            headers: orgScopedHeaders(session.access_token, activeOrgId),
            body: JSON.stringify({ ...serviceData, organization_id: activeOrgId }),
          });

          if (!fetchResponse.ok) {
            const errorData = await fetchResponse
              .json()
              .catch(() => ({ error: "Erro ao criar serviço" }));
            errors.push({
              service: serviceData.name,
              error: errorData.error || "Erro ao criar",
            });
            continue;
          }

          const responseData = await fetchResponse.json();
          const created = responseData?.data as Service | undefined;
          if (!created?.id || created.organization_id !== activeOrgId) {
            errors.push({
              service: serviceData.name,
              error: "Organização inválida na resposta",
            });
            continue;
          }
          results.push(created);
        } catch (error: unknown) {
          errors.push({
            service: serviceData.name,
            error: error instanceof Error ? error.message : "Erro desconhecido",
          });
        }
      }

      if (errors.length > 0) {
        throw new Error(
          `${errors.length} serviço(s) falharam: ${errors.map((e) => e.service).join(", ")}`
        );
      }

      return results;
    },
    onSuccess: (newServices) => {
      queryClient.setQueryData<Service[]>(["services", activeOrgId], (oldData = []) => {
        const scoped = onlyOrgServices(oldData, activeOrgId!);
        const existingIds = new Set(scoped.map((s) => s.id));
        const newServicesToAdd = newServices.filter((s) => !existingIds.has(s.id));
        return [...scoped, ...newServicesToAdd];
      });
      queryClient.invalidateQueries({ queryKey: ["services", activeOrgId] });
      toast({
        title: "Serviços importados",
        description: `${newServices.length} serviço(s) foram importados nesta organização.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao importar serviços",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeServices = services.filter((s) => s.is_active);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (!activeOrgId) {
      setCategories([]);
      return;
    }

    const serviceCategoriesFromStorage = (() => {
      try {
        const stored = localStorage.getItem(`service_categories_${activeOrgId}`);
        if (stored) {
          return JSON.parse(stored) as string[];
        }
      } catch {
        // ignore
      }
      return [];
    })();

    const categoriesFromServices = Array.from(
      new Set((services || []).map((s) => s.category).filter(Boolean) as string[])
    );

    const allCategories = Array.from(
      new Set([...categoriesFromServices, ...serviceCategoriesFromStorage])
    ).sort();
    setCategories(allCategories);

    if (allCategories.length > 0) {
      localStorage.setItem(
        `service_categories_${activeOrgId}`,
        JSON.stringify(allCategories)
      );
    }
  }, [activeOrgId, services]);

  useEffect(() => {
    const handleCategoryCreated = (event: CustomEvent) => {
      const newCategory = event.detail as string;
      setCategories((prev) => {
        if (!prev.includes(newCategory)) {
          return [...prev, newCategory].sort();
        }
        return prev;
      });
    };

    const handleCategoryRenamed = (event: CustomEvent<{ from: string; to: string }>) => {
      const { from, to } = event.detail;
      setCategories((prev) =>
        Array.from(new Set(prev.map((c) => (c === from ? to : c)))).sort()
      );
    };

    window.addEventListener(
      "service-category-created",
      handleCategoryCreated as EventListener
    );
    window.addEventListener(
      "service-category-renamed",
      handleCategoryRenamed as EventListener
    );
    return () => {
      window.removeEventListener(
        "service-category-created",
        handleCategoryCreated as EventListener
      );
      window.removeEventListener(
        "service-category-renamed",
        handleCategoryRenamed as EventListener
      );
    };
  }, []);

  return {
    services,
    activeServices,
    categories,
    loading: isLoading,
    error,
    createService,
    updateService,
    deleteService,
    createServicesBulk,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ["services", activeOrgId] });
      return queryClient.refetchQueries({ queryKey: ["services", activeOrgId] });
    },
  };
}
