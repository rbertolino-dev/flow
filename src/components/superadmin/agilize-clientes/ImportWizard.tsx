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
  applyClienteMapping,
  autoMapClienteColumns,
  useAgilizeClientesImport,
  type ClienteColumnMapping,
  type ClienteDryRunResult,
  type ValidateClienteEmpresaResult,
} from "@/hooks/useAgilizeClientesImport";
import {
  CLIENTE_BATCH_DELAY_MS,
  CLIENTE_BATCH_SIZE,
  CLIENTE_DESTINO_HELP,
  CLIENTE_DESTINO_LABEL,
  CLIENTE_FIELD_LABELS,
  fieldsForTipo,
  type ClienteDestino,
  type ClienteImportTipo,
} from "@/lib/agilizeClientesFields";

export function AgilizeClientesImportWizard() {
  const { toast } = useToast();
  const { validateEmpresa, dryRun, runImport, progress } = useAgilizeClientesImport();
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [validated, setValidated] = useState<ValidateClienteEmpresaResult | null>(null);
  const [tipo, setTipo] = useState<ClienteImportTipo>("contato");
  const [destino, setDestino] = useState<ClienteDestino>("cliente_contato");
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ClienteColumnMapping>({});
  const [duplicateMode, setDuplicateMode] = useState<"skip" | "overwrite">("skip");
  const [dry, setDry] = useState<ClienteDryRunResult | null>(null);
  const [busy, setBusy] = useState(false);

  const mappedRows = useMemo(
    () => applyClienteMapping(sheetRows, mapping),
    [sheetRows, mapping]
  );

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
    setMapping(autoMapClienteColumns(cols, tipo));
    setDry(null);
  };

  const downloadTemplate = () => {
    const fields = fieldsForTipo(tipo);
    const example: Record<string, string> =
      tipo === "contato"
        ? {
            nome: "item 1",
            telefone: "11999990001",
            Email: "item1@exemplo.com",
            "cnpj ou cpf": "12345678901",
            categoria: "Cliente",
            cidade: "São Paulo",
            "empresa do contato": "Empresa Exemplo",
          }
        : {
            nome: "Empresa Exemplo",
            cnpj: "12345678000199",
            telefone: "1133330000",
            email: "contato@exemplo.com",
            categoria: "Cliente",
            cidade: "São Paulo",
          };
    const ws = XLSX.utils.json_to_sheet([example], { header: [...fields] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes");
    XLSX.writeFile(
      wb,
      tipo === "contato"
        ? "template-contatos-agilize-total.xlsx"
        : "template-empresas-contato-agilize-total.xlsx"
    );
  };

  const onDryRun = async () => {
    if (!validated) return;
    setBusy(true);
    try {
      const result = await dryRun(validated.empresaId, tipo, mappedRows, duplicateMode, destino);
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
      await runImport(validated.empresaId, tipo, mappedRows, dry.sessionToken, duplicateMode, destino);
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
            Os contatos entram só nesta organização. Depois de validar o ID, o nome da empresa aparece para você conferir.
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
                    : "Nome não encontrado para este ID"}
                </div>
                <div className="mt-1 text-xs break-all text-muted-foreground">{validated.empresaId}</div>
                {validated.nameWarning ? <div className="mt-1">{validated.nameWarning}</div> : null}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Escolha o que cada linha vira</CardTitle>
          <CardDescription>
            Uma escolha vale para a planilha inteira.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["lead", "contato"],
              ["cliente_contato", "contato"],
              ["cliente_empresa", "empresa"],
            ] as const
          ).map(([value, nextTipo]) => (
            <button
              key={value}
              type="button"
              className={`rounded-lg border p-3 text-left ${
                destino === value ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => {
                setDestino(value);
                setTipo(nextTipo);
                setDry(null);
                if (headers.length) setMapping(autoMapClienteColumns(headers, nextTipo));
              }}
            >
              <div className="font-medium">{CLIENTE_DESTINO_LABEL[value]}</div>
              <div className="mt-1 text-sm text-muted-foreground">{CLIENTE_DESTINO_HELP[value]}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Envie a lista</CardTitle>
          <CardDescription>
            Pode ser a mesma planilha de antes. O sistema compara com o que já está em {empresaLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
            <p className="font-medium">O que sobe e o que fica de fora</p>
            <p>A comparação usa as duas colunas juntas: nome e CPF/CNPJ. O telefone sozinho não impede a entrada.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nome e CPF/CNPJ iguais aos de alguém que já está nesta empresa: não sobe de novo.</li>
              <li>Nome diferente, mesmo com o mesmo telefone: sobe.</li>
              <li>CPF/CNPJ diferente, ou sem documento: sobe.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadTemplate}>Baixar modelo da planilha</Button>
            <span className="text-xs text-muted-foreground">
              Envio em lotes de {CLIENTE_BATCH_SIZE}, com {CLIENTE_BATCH_DELAY_MS / 1000}s entre eles.
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
              <p className="text-sm font-medium">Confira se as colunas bateram com nome, telefone e CPF/CNPJ</p>
              {headers.map((header) => (
                <div key={header} className="grid grid-cols-2 gap-2 items-center">
                  <span className="truncate text-sm">{header}</span>
                  <Select
                    value={mapping[header] || "__ignore"}
                    onValueChange={(value) =>
                      setMapping((prev) => ({
                        ...prev,
                        [header]: value === "__ignore" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__ignore">Não usar esta coluna</SelectItem>
                      {fieldsForTipo(tipo).map((field) => (
                        <SelectItem key={field} value={field}>
                          {CLIENTE_FIELD_LABELS[field] || field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="overflow-auto rounded border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Linha</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">Telefone</th>
                      <th className="p-2">CPF/CNPJ</th>
                      <th className="p-2">Vai para</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 12).map((row) => (
                      <tr key={String(row._row)} className="border-b">
                        <td className="p-2">{String(row._row ?? "")}</td>
                        <td className="p-2">{String(row.nome ?? "")}</td>
                        <td className="p-2">{String(row.telefone ?? "")}</td>
                        <td className="p-2">{String(row["cnpj ou cpf"] ?? row.cnpj ?? "")}</td>
                        <td className="p-2">{CLIENTE_DESTINO_LABEL[destino]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="p-2 text-xs text-muted-foreground">
                  Prévia de {Math.min(12, mappedRows.length)} de {mappedRows.length} linhas. Esta tabela ainda não diz quem já existe na empresa.
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
                  <div className="font-medium">Subir só quem ainda não está nesta empresa</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Quem já tem o mesmo nome e o mesmo CPF/CNPJ fica de fora. É o uso normal ao reenviar a lista.
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
                  <div className="font-medium">Atualizar quem já está nesta empresa</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    O mesmo nome e o mesmo CPF/CNPJ substituem o cadastro que já existe.
                  </div>
                </button>
              </div>

              <Button onClick={onDryRun} disabled={busy || mappedRows.length === 0}>
                Conferir quem sobe em {empresaLabel}
              </Button>
            </div>
          )}

          {dry && (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{novosNaPlanilha}</div>
                <div className="text-sm">Vão subir agora</div>
                <div className="text-xs text-muted-foreground">Ainda não estão nesta empresa</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">{dry.totals.duplicates}</div>
                <div className="text-sm">Já estão nesta empresa</div>
                <div className="text-xs text-muted-foreground">Mesmo nome e mesmo CPF/CNPJ, não sobem de novo</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-2xl font-semibold">
                  {duplicateMode === "overwrite" ? dry.totals.willUpdate : dry.totals.invalid}
                </div>
                <div className="text-sm">
                  {duplicateMode === "overwrite" ? "Serão atualizados" : "Não sobem por falta de dado"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {duplicateMode === "overwrite"
                    ? `${dry.totals.invalid} linha(s) sem dados suficientes ficam de fora`
                    : "Nome ou documento ausente na planilha"}
                </div>
              </div>
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
                Pronto. {progress.inserted} contato(s) novos entraram em {empresaLabel}.{" "}
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
