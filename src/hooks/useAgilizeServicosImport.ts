import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AGILIZE_SERVICOS_FIELDS,
  SERVICO_BATCH_DELAY_MS,
  SERVICO_BATCH_SIZE,
} from "@/lib/agilizeServicosFields";
import { normalizeColumnName } from "@/utils/normalizeExcelColumn";

export type ServicoColumnMapping = Record<string, string>;

export interface ValidateServicoEmpresaResult {
  ok: boolean;
  empresaId: string;
  empresaCadastro: { found: boolean; nome?: string };
  serviceCount: number;
  sample: Array<{ id: number; nome: string; codigo?: string; preço?: number }>;
  nameWarning: string | null;
}

export interface ServicoDryRunResult {
  ok: boolean;
  totals: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    willUpdate: number;
    warnings: number;
  };
  preview: Record<string, unknown>[];
  invalid: Array<{ row: number; error: string }>;
  duplicates: Array<{ row: number; nome: string; matchBy: string; existingId: number; reason?: string }>;
  willUpdate: Array<{ row: number; nome: string; matchBy: string; existingId: number; reason?: string }>;
  warnings: Array<{ row: number; warning: string }>;
  sessionToken: string;
}

export interface ServicoImportProgress {
  status: "idle" | "running" | "done" | "error";
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  logs: string[];
  skippedItems: Array<{ row: number; nome: string; reason: string }>;
  insertedItems: Array<{ row: number; nome: string; id: number }>;
}

const EMPTY: ServicoImportProgress = {
  status: "idle",
  processed: 0,
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  logs: [],
  skippedItems: [],
  insertedItems: [],
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
  const response = await fetch(`${supabaseUrl}/functions/v1/agilize-eservicos-import`, {
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
  name: "nome",
  servico: "nome",
  descricao: "descricao",
  description: "descricao",
  preco: "preço",
  valor: "preço",
  custounit: "custo unit",
  custo: "custo unit",
  custounitario: "custo unit",
  codigo: "codigo",
  sku: "codigo",
  categoria: "categoria",
};

export function autoMapServicoColumns(headers: string[]): ServicoColumnMapping {
  const allowed = new Set<string>(AGILIZE_SERVICOS_FIELDS);
  const mapping: ServicoColumnMapping = {};
  for (const header of headers) {
    const key = normalizeColumnName(header);
    const field = ALIASES[key] || "";
    mapping[header] = field && allowed.has(field) ? field : "";
  }
  return mapping;
}

export function applyServicoMapping(
  rows: Record<string, unknown>[],
  mapping: ServicoColumnMapping
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

export function useAgilizeServicosImport() {
  const [progress, setProgress] = useState<ServicoImportProgress>(EMPTY);

  const validateEmpresa = useCallback(async (empresaId: string, empresaNome: string) => {
    return invoke<ValidateServicoEmpresaResult>({
      action: "validate_empresa",
      empresaId,
      empresaNome,
    });
  }, []);

  const dryRun = useCallback(
    async (
      empresaId: string,
      rows: Record<string, unknown>[],
      duplicateMode: "skip" | "overwrite"
    ) => {
      return invoke<ServicoDryRunResult>({
        action: "dry_run",
        empresaId,
        rows,
        duplicateMode,
      });
    },
    []
  );

  const runImport = useCallback(
    async (
      empresaId: string,
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
      const skippedItems: Array<{ row: number; nome: string; reason: string }> = [];
      const insertedItems: Array<{ row: number; nome: string; id: number }> = [];
      try {
        for (let i = 0; i < rows.length; i += SERVICO_BATCH_SIZE) {
          const batch = rows.slice(i, i + SERVICO_BATCH_SIZE);
          const result = await invoke<{
            inserted: number;
            updated: number;
            skipped: number;
            errors: number;
            details?: {
              errors?: Array<{ row: number; error: string }>;
              skipped?: Array<{ row: number; nome: string; reason: string }>;
              inserted?: Array<{ row: number; nome: string; id: number }>;
              warnings?: Array<{ row: number; warning: string }>;
            };
          }>({
            action: "import_batch",
            empresaId,
            rows: batch,
            sessionToken,
            duplicateMode,
          });
          inserted += result.inserted;
          updated += result.updated;
          skipped += result.skipped;
          errors += result.errors;
          for (const item of result.details?.skipped || []) {
            skippedItems.push(item);
            logs.push(`Já existe, não subiu — linha ${item.row}, ${item.nome}: ${item.reason}`);
          }
          for (const item of result.details?.inserted || []) insertedItems.push(item);
          for (const err of result.details?.errors || []) {
            logs.push(`Linha ${err.row}: ${err.error}`);
          }
          for (const warn of result.details?.warnings || []) {
            logs.push(`Linha ${warn.row}: ${warn.warning}`);
          }
          logs.push(
            `Lote ${Math.floor(i / SERVICO_BATCH_SIZE) + 1}: ${result.inserted} novos, ${result.updated} atualizados, ${result.skipped} já existiam`
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
            skippedItems: [...skippedItems],
            insertedItems: [...insertedItems],
          });
          if (i + SERVICO_BATCH_SIZE < rows.length) {
            await new Promise((r) => setTimeout(r, SERVICO_BATCH_DELAY_MS));
          }
        }
        setProgress((prev) => ({ ...prev, status: "done" }));
      } catch (error) {
        setProgress((prev) => ({
          ...prev,
          status: "error",
          logs: [...prev.logs, error instanceof Error ? error.message : "Erro"],
        }));
        throw error;
      }
    },
    []
  );

  return { validateEmpresa, dryRun, runImport, progress };
}
