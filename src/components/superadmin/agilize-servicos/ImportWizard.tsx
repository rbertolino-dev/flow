import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  applyServicoMapping,
  autoMapServicoColumns,
  useAgilizeServicosImport,
  type ServicoColumnMapping,
  type ServicoDryRunResult,
  type ValidateServicoEmpresaResult,
} from "@/hooks/useAgilizeServicosImport";
import {
  AGILIZE_SERVICOS_FIELDS,
  SERVICO_BATCH_DELAY_MS,
  SERVICO_BATCH_SIZE,
  SERVICO_FIELD_LABELS,
} from "@/lib/agilizeServicosFields";

export function AgilizeServicosImportWizard() {
  const { toast } = useToast();
  const { validateEmpresa, dryRun, runImport, progress } = useAgilizeServicosImport();
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [validated, setValidated] = useState<ValidateServicoEmpresaResult | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ServicoColumnMapping>({});
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "overwrite">("skip");
  const [dry, setDry] = useState<ServicoDryRunResult | null>(null);
  const [busy, setBusy] = useState(false);

  const mappedRows = useMemo(
    () => applyServicoMapping(sheetRows, mapping),
    [sheetRows, mapping]
  );
  const nomeMapeado = Object.values(mapping).includes("nome");

  const onValidate = async () => {
    setBusy(true);
    setValidated(null);
    try {
      const result = await validateEmpresa(empresaId.trim(), empresaNome.trim());
      setValidated(result);
      toast({
        title: "Empresa validada",
        description: result.empresaCadastro.nome || empresaId,
      });
    } catch (error) {
      toast({
        title: "Empresa inválida",
        description: error instanceof Error ? error.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    setSheetRows(rows);
    setHeaders(cols);
    setMapping(autoMapServicoColumns(cols));
    setDry(null);
  };

  const downloadTemplate = () => {
    const example: Record<string, string> = {
      nome: "Instalação",
      descricao: "Instalação no local",
      preço: "150",
      "custo unit": "40",
      codigo: "SRV-001",
      categoria: "",
    };
    const ws = XLSX.utils.json_to_sheet([example], { header: [...AGILIZE_SERVICOS_FIELDS] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Servicos");
    XLSX.writeFile(wb, "template-servicos-agilize-total.xlsx");
  };

  const onDryRun = async () => {
    if (!validated) return;
    setBusy(true);
    try {
      const result = await dryRun(validated.empresaId, mappedRows, duplicateMode);
      setDry(result);
    } catch (error) {
      toast({
        title: "Validação falhou",
        description: error instanceof Error ? error.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const onImport = async () => {
    if (!validated || !dry) return;
    setBusy(true);
    try {
      await runImport(
        validated.empresaId,
        mappedRows,
        dry.sessionToken,
        duplicateMode,
        empresaNome.trim() || validated.empresaCadastro.nome
      );
      toast({ title: "Importação concluída" });
    } catch (error) {
      toast({
        title: "Importação falhou",
        description: error instanceof Error ? error.message : "Erro",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const novosNaPlanilha = dry ? dry.totals.valid - dry.totals.willUpdate : 0;
  const empresaLabel = validated?.empresaCadastro.nome || "esta empresa";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Confira a empresa</CardTitle>
          <CardDescription>
            Os serviços entram só nesta organização do Agilize Total. O catálogo fica na tabela de serviços do espelho.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="empresaNome">Nome que você espera ver</Label>
              <Input
                id="empresaNome"
                placeholder="Ex.: SHAMAR CONSULTORIA"
                value={empresaNome}
                onChange={(e) => setEmpresaNome(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="empresaId">ID da empresa no Agilize Total</Label>
              <Input
                id="empresaId"
                placeholder="Cole o unique ID"
                value={empresaId}
                onChange={(e) => {
                  setEmpresaId(e.target.value);
                  setValidated(null);
                  setDry(null);
                }}
              />
            </div>
          </div>
          <Button onClick={onValidate} disabled={busy || !empresaId.trim()}>
            Conferir empresa
          </Button>
          {validated && (
            <Alert>
              <AlertDescription>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Empresa que vai receber a lista</div>
                <div className="text-lg font-semibold">
                  {validated.empresaCadastro.found
                    ? validated.empresaCadastro.nome
                    : "ID aceito. O nome ainda não está na lista espelhada de empresas."}
                </div>
                <div className="mt-1 text-xs break-all text-muted-foreground">{validated.empresaId}</div>
                <div className="mt-1 text-sm">
                  {validated.serviceCount} serviço(s) e {validated.productCount} produto(s) desta empresa.
                </div>
                {validated.nameWarning ? <div className="mt-1">{validated.nameWarning}</div> : null}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Envie a lista</CardTitle>
          <CardDescription>
            Nome é obrigatório. Com código, a duplicata é nome e código. Sem código, basta o nome igual nesta empresa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate}>Baixar modelo da planilha</Button>
            <span className="text-xs text-muted-foreground">
              Envio em lotes de {SERVICO_BATCH_SIZE}, com {SERVICO_BATCH_DELAY_MS / 1000}s entre eles.
            </span>
          </div>

          <div>
            <Label htmlFor="planilha">Planilha (.xlsx, .xls ou .csv)</Label>
            <Input
              id="planilha"
              className="mt-1"
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={!validated}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
            {!validated && (
              <p className="mt-1 text-xs text-muted-foreground">Confira a empresa no passo 1 para liberar o arquivo.</p>
            )}
          </div>

          {headers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Confira se as colunas bateram</p>
              {headers.map((header) => (
                <div key={header} className="grid grid-cols-2 gap-2 items-center">
                  <span className="truncate text-sm">{header}</span>
                  <Select
                    value={mapping[header] || "__ignore"}
                    onValueChange={(value) => {
                      setMapping((prev) => ({
                        ...prev,
                        [header]: value === "__ignore" ? "" : value,
                      }));
                      setDry(null);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore">Não usar esta coluna</SelectItem>
                      {AGILIZE_SERVICOS_FIELDS.map((field) => (
                        <SelectItem key={field} value={field}>
                          {SERVICO_FIELD_LABELS[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {!nomeMapeado && (
                <p className="text-sm text-destructive">Mapeie a coluna Nome para continuar.</p>
              )}

              <div className="overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Linha</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Código</th>
                      <th className="p-2">Preço</th>
                      <th className="p-2">Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 12).map((row) => (
                      <tr key={String(row._row)} className="border-b">
                        <td className="p-2">{String(row._row ?? "")}</td>
                        <td className="p-2">{String(row.nome ?? "")}</td>
                        <td className="p-2">{String(row.codigo ?? "")}</td>
                        <td className="p-2">{String(row["preço"] ?? "")}</td>
                        <td className="p-2">{String(row.categoria ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="p-2 text-xs text-muted-foreground">
                  Prévia de {Math.min(12, mappedRows.length)} de {mappedRows.length} linhas.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className={`rounded-lg border p-3 text-left ${
                    duplicateMode === "skip" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => {
                    setDuplicateMode("skip");
                    setDry(null);
                  }}
                >
                  <div className="font-medium">Subir só o que ainda não está nesta empresa</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Mesmo nome e código ficam de fora. Sem código, o nome igual já impede a entrada.
                  </div>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border p-3 text-left ${
                    duplicateMode === "overwrite" ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  onClick={() => {
                    setDuplicateMode("overwrite");
                    setDry(null);
                  }}
                >
                  <div className="font-medium">Atualizar o que já está nesta empresa</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    O cadastro existente recebe preço, custo, descrição e categoria da planilha.
                  </div>
                </button>
              </div>

              <Button onClick={onDryRun} disabled={busy || mappedRows.length === 0 || !nomeMapeado}>
                Conferir quem sobe em {empresaLabel}
              </Button>
            </div>
          )}

          {dry && (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{novosNaPlanilha}</div>
                <div className="text-sm">Vão subir agora</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{dry.totals.duplicates}</div>
                <div className="text-sm">Já estão nesta empresa</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">
                  {duplicateMode === "overwrite" ? dry.totals.willUpdate : dry.totals.invalid}
                </div>
                <div className="text-sm">
                  {duplicateMode === "overwrite" ? "Serão atualizados" : "Não sobem por falta de dado"}
                </div>
              </div>
            </div>
          )}

          {dry && dry.warnings.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Avisos de categoria</p>
              <ul className="max-h-48 overflow-auto text-sm text-muted-foreground">
                {dry.warnings.map((item) => (
                  <li key={`${item.row}-${item.warning}`}>Linha {item.row}: {item.warning}</li>
                ))}
              </ul>
            </div>
          )}
          {dry && dry.invalid.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Linhas que não sobem por falta de dado</p>
              <ul className="text-sm text-destructive">
                {dry.invalid.map((item) => (
                  <li key={`${item.row}-${item.error}`}>Linha {item.row}: {item.error}</li>
                ))}
              </ul>
            </div>
          )}
          {dry && dry.duplicates.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Já estão em {empresaLabel} e não vão subir de novo</p>
              <ul className="max-h-48 overflow-auto text-sm">
                {dry.duplicates.map((item) => (
                  <li key={`${item.row}-${item.nome}`}>
                    Linha {item.row} — {item.nome}: {item.reason || item.matchBy}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dry && dry.willUpdate.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Já estão nesta empresa e serão atualizados</p>
              <ul className="max-h-48 overflow-auto text-sm">
                {dry.willUpdate.map((item) => (
                  <li key={`${item.row}-${item.nome}`}>
                    Linha {item.row} — {item.nome}: {item.reason || item.matchBy}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dry && (
            <Button onClick={onImport} disabled={busy || progress.status === "running" || novosNaPlanilha + dry.totals.willUpdate === 0}>
              {duplicateMode === "skip"
                ? `Subir ${novosNaPlanilha} novo(s) em ${empresaLabel}`
                : `Subir ${novosNaPlanilha} novo(s) e atualizar ${dry.totals.willUpdate} em ${empresaLabel}`}
            </Button>
          )}
          {progress.status !== "idle" && (
            <p className="text-sm">
              {progress.processed} de {progress.total} conferidas · {progress.inserted} subiram agora ·{" "}
              {progress.updated} atualizados · {progress.skipped} já existiam nesta empresa · {progress.errors} erros
            </p>
          )}
          {progress.status === "done" && (
            <Alert>
              <AlertDescription>
                Pronto. {progress.inserted} serviço(s) novos entraram em {empresaLabel}.{" "}
                {progress.skipped} já estavam lá e ficaram como estavam.
              </AlertDescription>
            </Alert>
          )}
          {progress.skippedItems.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Não subiram porque já estavam nesta empresa</p>
              <ul className="max-h-48 overflow-auto text-sm">
                {progress.skippedItems.map((item) => (
                  <li key={`${item.row}-${item.nome}`}>
                    Linha {item.row} — {item.nome}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {progress.logs.slice(-8).map((log) => (
            <p key={log} className="text-xs text-muted-foreground">{log}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
