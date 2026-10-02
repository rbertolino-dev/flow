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
            <CardTitle className="text-sm font-medium">Repetiu além da ficha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.alemDaFicha}</div>
            <p className="text-xs text-muted-foreground">A venda mostra o produto menos vezes do que as saídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">A ficha confirma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.fichaConfirma}</div>
            <p className="text-xs text-muted-foreground">Mais de uma unidade, e a venda lista todas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Só na cópia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{report.resumo.soCopia}</div>
            <p className="text-xs text-muted-foreground">Parecia repetido, mas na venda real há um item só</p>
          </CardContent>
        </Card>
      </div>

      {report.alertas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma venda deste período tem o mesmo produto mais de uma vez na ficha real.
          {report.resumo.soCopia > 0
            ? ` ${report.resumo.soCopia} suspeitas eram só da cópia dos dados.`
            : ""}
        </p>
      ) : (
        <div className="space-y-4">
          {report.alertas.map((row) => (
            <Card key={row.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      Venda {row.codigoVenda ?? "sem código"} · {row.produtoNome}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.dataHora ?? "horário não informado"}
                      {row.autor ? ` · salvou ${row.autor}` : ""}
                      {" · "}
                      {row.itensFicha ?? "?"} itens na ficha · {money(row.valorFicha)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={row.situacao === "alem_da_ficha" ? "destructive" : "secondary"}>
                      {row.situacao === "alem_da_ficha" ? "Além da ficha" : "Ficha confirma"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => copy(row.texto)}>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-medium">Itens dentro da venda</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Onde ver: abra a venda. O código fica no topo. Estes produtos são as linhas da lista.
                  </p>
                  <div className="overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto na venda</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Hora do item</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {row.itensVenda.map((item, index) => (
                          <TableRow key={`${row.id}-item-${index}`}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell>{item.qnt ?? "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">{item.dataHora ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Saídas de estoque ligadas a esses itens</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Onde ver: no histórico de estoque do produto. O código é o desta saída. A hora é a data gravada no lançamento.
                  </p>
                  {row.lancamentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma saída ligada a esses itens.</p>
                  ) : (
                    <div className="overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código da saída</TableHead>
                            <TableHead>Hora do lançamento</TableHead>
                            <TableHead>Quem lançou</TableHead>
                            <TableHead>Liga com a venda</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {row.lancamentos.map((item, index) => (
                            <TableRow key={`${row.id}-stock-${index}`}>
                              <TableCell>{item.codigo ?? "sem código"}</TableCell>
                              <TableCell className="whitespace-nowrap">{item.dataHora ?? item.criadoEm ?? "—"}</TableCell>
                              <TableCell>{item.autor ?? "não identificado"}</TableCell>
                              <TableCell>{item.ligadoAVenda ? "Sim, esta venda" : "Não"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
          Cada card é uma venda em que o mesmo produto aparece mais de uma vez. À esquerda está o que você vê ao abrir a venda. À direita está a saída no histórico de estoque do produto.
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
