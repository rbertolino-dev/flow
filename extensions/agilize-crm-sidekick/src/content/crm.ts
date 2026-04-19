/**
 * Roda apenas nas URLs configuradas em manifest (CRM).
 * Lê sessão Supabase e active_organization_id do localStorage da página.
 */

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
  user?: unknown;
};

function parseStoredSession(raw: string | null): SessionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const inner = (parsed.currentSession as SessionPayload | undefined) || (parsed as unknown as SessionPayload);
    if (inner?.access_token && inner?.refresh_token) {
      return {
        access_token: inner.access_token,
        refresh_token: inner.refresh_token,
        expires_at: inner.expires_at,
        expires_in: inner.expires_in,
        token_type: inner.token_type,
        user: inner.user,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function findSupabaseSession(): SessionPayload | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-[\w-]+-auth-token$/.test(k)) continue;
      const parsed = parseStoredSession(localStorage.getItem(k));
      if (parsed) return parsed;
    }
  } catch {
    /* private mode / blocked */
  }
  return null;
}

function syncToExtension(): void {
  const session = findSupabaseSession();
  const activeOrgId = localStorage.getItem("active_organization_id");
  if (!session) {
    void chrome.runtime.sendMessage({
      type: "CRM_SESSION_SYNC",
      payload: { session: null, activeOrgId: activeOrgId || null, origin: location.origin },
    });
    return;
  }
  void chrome.runtime.sendMessage({
    type: "CRM_SESSION_SYNC",
    payload: {
      session,
      activeOrgId: activeOrgId || null,
      origin: location.origin,
    },
  });
}

syncToExtension();

const interval = window.setInterval(syncToExtension, 45_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") syncToExtension();
});

window.addEventListener("storage", (e) => {
  if (e.key === "active_organization_id" || (e.key && /^sb-[\w-]+-auth-token$/.test(e.key))) {
    syncToExtension();
  }
});

window.addEventListener("beforeunload", () => {
  window.clearInterval(interval);
});
