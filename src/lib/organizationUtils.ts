import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'active_organization_id';
const ORG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

interface OrgCache {
  orgId: string;
  userId: string;
  verifiedAt: number;
}

// Cache em memória: evita getUser() + organization_members em cada hook que monta em paralelo
let _orgCache: OrgCache | null = null;

/** Invalida o cache (chamar quando o usuário troca de organização) */
export function invalidateOrgCache(): void {
  _orgCache = null;
}

export async function getUserOrganizationId(): Promise<string | null> {
  const activeOrgId = localStorage.getItem(STORAGE_KEY);

  // Cache em memória ainda válido para o mesmo org: zero chamadas API
  if (
    activeOrgId &&
    _orgCache &&
    _orgCache.orgId === activeOrgId &&
    Date.now() - _orgCache.verifiedAt < ORG_CACHE_TTL_MS
  ) {
    return activeOrgId;
  }

  // getSession() lê do localStorage (sem requisição de rede para sessões válidas não expiradas)
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const userId = session.user.id;

  if (activeOrgId) {
    // Verifica no DB se o usuário ainda pertence a essa organização
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', activeOrgId)
      .maybeSingle();

    if (membership) {
      _orgCache = { orgId: activeOrgId, userId, verifiedAt: Date.now() };
      return activeOrgId;
    }

    // Não pertence mais — limpar localStorage e cache
    localStorage.removeItem(STORAGE_KEY);
    _orgCache = null;
  }

  // Fallback: buscar primeira organização disponível
  const { data } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const orgId = data?.organization_id || null;

  if (orgId) {
    localStorage.setItem(STORAGE_KEY, orgId);
    _orgCache = { orgId, userId, verifiedAt: Date.now() };
  }

  return orgId;
}

export async function ensureUserOrganization(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Usuário não autenticado');

  // Tenta pegar organização ativa primeiro
  const activeOrgId = await getUserOrganizationId();
  if (activeOrgId) return activeOrgId;

  // Se não houver organização, cria uma padrão para o usuário atual
  const user = session.user;
  const friendlyName = `Organização de ${user.email?.split('@')[0] || 'Usuário'}`;
  const { data: createdOrgId, error: createErr } = await supabase
    .rpc('create_organization_with_owner', { org_name: friendlyName });

  if (createErr) throw createErr;
  if (!createdOrgId) throw new Error('Falha ao criar organização padrão');

  const orgId = createdOrgId as string;
  localStorage.setItem(STORAGE_KEY, orgId);
  _orgCache = { orgId, userId: user.id, verifiedAt: Date.now() };

  return orgId;
}
