import { supabase } from '@/integrations/supabase/client';

export async function getUserOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.organization_id || null;
}

export async function ensureUserOrganization(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Tenta via RPC segura (respeita políticas e evita problemas de visibilidade)
  const { data: existingOrgId, error: orgErr } = await supabase
    .rpc('get_user_organization', { _user_id: user.id });
  if (orgErr) throw orgErr;
  if (existingOrgId) return existingOrgId as string;

  // Se não houver organização, cria uma padrão para o usuário atual
  const friendlyName = `Organização de ${user.email?.split('@')[0] || 'Usuário'}`;
  const { data: createdOrgId, error: createErr } = await supabase
    .rpc('create_organization_with_owner', { org_name: friendlyName });

  if (createErr) throw createErr;
  if (!createdOrgId) throw new Error('Falha ao criar organização padrão');

  return createdOrgId as string;
}
