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

type ItemVenda = {
  nome: string;
  qnt: number | null;
  dataHora: string | null;
};

type Lancamento = {
  codigo: string | null;
  criadoEm: string | null;
  dataHora: string | null;
  quantidade: number | null;
  ligadoAVenda: boolean;
  autor: string | null;
};

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
  vezesNaFicha: number;
  autor: string | null;
  gravidade: "atencao" | "critico";
  situacao: "alem_da_ficha" | "ficha_confirma";
  texto: string;
  itensVenda: ItemVenda[];
  lancamentos: Lancamento[];
};

type Report = {
  loja: Loja;
  empresaNome: string;
  inicio: string;
  fim: string;
  resumo: {
    total: number;
    criticos: number;
    maiorRepeticao: number;
    alemDaFicha: number;
    fichaConfirma: number;
    soCopia: number;
  };
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

function porque(row: AlertRow): string {
  const escrito = row.vezesNaFicha ?? 0;
  const saidas = row.vezesSaida;
  const aMais = Math.max(0, saidas - escrito);
  if (aMais > 0) {
    return `A venda ${escrito === 1 ? "tem 1 linha" : `tem ${escrito} linhas`} desse produto. O estoque tirou ${saidas}. ${aMais} saída${aMais === 1 ? "" : "s"} não tem compra.`;
  }
  return `A venda e as saídas não fecham: ${escrito} na venda, ${saidas} no estoque.`;
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
            <CardTitle className="text-sm font-medium">Erros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.alemDaFicha}</div>
            <p className="text-xs text-muted-foreground">Vendas em que o estoque baixou mais do que o escrito na venda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Maior sobra</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.maiorRepeticao}x</div>
            <p className="text-xs text-muted-foreground">A maior quantidade de saídas num único caso</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.criticos}</div>
            <p className="text-xs text-muted-foreground">5 ou mais saídas além da compra</p>
          </CardContent>
        </Card>
      </div>

      {report.alertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum erro neste período. Escolher o produto três vezes e ver o nome três vezes, cada um com quantidade 1, não entra na lista.
        </p>
      ) : (
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="align-top">
                  <span className="block">Quando</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Hora em que a venda foi salva</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">Venda</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Código no topo da ficha</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">Produto</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">O item que saiu a mais</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">Na venda</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Linhas desse produto nessa venda. Cada escolha é uma linha</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">No estoque</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Saídas lançadas para essa venda</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">A mais</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Estoque menos a compra. Este número é o erro</span>
                </TableHead>
                <TableHead className="align-top min-w-[240px]">
                  <span className="block">Por que é erro</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">Resumo para mandar à loja ou ao desenvolvedor</span>
                </TableHead>
                <TableHead className="align-top">
                  <span className="block">Gravidade</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">2 a 4 atenção. 5 ou mais crítico</span>
                </TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.alertas.map((row) => {
                const escrito = row.vezesNaFicha ?? 0;
                const aMais = Math.max(0, row.vezesSaida - escrito);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap align-top">{row.dataHora ?? "—"}</TableCell>
                    <TableCell className="align-top">{row.codigoVenda ?? "sem código"}</TableCell>
                    <TableCell className="max-w-[180px] align-top">{row.produtoNome}</TableCell>
                    <TableCell className="align-top">{escrito} {escrito === 1 ? "vez" : "vezes"}</TableCell>
                    <TableCell className="align-top">{row.vezesSaida} {row.vezesSaida === 1 ? "saída" : "saídas"}</TableCell>
                    <TableCell className="align-top font-medium">{aMais}</TableCell>
                    <TableCell className="align-top text-sm">{porque(row)}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant={row.gravidade === "critico" ? "destructive" : "secondary"}>
                        {row.gravidade === "critico" ? "Crítico" : "Atenção"}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button variant="ghost" size="sm" onClick={() => copy(row.texto)}>
                        <Copy className="h-4 w-4" />
                        Copiar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
          O erro é um só: o estoque baixou mais vezes do que o produto está escrito na venda. Escolher três vezes e ver o nome três vezes, cada linha com quantidade 1, é a compra e não entra aqui. A coluna “A mais” é a sobra. É esse número que indica o erro.
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
