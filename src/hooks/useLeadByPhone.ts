import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "./useActiveOrganization";

/**
 * Hook para verificar se um telefone tem lead no funil
 */
export function useLeadByPhone(phoneNumber: string | null | undefined) {
  const { activeOrgId } = useActiveOrganization();
  
  return useQuery({
    queryKey: ['lead-by-phone', activeOrgId, phoneNumber],
    queryFn: async () => {
      if (!activeOrgId || !phoneNumber) return null;
      
      // Normalizar telefone (remover caracteres não numéricos)
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      
      if (!normalizedPhone) return null;
      
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, stage_id, status, source_instance_name')
        .eq('phone', normalizedPhone)
        .eq('organization_id', activeOrgId)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (error) {
        console.error('Erro ao buscar lead:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!activeOrgId && !!phoneNumber && phoneNumber.replace(/\D/g, '').length > 0,
  });
}

/**
 * Hook para buscar múltiplos leads por telefones (batch)
 */
export function useLeadsByPhones(phoneNumbers: string[]) {
  const { activeOrgId } = useActiveOrganization();
  
  return useQuery({
    queryKey: ['leads-by-phones', activeOrgId, phoneNumbers.sort().join(',')],
    queryFn: async () => {
      if (!activeOrgId || phoneNumbers.length === 0) return {};
      
      // Normalizar telefones
      const normalizedPhones = phoneNumbers
        .map(p => p.replace(/\D/g, ''))
        .filter(p => p.length > 0);
      
      if (normalizedPhones.length === 0) return {};
      
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, stage_id, status, source_instance_name')
        .eq('organization_id', activeOrgId)
        .in('phone', normalizedPhones)
        .is('deleted_at', null);
      
      if (error) {
        console.error('Erro ao buscar leads:', error);
        return {};
      }
      
      // Criar mapa phone -> lead
      const leadMap: Record<string, any> = {};
      data?.forEach(lead => {
        leadMap[lead.phone] = lead;
      });
      
      return leadMap;
    },
    enabled: !!activeOrgId && phoneNumbers.length > 0,
  });
}


