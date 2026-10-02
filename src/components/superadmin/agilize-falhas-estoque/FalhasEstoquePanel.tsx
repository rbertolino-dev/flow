import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Copy, Loader2, RefreshCw } from "lucide-react";

type Loja = "triunfo" | "crimeia";

type AlertRow = {
  id: string;
  vendaId: string | null;
  codigoVenda: string | null;
  dataHora: string | null;
  produtoId: string;
  produtoNome: string;
  vezesCarrinho: number;
  vezesSaida: number;
  valorFicha: number | null;
  itensFicha: number | null;
  autor: string | null;
  gravidade: "atencao" | "critico";
  texto: string;
};

type Report = {
  loja: Loja;
  empresaNome: string;
  inicio: string;
  fim: string;
  resumo: { total: number; criticos: number; maiorRepeticao: number };
  alertas: AlertRow[];
};

function brtToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function money(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function loadReport(loja: Loja, inicio: string, fim: string): Promise<Report> {
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    const refreshed = await supabase.auth.refreshSession();
    accessToken = refreshed.data.session?.access_token;
  }
  if (!accessToken) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  const response = await fetch(`${supabaseUrl}/functions/v1/agilize-estoque-falhas`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ loja, inicio, fim }),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status}`);
  }
  return data as Report;
}

function ColumnTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="block">
      <span className="block font-medium text-foreground">{title}</span>
      <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
        {hint}
      </span>
    </span>
  );
}

function LojaReport({ loja, inicio, fim }: { loja: Loja; inicio: string; fim: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await loadReport(loja, inicio, fim));
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Falha ao consultar");
    } finally {
      setLoading(false);
    }
  }, [loja, inicio, fim]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast({ title: "Alerta copiado" });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!report) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Casos no período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.total}</div>
            <p className="text-xs text-muted-foreground">Vendas em que o mesmo produto se repetiu</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.criticos}</div>
            <p className="text-xs text-muted-foreground">5 ou mais cópias do mesmo produto</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Maior repetição</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.maiorRepeticao}x</div>
            <p className="text-xs text-muted-foreground">O caso que mais repetiu neste período</p>
          </CardContent>
        </Card>
      </div>

      {report.alertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma repetição de saída neste período.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="align-top">
                  <ColumnTitle title="Quando" hint="Dia e hora do salvamento" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="Código da venda" hint="Número que aparece na ficha" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="Produto" hint="O item que se repetiu" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="No carrinho" hint="Vezes que o sistema gravou o item" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="Saídas do estoque" hint="Vezes que saiu no mesmo segundo" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="O que a ficha mostra" hint="Itens e valor reais da venda" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="Quem salvou" hint="Usuário logado na hora" />
                </TableHead>
                <TableHead className="align-top">
                  <ColumnTitle title="Gravidade" hint="3–4 atenção, 5+ crítico" />
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.alertas.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{row.dataHora ?? "—"}</TableCell>
                  <TableCell>{row.codigoVenda ?? "sem código"}</TableCell>
                  <TableCell className="max-w-[220px]">{row.produtoNome}</TableCell>
                  <TableCell>{row.vezesCarrinho ? `${row.vezesCarrinho} vezes` : "—"}</TableCell>
                  <TableCell>{row.vezesSaida ? `${row.vezesSaida} vezes` : "não achou saída"}</TableCell>
                  <TableCell>
                    {row.itensFicha == null ? "ficha não lida" : `${row.itensFicha} itens na ficha`}
                    <div className="text-xs text-muted-foreground">Valor {money(row.valorFicha)}</div>
                  </TableCell>
                  <TableCell>{row.autor ?? "não identificado"}</TableCell>
                  <TableCell>
                    <Badge variant={row.gravidade === "critico" ? "destructive" : "secondary"}>
                      {row.gravidade === "critico" ? "Crítico" : "Atenção"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => copy(row.texto)}>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function FalhasEstoquePanel() {
  const today = brtToday();
  const [inicio, setInicio] = useState(addDays(today, -6));
  const [fim, setFim] = useState(today);
  const [applied, setApplied] = useState({ inicio: addDays(today, -6), fim: today });
  const [loja, setLoja] = useState<Loja>("triunfo");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Falhas de estoque</h1>
        <p className="text-sm text-muted-foreground">
          A ficha da venda continua certa. O problema é o salvamento gravar o mesmo produto várias vezes e tirar do estoque de novo. Duas vezes não entra: pode ser uma compra de duas unidades.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          De
          <input
            type="date"
            value={inicio}
            onChange={(event) => setInicio(event.target.value)}
            className="mt-1 block rounded-md border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Até
          <input
            type="date"
            value={fim}
            onChange={(event) => setFim(event.target.value)}
            className="mt-1 block rounded-md border bg-background px-3 py-2"
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => setApplied({ inicio, fim })}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <Tabs value={loja} onValueChange={(value) => setLoja(value as Loja)}>
        <TabsList>
          <TabsTrigger value="triunfo">Eficaz Triunfo</TabsTrigger>
          <TabsTrigger value="crimeia">Eficaz Crimeia</TabsTrigger>
        </TabsList>
        <TabsContent value="triunfo" className="mt-4">
          <LojaReport loja="triunfo" inicio={applied.inicio} fim={applied.fim} />
        </TabsContent>
        <TabsContent value="crimeia" className="mt-4">
          <LojaReport loja="crimeia" inicio={applied.inicio} fim={applied.fim} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
