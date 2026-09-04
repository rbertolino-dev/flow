import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  applyMapping,
  autoMapColumns,
  useAgilizeProdutosImport,
  type ColumnMapping,
  type MappedProductRow,
} from "@/hooks/useAgilizeProdutosImport";
import {
  AGILIZE_EPRODUTOS_FIELDS,
  AGILIZE_FIELD_LABELS,
  type AgilizeEprodutosField,
} from "@/lib/agilizeProdutosFields";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Pause,
  Play,
  Upload,
  XCircle,
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Empresa" },
  { id: 2, title: "Upload" },
  { id: 3, title: "Mapear" },
  { id: 4, title: "Dry-run" },
  { id: 5, title: "Importar" },
] as const;

function downloadTemplate() {
  const row: Record<string, string | number> = {};
  for (const f of AGILIZE_EPRODUTOS_FIELDS) {
    row[f] = f === "nome" ? "Produto Exemplo" : f === "preço" ? 10 : f === "status" ? "Em falta" : "";
  }
  const ws = XLSX.utils.json_to_sheet([row]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "template-eprodutos-agilize-total.xlsx");
}

function downloadReportCsv(
  filename: string,
  rows: Array<Record<string, string | number>>
) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const lines = [
    cols.join(","),
    ...rows.map((r) =>
      cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AgilizeProdutosImportWizard() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useAgilizeProdutosImport();

  const [step, setStep] = useState(1);
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [empresaValidated, setEmpresaValidated] = useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRows, setExcelRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mappedRows, setMappedRows] = useState<MappedProductRow[]>([]);
  const [confirmId, setConfirmId] = useState(false);

  const maxUnlockedStep = useMemo(() => {
    if (!empresaValidated) return 1;
    if (!excelRows.length) return 2;
    const hasNome = Object.values(mapping).includes("nome");
    if (!hasNome) return 3;
    if (!dryRunResult?.sessionToken) return 4;
    return 5;
  }, [empresaValidated, excelRows.length, mapping, dryRunResult]);

  const handleValidateEmpresa = async () => {
    if (!empresaId.trim()) {
      toast({ title: "Informe o Unique ID", variant: "destructive" });
      return;
    }
    try {
      const result = await validateEmpresa(empresaId.trim(), empresaNome.trim());
      setEmpresaValidated(true);
      toast({
        title: "Empresa validada",
        description: `${result.visibleToUser ?? "?"} visíveis no Bubble · ${result.productCount} no banco`,
      });
      setStep(2);
    } catch (e) {
      setEmpresaValidated(false);
      toast({
        title: "Falha na validação",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });
      if (!json.length) {
        toast({ title: "Planilha vazia", variant: "destructive" });
        return;
      }
      const headers = Object.keys(json[0]);
      const auto = autoMapColumns(headers);
      setExcelHeaders(headers);
      setExcelRows(json);
      setMapping(auto);
      setFileName(file.name);
      setMappedRows([]);
      resetImport();
      toast({
        title: "Arquivo carregado",
        description: `${json.length} linhas · ${headers.length} colunas`,
      });
      setStep(3);
    } catch (e) {
      toast({
        title: "Erro ao ler arquivo",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  const handleApplyMapping = () => {
    if (!Object.values(mapping).includes("nome")) {
      toast({
        title: "Mapeie a coluna 'nome'",
        description: "O campo nome é obrigatório",
        variant: "destructive",
      });
      return;
    }
    const rows = applyMapping(excelRows, mapping);
    setMappedRows(rows);
    resetImport();
    setStep(4);
  };

  const handleDryRun = async () => {
    try {
      const result = await runDryRun(empresaId.trim(), mappedRows);
      toast({
        title: "Dry-run concluído",
        description: `${result.totals.valid} válidos · ${result.totals.visibleToUser ?? "?"} visíveis no Bubble · ${result.totals.duplicates} duplicados · ${result.totals.invalid} inválidos`,
      });
    } catch (e) {
      toast({
        title: "Dry-run falhou",
        description: e instanceof Error ? e.message : "Erro",
        variant: "destructive",
      });
    }
  };

  const handleStartImport = async () => {
    if (!dryRunResult?.sessionToken) {
      toast({ title: "Execute o dry-run antes", variant: "destructive" });
      return;
    }
    if (!confirmId) {
      toast({
        title: "Confirme o Unique ID",
        description: "Marque o checkbox de confirmação",
        variant: "destructive",
      });
      return;
    }
    setStep(5);
    await runImportQueue(empresaId.trim(), mappedRows, dryRunResult.sessionToken);
  };

  const progressPct =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Importar produtos — Agilize Total</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Wizard seguro: valida empresa, mapeia colunas, dry-run e fila em lotes (sem sobrescrever).
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => {
          const unlocked = s.id <= Math.max(step, maxUnlockedStep);
          const active = step === s.id;
          return (
            <Button
              key={s.id}
              size="sm"
              variant={active ? "default" : unlocked ? "secondary" : "outline"}
              disabled={!unlocked}
              onClick={() => unlocked && setStep(s.id)}
            >
              {s.id}. {s.title}
            </Button>
          );
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Empresa destino</CardTitle>
            <CardDescription>
              Informe o nome e o Unique ID da organização no Agilize Total.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="empresaNome">Nome da empresa</Label>
                <Input
                  id="empresaNome"
                  value={empresaNome}
                  onChange={(e) => {
                    setEmpresaNome(e.target.value);
                    setEmpresaValidated(false);
                  }}
                  placeholder="Ex: Pet Stop"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="empresaId">Unique ID da empresa</Label>
                <Input
                  id="empresaId"
                  value={empresaId}
                  onChange={(e) => {
                    setEmpresaId(e.target.value);
                    setEmpresaValidated(false);
                  }}
                  placeholder="Ex: 1727471765881x564387302584877060"
                />
              </div>
            </div>
            <Button onClick={handleValidateEmpresa} disabled={isValidating}>
              {isValidating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Validar empresa
            </Button>
            {validateResult && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <div>
                    ID <code className="text-xs">{validateResult.empresaId}</code>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-green-600 hover:bg-green-600">
                      Usuário vê no Bubble: {validateResult.visibleToUser ?? "—"}
                    </Badge>
                    <Badge variant="secondary">
                      Total no banco: {validateResult.productCount}
                    </Badge>
                    <Badge variant="outline">
                      Desativados: {validateResult.hiddenDesativado ?? 0}
                    </Badge>
                    <Badge variant="outline">
                      Produto filho: {validateResult.hiddenProdutoFilho ?? 0}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {validateResult.bubbleRule ||
                      "Visível no Bubble = desativado ≠ true E produto_filho ≠ true"}
                  </p>
                  {validateResult.empresaCadastro.found && (
                    <div>Cadastro: {validateResult.empresaCadastro.nome}</div>
                  )}
                  {!validateResult.empresaCadastro.found && (
                    <div className="text-amber-600">
                      Unique ID não encontrado na tabela empresas (pode existir só em eprodutos).
                    </div>
                  )}
                  {validateResult.nameWarning && (
                    <div className="text-amber-600">{validateResult.nameWarning}</div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Upload Excel / CSV</CardTitle>
            <CardDescription>
              Use o template com as 21 colunas padrão ou qualquer planilha (mapeamento no próximo passo).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar template
              </Button>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4" />
                <span>
                  {fileName} — {excelRows.length} linhas
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Mapear colunas</CardTitle>
            <CardDescription>
              Associe cada coluna do Excel a um campo do Supabase (`eprodutos`). Nome é obrigatório.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coluna Excel</TableHead>
                    <TableHead>Campo Agilize Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excelHeaders.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-mono text-xs">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping[header] || "__none__"}
                          onValueChange={(v) =>
                            setMapping((m) => ({
                              ...m,
                              [header]: v === "__none__" ? "" : (v as AgilizeEprodutosField),
                            }))
                          }
                        >
                          <SelectTrigger className="w-[240px]">
                            <SelectValue placeholder="Ignorar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Ignorar —</SelectItem>
                            {AGILIZE_EPRODUTOS_FIELDS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {AGILIZE_FIELD_LABELS[f]} ({f})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleApplyMapping}>Continuar para dry-run</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>4. Dry-run (sem gravar)</CardTitle>
            <CardDescription>
              Valida linhas e detecta duplicatas por codigo_produto + empresa. Nada é inserido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {mappedRows.length} linhas mapeadas · empresa{" "}
              <code className="text-xs">{empresaId}</code>
            </div>
            <Button onClick={handleDryRun} disabled={isDryRunning || !mappedRows.length}>
              {isDryRunning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Executar dry-run
            </Button>

            {dryRunResult && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Válidos: {dryRunResult.totals.valid}</Badge>
                  <Badge className="bg-green-600 hover:bg-green-600">
                    Visíveis no Bubble (deste lote): {dryRunResult.totals.visibleToUser ?? "—"}
                  </Badge>
                  <Badge variant="secondary">Duplicados: {dryRunResult.totals.duplicates}</Badge>
                  <Badge variant="destructive">Inválidos: {dryRunResult.totals.invalid}</Badge>
                  <Badge variant="outline">Avisos: {dryRunResult.totals.warnings}</Badge>
                </div>
                {(dryRunResult.totals.hiddenDesativado || dryRunResult.totals.hiddenProdutoFilho) ? (
                  <p className="text-xs text-amber-700">
                    Neste lote: {dryRunResult.totals.hiddenDesativado ?? 0} com desativado=true ·{" "}
                    {dryRunResult.totals.hiddenProdutoFilho ?? 0} com produto_filho=true (não
                    aparecem na lista do usuário).
                  </p>
                ) : null}
                {dryRunResult.afterImportEstimate && (
                  <Alert>
                    <AlertDescription className="text-sm space-y-1">
                      <div>
                        <strong>Estimativa após importar:</strong> usuário verá{" "}
                        <strong>{dryRunResult.afterImportEstimate.visibleToUser}</strong> no
                        Bubble (hoje: {dryRunResult.empresaAtual?.visibleToUser ?? "—"}).
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Total no banco estimado: {dryRunResult.afterImportEstimate.total}. Regra:{" "}
                        {dryRunResult.bubbleRule}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Novos produtos sobem com desativado=false e produto_filho=false por
                        padrão (aparecem na lista).
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {dryRunResult.preview.length > 0 && (
                  <div className="rounded-md border overflow-auto max-h-[280px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Preço</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dryRunResult.preview.slice(0, 15).map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{String(p.nome ?? "")}</TableCell>
                            <TableCell>{String(p.codigo_produto ?? "")}</TableCell>
                            <TableCell>{String(p["preço"] ?? "")}</TableCell>
                            <TableCell>{String(p.status ?? "")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {(dryRunResult.invalid.length > 0 || dryRunResult.duplicates.length > 0) && (
                  <div className="space-y-2">
                    {dryRunResult.invalid.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="space-y-1">
                          <div className="font-medium">
                            Por que deu inválido? (dry-run NÃO grava essas linhas)
                          </div>
                          <ul className="list-disc pl-4 text-sm">
                            {dryRunResult.invalid.slice(0, 10).map((x, i) => (
                              <li key={i}>
                                Linha {x.row}: {x.error}
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs mt-1 opacity-90">
                            Causas mais comuns: coluna <code>nome</code> vazia ou não mapeada;
                            campo numérico (preço, qntd, origem_produto, etc.) com texto.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadReportCsv("dry-run-erros.csv", [
                          ...dryRunResult.invalid.map((x) => ({
                            tipo: "invalido",
                            linha: x.row,
                            detalhe: x.error,
                          })),
                          ...dryRunResult.duplicates.map((x) => ({
                            tipo: "duplicado",
                            linha: x.row,
                            detalhe: x.codigo_produto,
                          })),
                        ])
                      }
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar relatório erros/skips
                    </Button>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-md border p-3">
                  <Checkbox
                    id="confirmId"
                    checked={confirmId}
                    onCheckedChange={(v) => setConfirmId(v === true)}
                  />
                  <Label htmlFor="confirmId" className="text-sm leading-relaxed cursor-pointer">
                    Confirmo que o Unique ID{" "}
                    <code className="text-xs break-all">{empresaId}</code>
                    {empresaNome ? ` (${empresaNome})` : ""} está correto e desejo importar apenas
                    INSERT (duplicatas serão puladas).
                  </Label>
                </div>

                <Button
                  onClick={handleStartImport}
                  disabled={!confirmId || dryRunResult.totals.valid === 0}
                >
                  Ir para importação em fila
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>5. Fila de importação</CardTitle>
            <CardDescription>
              Lotes de 25 produtos com intervalo de 400ms. Pause/cancele se necessário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {progress.status === "running" && (
                <Button variant="secondary" onClick={pauseImport}>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
              )}
              {progress.status === "paused" && (
                <Button variant="secondary" onClick={resumeImport}>
                  <Play className="h-4 w-4 mr-2" />
                  Continuar
                </Button>
              )}
              {(progress.status === "running" || progress.status === "paused") && (
                <Button variant="destructive" onClick={cancelImport}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              {progress.status === "idle" && dryRunResult?.sessionToken && (
                <Button onClick={handleStartImport} disabled={!confirmId}>
                  Iniciar importação
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  Lote {progress.currentBatch}/{progress.totalBatches} · {progress.processed}/
                  {progress.total}
                </span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} />
              <div className="flex flex-wrap gap-2">
                <Badge>Inseridos: {progress.inserted}</Badge>
                <Badge variant="secondary">Pulados: {progress.skipped}</Badge>
                <Badge variant="destructive">Erros: {progress.errors}</Badge>
                <Badge variant="outline">Status: {progress.status}</Badge>
              </div>
            </div>

            <div className="rounded-md border max-h-[280px] overflow-auto p-3 space-y-1 text-xs font-mono">
              {progress.logs.length === 0 && (
                <div className="text-muted-foreground">Aguardando início…</div>
              )}
              {progress.logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.type === "error"
                      ? "text-destructive"
                      : log.type === "skip"
                      ? "text-amber-600"
                      : log.type === "ok"
                      ? "text-green-700"
                      : ""
                  }
                >
                  {log.message}
                </div>
              ))}
            </div>

            {progress.status === "done" && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Importação finalizada. {progress.inserted} inseridos, {progress.skipped} pulados,{" "}
                  {progress.errors} erros.
                </AlertDescription>
              </Alert>
            )}
            {progress.status === "cancelled" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Importação cancelada.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
