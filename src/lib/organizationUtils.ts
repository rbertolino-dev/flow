import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'active_organization_id';

export async function getUserOrganizationId(): Promise<string | null> {
  // Primeiro tenta pegar a organização ativa do localStorage
  const activeOrgId = localStorage.getItem(STORAGE_KEY);
  
  if (activeOrgId) {
    // Verificar se o usuário ainda pertence a essa organização
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('organization_id', activeOrgId)
      .maybeSingle();

    if (membership) {
      return activeOrgId;
    }
    
    // Se não pertence mais, limpar do localStorage
    localStorage.removeItem(STORAGE_KEY);
  }

  // Se não tem no localStorage ou não é mais membro, pegar a primeira organização
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const orgId = data?.organization_id || null;
  
  // Salvar no localStorage para próximas consultas
  if (orgId) {
    localStorage.setItem(STORAGE_KEY, orgId);
  }

  return orgId;
}

export async function ensureUserOrganization(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Tenta pegar organização ativa primeiro
  const activeOrgId = await getUserOrganizationId();
  if (activeOrgId) return activeOrgId;

  // Se não houver organização, cria uma padrão para o usuário atual
  const friendlyName = `Organização de ${user.email?.split('@')[0] || 'Usuário'}`;
  const { data: createdOrgId, error: createErr } = await supabase
    .rpc('create_organization_with_owner', { org_name: friendlyName });

  if (createErr) throw createErr;
  if (!createdOrgId) throw new Error('Falha ao criar organização padrão');

  // Salvar no localStorage
  localStorage.setItem(STORAGE_KEY, createdOrgId as string);

  return createdOrgId as string;
}
