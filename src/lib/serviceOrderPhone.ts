import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsActiveOrgAdmin } from '@/hooks/useOrgUserPermissions';

export function visibleClientPhone(
  order: {
    client_phone?: string | null;
    show_client_phone?: boolean | null;
    collaborator_user_id?: string | null;
  },
  viewer: { userId?: string | null; seesAll?: boolean }
): string {
  const phone = (order.client_phone || '').trim();
  if (!phone) return '';
  if (viewer.seesAll || order.show_client_phone) return phone;
  if (viewer.userId && order.collaborator_user_id === viewer.userId) return '';
  return phone;
}

export function useServiceOrderViewer() {
  const { isOrgAdmin, loading: adminLoading } = useIsActiveOrgAdmin();
  const [userId, setUserId] = useState<string | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id || null;
      if (!id || cancelled) {
        if (!cancelled) setUserId(null);
        return;
      }
      const { data: role } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!cancelled) {
        setUserId(id);
        setIsPlatformAdmin(Boolean(role));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    userId,
    seesAll: isOrgAdmin || isPlatformAdmin,
    loading: adminLoading,
  };
}
