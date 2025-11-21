import { useState } from "react";
import { useBubbleQueries } from "@/hooks/useBubbleQueries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBubbleConfig } from "@/hooks/useBubbleConfig";
import { Settings, Database, Trash2, Info, Search, Clock, RefreshCw, Sparkles, Download, Filter, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function BubbleIntegration() {
  const { config, isLoading, saveConfig, isSaving, deleteConfig, isDeleting } = useBubbleConfig();
  const { queryHistory, isLoadingHistory, executeQuery, isExecuting, clearOldCache, isClearing } = useBubbleQueries();
  
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  
  // Query form
  const [queryType, setQueryType] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [constraints, setConstraints] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // Filtros dinâmicos
  const [filters, setFilters] = useState<Array<{ key: string; operator: string; value: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Exemplos pré-configurados baseados nos Data Types do Bubble.io do usuário
  const preConfiguredExamples = [
    { name: "Categorias Financeiras", type: "categorias", endpoint: "fin_categoria" },
    { name: "Lançamentos Financeiros", type: "lancamentos", endpoint: "fim_lançamento" },
    { name: "Empresa Principal", type: "empresas", endpoint: "empresa_principal" },
    { name: "Contas Financeiras", type: "contas", endpoint: "fin_contas" },
    { name: "Parcelamentos", type: "parcelamentos", endpoint: "fin_parcelamento" },
    { name: "Ordens de Serviço", type: "ordens", endpoint: "ordem_servico" },
    { name: "Vendas", type: "vendas", endpoint: "vendas" },
    { name: "Caixa Diário", type: "caixa", endpoint: "caixa_dia" },
    { name: "Carrinho/Comanda", type: "carrinho", endpoint: "carrinho/comanda" },
    { name: "Cenário Imposto", type: "impostos", endpoint: "cenário imposto" },
    { name: "Comentários de Contato", type: "comentarios", endpoint: "comentário_contato" },
    { name: "Comunicações", type: "comunicacoes", endpoint: "comunicações" },
    { name: "Credenciais Uazap", type: "credenciais", endpoint: "credenciais uazap" },
    { name: "Descontos/Acréscimos", type: "descontos", endpoint: "desconto_acrescimo" },
  ];

  const handleSelectExample = (value: string) => {
    const example = preConfiguredExamples.find(ex => ex.endpoint === value);
    if (example) {
      setQueryType(example.type);
      setEndpoint(example.endpoint);
      setConstraints("");
      setFilters([]);
      setShowFilters(false);
    }
  };

  const addFilter = () => {
    setFilters([...filters, { key: "", operator: "equals", value: "" }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, field: string, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };

  const buildConstraints = () => {
    return filters
      .filter(f => f.key && f.value)
      .map(f => ({
        key: f.key,
        constraint_type: f.operator,
        value: f.value
      }));
  };

  const exportToCSV = () => {
    if (!queryResult?.data?.response?.results) return;
    
    const results = queryResult.data.response.results;
    if (results.length === 0) return;

    const headers = Object.keys(results[0]).join(",");
    const rows = results.map((row: any) => 
      Object.values(row).map(v => JSON.stringify(v)).join(",")
    ).join("\n");
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bubble_${endpoint}_${new Date().toISOString()}.csv`;
    a.click();
  };

  const exportToJSON = () => {
    if (!queryResult?.data) return;
    
    const json = JSON.stringify(queryResult.data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bubble_${endpoint}_${new Date().toISOString()}.json`;
    a.click();
  };

  const handleSave = () => {
    if (!apiUrl.trim() || !apiKey.trim()) return;
    saveConfig({ api_url: apiUrl.trim(), api_key: apiKey.trim() });
  };

  const handleQuery = () => {
    const params: any = {
      query_type: queryType,
      endpoint: endpoint.trim(),
    };

    // Usar filtros dinâmicos se disponíveis
    const builtConstraints = buildConstraints();
    if (builtConstraints.length > 0) {
      params.constraints = builtConstraints;
    } else if (constraints.trim()) {
      try {
        params.constraints = JSON.parse(constraints);
      } catch (e) {
        return;
      }
    }

    executeQuery(params, {
      onSuccess: (data) => {
        setQueryResult(data);
      },
    });
  };

  const handleDelete = () => {
    deleteConfig();
    setApiUrl("");
    setApiKey("");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integração Bubble.io</h1>
          <p className="text-muted-foreground mt-2">
            Configure e consulte dados do Bubble.io de forma controlada
          </p>
        </div>

        <Tabs defaultValue="config" className="w-full">
          <TabsList>
            <TabsTrigger value="config">
              <Settings className="w-4 h-4 mr-2" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="queries" disabled={!config}>
              <Database className="w-4 h-4 mr-2" />
              Consultas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configuração da API</CardTitle>
                <CardDescription>
                  Configure suas credenciais do Bubble.io para começar a fazer consultas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Configuração existente detectada. Você pode atualizá-la preenchendo os campos abaixo.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="api-url">URL da API Bubble</Label>
                  <Input
                    id="api-url"
                    placeholder="https://your-app.bubbleapps.io/api/1.1"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="text-sm space-y-1">
                    <p className="text-muted-foreground font-medium">Escolha o tipo de API:</p>
                    <p className="text-muted-foreground">
                      • <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/1.1/obj</span> - Para consultar dados de tabelas
                    </p>
                    <p className="text-muted-foreground">
                      • <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">/api/1.1/wf</span> - Para executar workflows
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    placeholder="Digite sua API Key do Bubble"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Encontre sua API Key nas configurações do Bubble.io
                  </p>
                </div>

                {config && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-sm font-medium">Configuração Atual</p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p>URL: {config.api_url}</p>
                      <p>Última atualização: {new Date(config.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave} 
                    disabled={!apiUrl.trim() || !apiKey.trim() || isSaving || isLoading}
                  >
                    {isSaving ? "Salvando..." : config ? "Atualizar Configuração" : "Salvar Configuração"}
                  </Button>

                  {config && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={isDeleting || isLoading}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remover
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá remover permanentemente a configuração da API Bubble.io.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDelete}>
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Informações de Integração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Como usar esta integração:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Configure sua API URL e API Key acima</li>
                    <li>Acesse a aba "Consultas" para fazer requisições controladas</li>
                    <li>Todas as consultas são registradas para controle de uso</li>
                    <li>Utilize os relatórios para análise dos dados obtidos</li>
                  </ol>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    As consultas são armazenadas localmente para evitar gastos excessivos com a API do Bubble.io
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Nova Consulta</CardTitle>
                <CardDescription>
                  Consulte dados do Bubble.io com cache automático de 24h para economia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="example-select">Consultas Pré-Configuradas</Label>
                  <Select onValueChange={handleSelectExample}>
                    <SelectTrigger id="example-select">
                      <SelectValue placeholder="Selecione um exemplo rápido..." />
                    </SelectTrigger>
                    <SelectContent>
                      {preConfiguredExamples.map((example) => (
                        <SelectItem key={example.endpoint} value={example.endpoint}>
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {example.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Selecione um exemplo para preencher automaticamente
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="query-type">Tipo de Consulta</Label>
                    <Input
                      id="query-type"
                      placeholder="Ex: clientes, vendas, orcamentos"
                      value={queryType}
                      onChange={(e) => setQueryType(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">Endpoint (nome da tabela)</Label>
                    <Input
                      id="endpoint"
                      placeholder="Ex: cliente, venda"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Filtros</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      {showFilters ? "Modo Manual" : "Filtros Avançados"}
                    </Button>
                  </div>

                  {showFilters ? (
                    <div className="space-y-3 p-4 border rounded-lg">
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>⚠️ Importante:</strong> Certifique-se de usar campos que existem na tabela <code className="bg-muted px-1 rounded">{endpoint || "selecionada"}</code>.
                          <br />Campos inválidos causarão erro 404 do Bubble.io.
                          <br /><br />
                          <strong>Exemplos de campos comuns:</strong>
                          <br />• Empresas: <code className="bg-muted px-1 rounded">nome</code>, <code className="bg-muted px-1 rounded">cnpj</code>
                          <br />• Vendas: <code className="bg-muted px-1 rounded">valor</code>, <code className="bg-muted px-1 rounded">data</code>, <code className="bg-muted px-1 rounded">status</code>
                          <br />• Lançamentos: <code className="bg-muted px-1 rounded">valor</code>, <code className="bg-muted px-1 rounded">tipo</code>, <code className="bg-muted px-1 rounded">categoria</code>
                        </AlertDescription>
                      </Alert>

                      {filters.map((filter, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Campo da Tabela</Label>
                            <Input
                              placeholder="Ex: nome, valor, status"
                              value={filter.key}
                              onChange={(e) => updateFilter(index, "key", e.target.value)}
                            />
                          </div>
                          <div className="col-span-3 space-y-1">
                            <Label className="text-xs">Operador</Label>
                            <Select
                              value={filter.operator}
                              onValueChange={(v) => updateFilter(index, "operator", v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equals">Igual a</SelectItem>
                                <SelectItem value="not equal">Diferente de</SelectItem>
                                <SelectItem value="is_empty">Vazio</SelectItem>
                                <SelectItem value="is_not_empty">Não vazio</SelectItem>
                                <SelectItem value="text contains">Contém</SelectItem>
                                <SelectItem value="not text contains">Não contém</SelectItem>
                                <SelectItem value="greater than">Maior que</SelectItem>
                                <SelectItem value="less than">Menor que</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Valor</Label>
                            <Input
                              placeholder="Digite o valor"
                              value={filter.value}
                              onChange={(e) => updateFilter(index, "value", e.target.value)}
                              disabled={filter.operator === "is_empty" || filter.operator === "is_not_empty"}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFilter(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addFilter}
                        className="w-full"
                      >
                        + Adicionar Filtro
                      </Button>
                      
                    </div>
                  ) : (
                    <>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Use JSON para filtros. Certifique-se de usar campos que existem na tabela <code className="bg-muted px-1 rounded">{endpoint || "selecionada"}</code>.
                        </AlertDescription>
                      </Alert>
                      <Textarea
                        id="constraints"
                        placeholder='Ex: [{"key": "nome", "constraint_type": "text contains", "value": "PubDigital"}]'
                        value={constraints}
                        onChange={(e) => setConstraints(e.target.value)}
                        rows={3}
                      />
                      <p className="text-sm text-muted-foreground">
                        Deixe vazio para trazer todos os registros ou use os Filtros Avançados
                      </p>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleQuery}
                    disabled={!endpoint.trim() || isExecuting}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    {isExecuting ? "Consultando..." : "Consultar"}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => clearOldCache(7)}
                    disabled={isClearing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Cache Antigo
                  </Button>
                </div>

                {queryResult && (
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">Resultado da Consulta</h3>
                        {queryResult.cached && (
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            Cache
                          </Badge>
                        )}
                        {queryResult.data?.response?.results && (
                          <Badge variant="outline">
                            {queryResult.data.response.results.length} registros
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportToCSV}
                          disabled={!queryResult.data?.response?.results}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportToJSON}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          JSON
                        </Button>
                      </div>
                    </div>

                    {queryResult.data?.response?.results && queryResult.data.response.results.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-96">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {Object.keys(queryResult.data.response.results[0]).map((key) => (
                                  <TableHead key={key} className="whitespace-nowrap">
                                    {key}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queryResult.data.response.results.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                  {Object.values(row).map((value: any, colIdx: number) => (
                                    <TableCell key={colIdx} className="whitespace-nowrap">
                                      {typeof value === 'object' 
                                        ? JSON.stringify(value) 
                                        : String(value || '-')}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted rounded-lg">
                        <pre className="text-sm overflow-auto max-h-96">
                          {JSON.stringify(queryResult.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Consultas</CardTitle>
                <CardDescription>
                  Últimas 50 consultas realizadas (com cache de 24h)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : queryHistory && queryHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryHistory.map((query) => (
                        <TableRow key={query.id}>
                          <TableCell className="font-medium">{query.query_type}</TableCell>
                          <TableCell>{query.query_params?.endpoint || "-"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(query.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setQueryResult({ data: query.response_data, cached: true })}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">
                    Nenhuma consulta realizada ainda
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
