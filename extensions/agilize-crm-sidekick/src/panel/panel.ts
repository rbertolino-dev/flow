import "./panel.css";
import { isValidBrazilianPhone, normalizePhone, extractPhonesFromText } from "../lib/phone";

type GetStateResponse = {
  connected: boolean;
  activeOrgId: string | null;
  crmAppUrl: string;
  supabaseConfigured: boolean;
  pendingSelection: string;
};

type StagesResponse =
  | { ok: true; stages: { id: string; name: string }[] }
  | { ok: false; error: string };

type CreateLeadResponse =
  | { ok: true; leadId: string }
  | { ok: false; error: string };

function el<T extends HTMLElement>(id: string): T {
  const n = document.getElementById(id);
  if (!n) throw new Error(`Missing #${id}`);
  return n as T;
}

let lastLeadId: string | null = null;

async function getState(): Promise<GetStateResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (r) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(r as GetStateResponse);
    });
  });
}

async function fetchStages(): Promise<{ id: string; name: string }[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "FETCH_STAGES" }, (r: StagesResponse) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else if (r.ok) resolve(r.stages);
      else reject(new Error(r.error));
    });
  });
}

async function createLead(payload: {
  name: string;
  phone: string;
  stageId: string | null;
  notes: string | null;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "CREATE_LEAD", payload }, (r: CreateLeadResponse) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else if (r.ok) resolve(r.leadId);
      else reject(new Error(r.error));
    });
  });
}

function setMsg(text: string, kind: "ok" | "err" | "") {
  const m = el("msg");
  m.textContent = text;
  m.classList.remove("ok", "err");
  if (kind) m.classList.add(kind);
}

function showDisconnected(state: GetStateResponse) {
  el("block-disconnected").classList.remove("hidden");
  el("block-form").classList.add("hidden");
  const pill = el("conn-pill");
  pill.textContent = state.supabaseConfigured ? "Sem sessão CRM" : "Env não configurado (build)";
  pill.className = "pill off";
}

function showForm() {
  el("block-disconnected").classList.add("hidden");
  el("block-form").classList.remove("hidden");
  const pill = el("conn-pill");
  pill.textContent = "Conectado ao CRM";
  pill.className = "pill on";
}

async function refreshUI() {
  const state = await getState();
  if (!state.supabaseConfigured) {
    showDisconnected(state);
    return;
  }
  if (!state.connected) {
    showDisconnected(state);
    return;
  }
  showForm();
  try {
    const stages = await fetchStages();
    const sel = el<HTMLSelectElement>("field-stage");
    const keep = sel.value;
    sel.innerHTML = '<option value="">— Selecionar —</option>';
    for (const s of stages) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.name;
      sel.appendChild(o);
    }
    if (keep && stages.some((x) => x.id === keep)) sel.value = keep;
  } catch (e) {
    setMsg((e as Error).message, "err");
  }

  if (state.pendingSelection) {
    const phones = extractPhonesFromText(state.pendingSelection);
    if (phones.length > 0) {
      el<HTMLInputElement>("field-phone").value = phones[0];
    }
    const lines = state.pendingSelection.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!el<HTMLInputElement>("field-name").value && lines.length > 0) {
      const maybeName = lines.find((l) => !/^\+?\d[\d\s\-().]+$/.test(l));
      if (maybeName) el<HTMLInputElement>("field-name").value = maybeName.slice(0, 120);
    }
  }
}

async function onSave() {
  setMsg("", "");
  lastLeadId = null;
  el("post-actions").classList.add("hidden");

  const name = el<HTMLInputElement>("field-name").value.trim();
  const phoneRaw = el<HTMLInputElement>("field-phone").value;
  const stageId = el<HTMLSelectElement>("field-stage").value || null;
  const notes = el<HTMLTextAreaElement>("field-notes").value.trim() || null;

  if (!name) {
    setMsg("Informe o nome.", "err");
    return;
  }
  const phone = normalizePhone(phoneRaw);
  if (!isValidBrazilianPhone(phone)) {
    setMsg("Telefone inválido (use DDD + número, 10 ou 11 dígitos).", "err");
    return;
  }

  try {
    el<HTMLButtonElement>("btn-save").disabled = true;
    const leadId = await createLead({ name, phone, stageId, notes });
    lastLeadId = leadId;
    setMsg("Lead criado com sucesso.", "ok");
    el("post-actions").classList.remove("hidden");
  } catch (e) {
    setMsg((e as Error).message, "err");
  } finally {
    el<HTMLButtonElement>("btn-save").disabled = false;
  }
}

function openCrm(path: string) {
  chrome.runtime.sendMessage({ type: "OPEN_CRM_TAB", path });
}

function openBudgetTab() {
  if (!lastLeadId) return;
  chrome.runtime.sendMessage({ type: "OPEN_BUDGET_TAB", leadId: lastLeadId });
}

document.addEventListener("DOMContentLoaded", () => {
  el("btn-retry").addEventListener("click", () => void refreshUI());
  el("btn-open-crm").addEventListener("click", () => openCrm("/"));
  el("btn-save").addEventListener("click", () => void onSave());
  el("btn-budget").addEventListener("click", () => openBudgetTab());
  el("btn-crm").addEventListener("click", () => openCrm("/crm"));

  el("btn-paste").addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      el<HTMLInputElement>("field-phone").value = t;
      setMsg("Colado do clipboard.", "ok");
    } catch {
      setMsg("Não foi possível ler o clipboard (permissão ou contexto).", "err");
    }
  });

  void refreshUI();
});
