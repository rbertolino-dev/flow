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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Importar clientes no Agilize Total</CardTitle>
          <CardDescription>
            Grava no Agilize Total da empresa informada. Duplicata só quando nome e CPF/CNPJ são os dois iguais. Telefone repetido com outro nome entra normal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="empresaNome">Nome da empresa</Label>
              <Input id="empresaNome" value={empresaNome} onChange={(e) => setEmpresaNome(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="empresaId">Unique ID da empresa</Label>
              <Input id="empresaId" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} />
            </div>
          </div>
          <Button onClick={onValidate} disabled={busy || !empresaId.trim()}>
            Validar empresa
          </Button>
          {validated && (
            <Alert>
              <AlertDescription>
                <div className="text-base font-medium">
                  {validated.empresaCadastro.found
                    ? validated.empresaCadastro.nome
                    : "Nome não encontrado para este ID"}
                </div>
                <div className="mt-1 text-xs break-all">{validated.empresaId}</div>
                {validated.nameWarning ? <div className="mt-1">{validated.nameWarning}</div> : null}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Para onde vai</CardTitle>
          <CardDescription>
            Escolha antes de validar a planilha. Lotes de {CLIENTE_BATCH_SIZE} a cada {CLIENTE_BATCH_DELAY_MS}ms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["lead", "contato"],
                ["cliente_contato", "contato"],
                ["cliente_empresa", "empresa"],
              ] as const
            ).map(([value, nextTipo]) => (
              <Button
                key={value}
                variant={destino === value ? "default" : "outline"}
                onClick={() => {
                  setDestino(value);
                  setTipo(nextTipo);
                  setDry(null);
                  if (headers.length) setMapping(autoMapClienteColumns(headers, nextTipo));
                }}
              >
                {CLIENTE_DESTINO_LABEL[value]}
              </Button>
            ))}
            <Button variant="outline" onClick={downloadTemplate}>Baixar template</Button>
          </div>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!validated}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          {headers.length > 0 && (
            <div className="space-y-2">
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
                      <SelectItem value="__ignore">Ignorar</SelectItem>
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
                      <th className="p-2">Destino</th>
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
                {mappedRows.length > 12 && (
                  <p className="p-2 text-xs text-muted-foreground">
                    Prévia das 12 primeiras de {mappedRows.length} linhas.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={duplicateMode === "skip" ? "default" : "outline"} onClick={() => setDuplicateMode("skip")}>
                  Ignorar duplicados
                </Button>
                <Button variant={duplicateMode === "overwrite" ? "default" : "outline"} onClick={() => setDuplicateMode("overwrite")}>
                  Atualizar duplicados
                </Button>
                <Button onClick={onDryRun} disabled={busy || mappedRows.length === 0}>
                  Validar {mappedRows.length} linhas
                </Button>
              </div>
            </div>
          )}
          {dry && (
            <Alert>
              <AlertDescription>
                Válidas {dry.totals.valid} · inválidas {dry.totals.invalid} · duplicadas {dry.totals.duplicates} ·
                a atualizar {dry.totals.willUpdate}
              </AlertDescription>
            </Alert>
          )}
          {dry && dry.invalid.length > 0 && (
            <ul className="text-sm text-destructive">
              {dry.invalid.map((item) => (
                <li key={`${item.row}-${item.error}`}>Linha {item.row}: {item.error}</li>
              ))}
            </ul>
          )}
          {dry && dry.duplicates.length > 0 && (
            <ul className="max-h-48 overflow-auto text-sm">
              {dry.duplicates.map((item) => (
                <li key={`${item.row}-${item.nome}`}>
                  Ignorado linha {item.row} — {item.nome}: {item.reason || item.matchBy}
                </li>
              ))}
            </ul>
          )}
          {dry && (
            <Button onClick={onImport} disabled={busy || progress.status === "running"}>
              Importar no Agilize Total
            </Button>
          )}
          {progress.status !== "idle" && (
            <p className="text-sm">
              {progress.processed}/{progress.total} · novos {progress.inserted} · atualizados {progress.updated} ·
              ignorados {progress.skipped} · erros {progress.errors}
            </p>
          )}
          {progress.skippedItems.length > 0 && (
            <ul className="max-h-48 overflow-auto text-sm">
              {progress.skippedItems.map((item) => (
                <li key={`${item.row}-${item.nome}`}>
                  Ignorado linha {item.row} — {item.nome}: {item.reason}
                </li>
              ))}
            </ul>
          )}
          {progress.logs.slice(-8).map((log) => (
            <p key={log} className="text-xs text-muted-foreground">{log}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
