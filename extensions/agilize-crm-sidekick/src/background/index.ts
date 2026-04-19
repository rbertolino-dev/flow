import { createClient, type Session } from "@supabase/supabase-js";
import { normalizePhone, isValidBrazilianPhone } from "../lib/phone";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CRM_APP_URL = import.meta.env.VITE_CRM_APP_URL as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn(
    "[Agilize Sidekick] Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env da raiz do projeto."
  );
}

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
    },
  });
}

async function getStoredSessionData(): Promise<{
  session: Session | null;
  activeOrgId: string | null;
}> {
  const data = await chrome.storage.session.get(["session", "activeOrgId"]);
  const raw = data.session as Session | null | undefined;
  const activeOrgId = (data.activeOrgId as string | null) ?? null;
  return { session: raw ?? null, activeOrgId };
}

async function setSessionFromPayload(session: Session | null, activeOrgId: string | null) {
  await chrome.storage.session.set({
    session,
    activeOrgId,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "agilize-selection",
      title: "Agilize: copiar seleção para o lead rápido",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "agilize-selection" && info.selectionText) {
    void chrome.storage.session.set({ pendingSelection: info.selectionText.trim() });
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  try {
    if (tab.url.startsWith("https://web.whatsapp.com/")) {
      await chrome.sidePanel.setOptions({ tabId, path: "panel.html", enabled: true });
    } else {
      await chrome.sidePanel.setOptions({ tabId, enabled: false });
    }
  } catch (e) {
    console.warn("[Agilize Sidekick] sidePanel:", e);
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => undefined);

type CreateLeadPayload = {
  name: string;
  phone: string;
  stageId: string | null;
  notes: string | null;
};

chrome.runtime.onMessage.addListener(
  (msg: Record<string, unknown>, _sender, sendResponse: (x: unknown) => void) => {
    if (msg.type === "CRM_SESSION_SYNC") {
      const payload = msg.payload as {
        session: Session | null;
        activeOrgId: string | null;
      };
      void (async () => {
        await setSessionFromPayload(payload.session, payload.activeOrgId);
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (msg.type === "GET_STATE") {
      void (async () => {
        const { session, activeOrgId } = await getStoredSessionData();
        const pending = await chrome.storage.session.get("pendingSelection");
        const pendingSelection = (pending.pendingSelection as string) || "";
        if (pendingSelection) {
          await chrome.storage.session.remove("pendingSelection");
        }
        sendResponse({
          connected: !!(session?.access_token && session?.refresh_token),
          activeOrgId,
          crmAppUrl: CRM_APP_URL || "http://localhost:8080",
          supabaseConfigured: !!(SUPABASE_URL && SUPABASE_ANON),
          pendingSelection,
        });
      })();
      return true;
    }

    if (msg.type === "FETCH_STAGES") {
      void (async () => {
        try {
          const { session, activeOrgId } = await getStoredSessionData();
          if (!session?.access_token || !activeOrgId) {
            sendResponse({ ok: false, error: "Sem sessão ou organização." });
            return;
          }
          const client = getSupabase();
          await client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          const { data, error } = await client
            .from("pipeline_stages")
            .select("id, name")
            .eq("organization_id", activeOrgId)
            .order("position", { ascending: true });
          if (error) throw error;
          sendResponse({ ok: true, stages: data ?? [] });
        } catch (e: unknown) {
          const err = e as Error;
          sendResponse({ ok: false, error: err?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg.type === "CREATE_LEAD") {
      const payload = msg.payload as CreateLeadPayload;
      void (async () => {
        try {
          const phone = normalizePhone(payload.phone);
          if (!isValidBrazilianPhone(phone)) {
            sendResponse({ ok: false, error: "Telefone brasileiro inválido (10 ou 11 dígitos)." });
            return;
          }
          const { session, activeOrgId } = await getStoredSessionData();
          if (!session?.access_token || !session.refresh_token) {
            sendResponse({
              ok: false,
              error: "Sem sessão. Abra o CRM no navegador e faça login.",
            });
            return;
          }
          if (!activeOrgId) {
            sendResponse({
              ok: false,
              error: "Sem organização ativa. Abra o CRM e selecione a organização.",
            });
            return;
          }
          const client = getSupabase();
          const { error: sessionError } = await client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (sessionError) throw sessionError;

          const { data: leadId, error } = await client.rpc("create_lead_secure", {
            p_org_id: activeOrgId,
            p_name: payload.name.trim(),
            p_phone: phone,
            p_email: null,
            p_company: null,
            p_value: null,
            p_stage_id: payload.stageId || null,
            p_notes: payload.notes?.trim() || null,
            p_source: "chrome_extension",
          });
          if (error) throw error;
          sendResponse({ ok: true, leadId: leadId as string });
        } catch (e: unknown) {
          const err = e as Error;
          sendResponse({ ok: false, error: err?.message || String(e) });
        }
      })();
      return true;
    }

    if (msg.type === "OPEN_BUDGET_TAB") {
      const leadId = msg.leadId as string;
      void (async () => {
        const base = (CRM_APP_URL || "http://localhost:8080").replace(/\/$/, "");
        const url = `${base}/budgets?leadId=${encodeURIComponent(leadId)}&createBudget=1`;
        await chrome.tabs.create({ url });
        sendResponse({ ok: true });
      })();
      return true;
    }

    if (msg.type === "OPEN_CRM_TAB") {
      const path = (msg.path as string) || "/crm";
      void (async () => {
        const base = (CRM_APP_URL || "http://localhost:8080").replace(/\/$/, "");
        await chrome.tabs.create({ url: `${base}${path.startsWith("/") ? path : `/${path}`}` });
        sendResponse({ ok: true });
      })();
      return true;
    }

    return false;
  }
);
