import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENTE_BATCH_DELAY_MS,
  CLIENTE_BATCH_SIZE,
  fieldsForTipo,
  type ClienteImportTipo,
} from "@/lib/agilizeClientesFields";
import { normalizeColumnName } from "@/utils/normalizeExcelColumn";

export type ClienteColumnMapping = Record<string, string>;

export interface ValidateClienteEmpresaResult {
  ok: boolean;
  empresaId: string;
  empresaCadastro: { found: boolean; nome?: string };
  contatoCount: number;
  empresaContatoCount: number;
  productCount: number;
  sample: Array<{ ID: number; nome: string; telefone?: string; categoria?: string }>;
  nameWarning: string | null;
}

export interface ClienteDryRunResult {
  ok: boolean;
  tipo: ClienteImportTipo;
  totals: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    willUpdate: number;
  };
  preview: Record<string, unknown>[];
  invalid: Array<{ row: number; error: string }>;
  duplicates: Array<{ row: number; nome: string; matchBy: string; existingId: number }>;
  willUpdate: Array<{ row: number; nome: string; matchBy: string; existingId: number }>;
  sessionToken: string;
}

export interface ClienteImportProgress {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  logs: string[];
}

const EMPTY: ClienteImportProgress = {
  status: "idle",
  processed: 0,
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  logs: [],
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  let token = sessionData.session?.access_token;
  if (!token) {
    const refreshed = await supabase.auth.refreshSession();
    token = refreshed.data.session?.access_token;
  }
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const response = await fetch(`${supabaseUrl}/functions/v1/agilize-eclientes-import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!response.ok || data.error) {
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data as T;
}

const ALIASES: Record<string, string> = {
  nome: "nome",
  cnpj: "cnpj",
  cnpjoucpf: "cnpj ou cpf",
  cpf: "cnpj ou cpf",
  telefone: "telefone",
  fone: "telefone",
  email: "email",
  cargo: "cargo",
  departamento: "departamento",
  categoria: "categoria",
  origem: "origem",
  endereco: "endereço",
  numero: "n do endereço",
  n: "n do endereço",
  bairro: "bairro",
  cidade: "cidade",
  estado: "estado",
  uf: "estado",
  cep: "cep",
  site: "site",
  setor: "setor",
  tamanho: "tamanho",
  observacoes: "observações",
  obs: "observações",
  desativado: "desativado",
  inscricaoestadual: "inscrição estadual",
  ie: "inscrição estadual",
  complemento: "complemento",
  rua: "rua",
  logradouro: "logradouro",
  responsavel: "responsável",
  empresadocontato: "empresa do contato",
};

export function autoMapClienteColumns(
  headers: string[],
  tipo: ClienteImportTipo
): ClienteColumnMapping {
  const allowed = new Set(fieldsForTipo(tipo));
  const mapping: ClienteColumnMapping = {};
  for (const header of headers) {
    const key = normalizeColumnName(header);
    let field = ALIASES[key] || "";
    if (tipo === "contato" && field === "email") field = "Email";
    if (tipo === "contato" && field === "cep") field = "CEP";
    if (tipo === "empresa" && field === "responsável") field = "responsável";
    if (tipo === "contato" && field === "responsável") field = "";
    if (field === "empresa do contato" && tipo !== "contato") field = "";
    if (field && !allowed.has(field)) field = "";
    mapping[header] = field;
  }
  return mapping;
}

export function applyClienteMapping(
  rows: Record<string, unknown>[],
  mapping: ClienteColumnMapping
) {
  return rows.map((row, index) => {
    const out: Record<string, unknown> = { _row: index + 2 };
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = row[header];
      if (value == null || String(value).trim() === "") continue;
      out[field] = value;
    }
    return out;
  });
}

export function useAgilizeClientesImport() {
  const [progress, setProgress] = useState<ClienteImportProgress>(EMPTY);

  const validateEmpresa = useCallback(async (empresaId: string, empresaNome: string) => {
    return invoke<ValidateClienteEmpresaResult>({
      action: "validate_empresa",
      empresaId,
      empresaNome,
    });
  }, []);

  const dryRun = useCallback(
    async (
      empresaId: string,
      tipo: ClienteImportTipo,
      rows: Record<string, unknown>[],
      duplicateMode: "skip" | "overwrite"
    ) => {
      return invoke<ClienteDryRunResult>({
        action: "dry_run",
        empresaId,
        tipo,
        rows,
        duplicateMode,
      });
    },
    []
  );

  const runImport = useCallback(
    async (
      empresaId: string,
      tipo: ClienteImportTipo,
      rows: Record<string, unknown>[],
      sessionToken: string,
      duplicateMode: "skip" | "overwrite"
    ) => {
      setProgress({
        ...EMPTY,
        status: "running",
        total: rows.length,
      });
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      const logs: string[] = [];
      for (let i = 0; i < rows.length; i += CLIENTE_BATCH_SIZE) {
        const batch = rows.slice(i, i + CLIENTE_BATCH_SIZE);
        const result = await invoke<{
          inserted: number;
          updated: number;
          skipped: number;
          errors: number;
          details?: { errors?: Array<{ row: number; error: string }> };
        }>({
          action: "import_batch",
          empresaId,
          tipo,
          rows: batch,
          sessionToken,
          duplicateMode,
        });
        inserted += result.inserted;
        updated += result.updated;
        skipped += result.skipped;
        errors += result.errors;
        for (const err of result.details?.errors || []) {
          logs.push(`Linha ${err.row}: ${err.error}`);
        }
        logs.push(
          `Lote ${Math.floor(i / CLIENTE_BATCH_SIZE) + 1}: +${result.inserted} novos, ${result.updated} atualizados, ${result.skipped} ignorados`
        );
        setProgress({
          status: "running",
          processed: Math.min(i + batch.length, rows.length),
          total: rows.length,
          inserted,
          updated,
          skipped,
          errors,
          logs: [...logs],
        });
        if (i + CLIENTE_BATCH_SIZE < rows.length) {
          await new Promise((r) => setTimeout(r, CLIENTE_BATCH_DELAY_MS));
        }
      }
      setProgress((prev) => ({ ...prev, status: "done" }));
    },
    []
  );

  return { validateEmpresa, dryRun, runImport, progress };
}
