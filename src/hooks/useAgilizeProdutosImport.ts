import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AGILIZE_EPRODUTOS_FIELDS,
  BATCH_DELAY_MS,
  BATCH_RETRY_BASE_MS,
  BATCH_RETRY_MAX,
  BATCH_SIZE,
  type AgilizeEprodutosField,
} from "@/lib/agilizeProdutosFields";
import { normalizeColumnName } from "@/utils/normalizeExcelColumn";

export type ColumnMapping = Record<string, AgilizeEprodutosField | "">;

export interface MappedProductRow {
  _row: number;
  [key: string]: unknown;
}

export interface ValidateEmpresaResult {
  ok: boolean;
  empresaId: string;
  empresaNomeInformado: string | null;
  empresaCadastro: { found: boolean; nome?: string };
  productCount: number;
  /** Quantidade que o usuário vê no Bubble */
  visibleToUser: number;
  hiddenDesativado: number;
  hiddenProdutoFilho: number;
  bubbleRule?: string;
  visibility?: {
    total: number;
    visibleToUser: number;
    hiddenDesativado: number;
    hiddenProdutoFilho: number;
    hiddenBoth: number;
  };
  sample: Array<{ id: number; nome: string; codigo_produto?: string; status?: string }>;
  nameWarning: string | null;
  existsInProducts: boolean;
}

export type DuplicateMode = "skip" | "overwrite";

export interface FailedImportItem {
  row: number;
  nome: string;
  codigo_produto: string;
  reason: string;
  batch: number;
  /** Linha mapeada completa para reimportar */
  data: MappedProductRow;
}

export interface DryRunResult {
  ok: boolean;
  empresaId: string;
  totals: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    willUpdate?: number;
    warnings: number;
    visibleToUser?: number;
    hiddenDesativado?: number;
    hiddenProdutoFilho?: number;
  };
  bubbleRule?: string;
  empresaAtual?: {
    total: number;
    visibleToUser: number;
    hiddenDesativado: number;
    hiddenProdutoFilho: number;
  };
  afterImportEstimate?: {
    total: number;
    visibleToUser: number;
  };
  preview: Record<string, unknown>[];
  invalid: Array<{ row: number; error: string }>;
  duplicates: Array<{ row: number; codigo_produto: string }>;
  /** Quando duplicateMode=overwrite: linhas que serão atualizadas */
  willUpdate?: Array<{ row: number; codigo_produto: string }>;
  warnings: Array<{ row: number; warning: string }>;
  sessionToken: string;
  duplicateMode?: DuplicateMode;
}

export interface ImportProgress {
  status: "idle" | "running" | "paused" | "done" | "cancelled" | "error";
  currentBatch: number;
  totalBatches: number;
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  failedProducts: FailedImportItem[];
  logs: Array<{ batch: number; message: string; type: "ok" | "skip" | "error" | "info" }>;
}

const EMPTY_PROGRESS: ImportProgress = {
  status: "idle",
  currentBatch: 0,
  totalBatches: 0,
  processed: 0,
  total: 0,
  inserted: 0,
  updated: 0,
  skipped: 0,
  errors: 0,
  failedProducts: [],
  logs: [],
};

function toFailedItem(
  row: MappedProductRow,
  reason: string,
  batch: number
): FailedImportItem {
  return {
    row: Number(row._row) || 0,
    nome: String(row.nome ?? ""),
    codigo_produto: String(row.codigo_produto ?? ""),
    reason,
    batch,
    data: row,
  };
}

async function getAccessTokenWithRetry(attempts = 3): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 150 * (i + 1)));
    }
  }
  // Última tentativa: forçar refresh
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
}

async function invokeAction<T>(body: Record<string, unknown>): Promise<T> {
  const accessToken = await getAccessTokenWithRetry();
  if (!accessToken) {
    throw new Error("Sessão expirada. Faça login novamente e tente de novo.");
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  // Usar fetch explícito (mesmo padrão de useProducts) — functions.invoke
  // em domínio customizado às vezes envia só a anon key → 401 "Não autenticado".
  const response = await fetch(`${supabaseUrl}/functions/v1/agilize-eprodutos-import`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const msg =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `Erro ${response.status} na Edge Function`;
    throw new Error(msg);
  }
  if (typeof data.error === "string" && data.error) {
    throw new Error(data.error);
  }
  return data as T;
}

/**
 * Aliases extras (CSV Excel BR / cabeçalhos sem acento / mojibake residual).
 * Chaves já passam por normalizeColumnName (sem acento, sem símbolos).
 */
const FIELD_ALIASES: Record<string, AgilizeEprodutosField> = {
  // preço
  preco: "preço",
  preao: "preço",
  price: "preço",
  valor: "preço",
  valorunitario: "preço",
  precounitario: "preço",
  // preço_atacado
  precoatacado: "preço_atacado",
  preaoatacado: "preço_atacado",
  precoataca: "preço_atacado",
  valoratacado: "preço_atacado",
  // nome
  name: "nome",
  produto: "nome",
  nomedoproduto: "nome",
  // medida
  unidade: "medida",
  und: "medida",
  un: "medida",
  // origem / categoria
  origem: "origem_produto",
  categoria: "categoria_nome",
  // flags
  produtofilho: "produto_filho",
  filho: "produto_filho",
  inativo: "desativado",
  ativo: "desativado",
  // quantidades
  qtde: "qntd",
  qtd: "qntd",
  quantidade: "qntd",
  estoque: "qntd",
  qtdideal: "qnt_ideal",
  quantidadeideal: "qnt_ideal",
  qtdbaixa: "qntd_baixa",
  quantidadebaixa: "qntd_baixa",
  // códigos
  codigo: "codigo_produto",
  sku: "codigo_produto",
  codproduto: "codigo_produto",
  codigodoproduto: "codigo_produto",
  codigodeproduto: "codigo_produto",
  codigoprod: "codigo_produto",
  ncm: "codigo_ncm",
  ean: "codigo_barras",
  barcode: "codigo_barras",
  barras: "codigo_barras",
  codbarras: "codigo_barras",
  codigointerno: "cod_interno",
  codinterno: "cod_interno",
  // custos / totais
  custo: "custo_unit",
  custounitario: "custo_unit",
  totalcusto: "total_custo",
  totalvenda: "total_venda",
  // textos
  desc: "descricao",
  description: "descricao",
  descanp: "descricao_anp",
  brand: "marca",
};

export function autoMapColumns(excelHeaders: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<AgilizeEprodutosField>();
  for (const header of excelHeaders) {
    const norm = normalizeColumnName(header);
    const match =
      AGILIZE_EPRODUTOS_FIELDS.find((f) => normalizeColumnName(f) === norm) ||
      FIELD_ALIASES[norm] ||
      "";
    // Evita duas colunas Excel apontarem para o mesmo campo (primeira ganha)
    if (match && used.has(match)) {
      mapping[header] = "";
      continue;
    }
    if (match) used.add(match);
    mapping[header] = match;
  }
  return mapping;
}

export function applyMapping(
  excelRows: Record<string, unknown>[],
  mapping: ColumnMapping
): MappedProductRow[] {
  return excelRows.map((row, idx) => {
    const out: MappedProductRow = { _row: idx + 2 }; // +2: header + 1-based
    for (const [excelCol, field] of Object.entries(mapping)) {
      if (!field) continue;
      out[field] = row[excelCol];
    }
    return out;
  });
}

export function useAgilizeProdutosImport() {
  const [isValidating, setIsValidating] = useState(false);
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [validateResult, setValidateResult] = useState<ValidateEmpresaResult | null>(null);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(EMPTY_PROGRESS);

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const validateEmpresa = useCallback(async (empresaId: string, empresaNome: string) => {
    setIsValidating(true);
    try {
      const result = await invokeAction<ValidateEmpresaResult>({
        action: "validate_empresa",
        empresaId,
        empresaNome,
      });
      setValidateResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const runDryRun = useCallback(
    async (
      empresaId: string,
      rows: MappedProductRow[],
      duplicateMode: DuplicateMode = "skip"
    ) => {
      setIsDryRunning(true);
      try {
        const result = await invokeAction<DryRunResult>({
          action: "dry_run",
          empresaId,
          rows,
          duplicateMode,
        });
        setDryRunResult(result);
        return result;
      } finally {
        setIsDryRunning(false);
      }
    },
    []
  );

  const pauseImport = useCallback(() => {
    pauseRef.current = true;
    setProgress((p) => ({ ...p, status: "paused" }));
  }, []);

  const resumeImport = useCallback(() => {
    pauseRef.current = false;
    setProgress((p) => ({ ...p, status: "running" }));
  }, []);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
    pauseRef.current = false;
  }, []);

  const runImportQueue = useCallback(
    async (
      empresaId: string,
      rows: MappedProductRow[],
      sessionToken: string,
      options?: { duplicateMode?: DuplicateMode }
    ) => {
      const duplicateMode = options?.duplicateMode ?? "skip";
      pauseRef.current = false;
      cancelRef.current = false;

      const totalBatches = Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
      setProgress({
        ...EMPTY_PROGRESS,
        status: "running",
        totalBatches,
        total: rows.length,
        logs: [
          {
            batch: 0,
            message: `Iniciando importação de ${rows.length} linhas (modo: ${
              duplicateMode === "overwrite" ? "sobrescrever" : "ignorar duplicatas"
            })`,
            type: "info",
          },
        ],
      });

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      let processed = 0;
      const failedProducts: FailedImportItem[] = [];

      for (let b = 0; b < totalBatches; b++) {
        while (pauseRef.current && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (cancelRef.current) {
          const remaining = rows.slice(b * BATCH_SIZE);
          for (const row of remaining) {
            failedProducts.push(
              toFailedItem(row, "Importação cancelada — não processado", b + 1)
            );
          }
          errors += remaining.length;
          setProgress((p) => ({
            ...p,
            status: "cancelled",
            errors,
            failedProducts: [...failedProducts],
            logs: [
              ...p.logs,
              {
                batch: b + 1,
                message: `Importação cancelada. ${remaining.length} produtos restantes listados em falhas.`,
                type: "error",
              },
            ],
          }));
          return;
        }

        const batch = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setProgress((p) => ({
          ...p,
          status: "running",
          currentBatch: b + 1,
        }));

        const isTransientGatewayError = (msg: string) =>
          /504|502|503|Gateway Time-?out|timed?\s*out|network|Failed to fetch/i.test(
            msg
          );

        let batchOk = false;
        let lastErr = "";
        for (let attempt = 1; attempt <= BATCH_RETRY_MAX; attempt++) {
          try {
            const result = await invokeAction<{
              inserted: number;
              updated?: number;
              skipped: number;
              errors: number;
              details: {
                errors: Array<{ row: number; error: string }>;
                skipped: Array<{ row: number; reason: string }>;
              };
            }>({
              action: "import_batch",
              empresaId,
              rows: batch,
              sessionToken,
              duplicateMode,
            });

            inserted += result.inserted || 0;
            updated += result.updated || 0;
            skipped += result.skipped || 0;
            errors += result.errors || 0;
            processed += batch.length;

            const rowErrors = result.details?.errors || [];
            for (const err of rowErrors) {
              const match = batch.find((r) => Number(r._row) === err.row);
              if (match) {
                failedProducts.push(toFailedItem(match, err.error, b + 1));
              } else {
                failedProducts.push({
                  row: err.row,
                  nome: "",
                  codigo_produto: "",
                  reason: err.error,
                  batch: b + 1,
                  data: { _row: err.row },
                });
              }
            }

            const errSample = rowErrors
              .slice(0, 3)
              .map((e) => `L${e.row}: ${e.error}`)
              .join("; ");
            const retryNote =
              attempt > 1 ? ` (ok após retry ${attempt}/${BATCH_RETRY_MAX})` : "";
            const updPart =
              (result.updated || 0) > 0 ? `, +${result.updated} update` : "";

            setProgress((p) => ({
              ...p,
              currentBatch: b + 1,
              processed,
              inserted,
              updated,
              skipped,
              errors,
              failedProducts: [...failedProducts],
              logs: [
                ...p.logs,
                {
                  batch: b + 1,
                  message: `Lote ${b + 1}/${totalBatches}: +${result.inserted} ok${updPart}, ${result.skipped} skip, ${result.errors} erro${errSample ? ` (${errSample})` : ""}${retryNote}`,
                  type:
                    result.errors > 0
                      ? "error"
                      : result.skipped > 0
                        ? "skip"
                        : "ok",
                },
              ],
            }));
            batchOk = true;
            break;
          } catch (e) {
            lastErr = e instanceof Error ? e.message : "Erro no lote";
            if (
              attempt < BATCH_RETRY_MAX &&
              isTransientGatewayError(lastErr)
            ) {
              const wait = BATCH_RETRY_BASE_MS * attempt;
              setProgress((p) => ({
                ...p,
                logs: [
                  ...p.logs,
                  {
                    batch: b + 1,
                    message: `Lote ${b + 1}: timeout/gateway — retry ${attempt}/${BATCH_RETRY_MAX} em ${wait}ms…`,
                    type: "info",
                  },
                ],
              }));
              await new Promise((r) => setTimeout(r, wait));
              continue;
            }
          }
        }

        if (!batchOk) {
          const reason = `Lote falhou: ${lastErr}`.slice(0, 500);
          for (const row of batch) {
            failedProducts.push(toFailedItem(row, reason, b + 1));
          }
          errors += batch.length;
          processed += batch.length;
          setProgress((p) => ({
            ...p,
            processed,
            errors,
            failedProducts: [...failedProducts],
            logs: [
              ...p.logs,
              {
                batch: b + 1,
                message: `Lote ${b + 1} falhou após ${BATCH_RETRY_MAX} tentativas (${batch.length} produtos na lista de falhas): ${lastErr.slice(0, 200)}`,
                type: "error",
              },
            ],
          }));
        }

        if (b < totalBatches - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      setProgress((p) => ({
        ...p,
        status: "done",
        failedProducts: [...failedProducts],
        logs: [
          ...p.logs,
          {
            batch: totalBatches,
            message: `Concluído: ${inserted} inseridos, ${updated} sobrescritos, ${skipped} pulados, ${errors} erros (${failedProducts.length} na lista de falhas)`,
            type: "info",
          },
        ],
      }));
    },
    []
  );

  const resetImport = useCallback(() => {
    setDryRunResult(null);
    setProgress(EMPTY_PROGRESS);
  }, []);

  return {
    isValidating,
    isDryRunning,
    validateResult,
    dryRunResult,
    progress,
    validateEmpresa,
    runDryRun,
    runImportQueue,
    pauseImport,
    resumeImport,
    cancelImport,
    resetImport,
    setValidateResult,
    setDryRunResult,
  };
}
