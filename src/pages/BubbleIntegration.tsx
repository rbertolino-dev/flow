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
import { Settings, Database, Trash2, Info, Search, Clock, RefreshCw, Sparkles, Download, Filter, X, BarChart, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BubbleUsageReport } from "@/components/bubble/BubbleUsageReport";
import { BubbleClientAnalysis } from "@/components/bubble/BubbleClientAnalysis";
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
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Query form
  const [queryType, setQueryType] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [constraints, setConstraints] = useState("");
  const [queryResult, setQueryResult] = useState<any>(null);
  
  // Filtros dinâmicos
  const [filters, setFilters] = useState<Array<{ key: string; operator: string; value: string }>>([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filtros de data
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateField, setDateField] = useState("Created Date");

  // Exemplos pré-configurados - apenas nomes das tabelas
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
      setQueryResult(null);
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
  
  // Detecta se um valor parece ser um nome (texto com espaços) ao invés de um ID
  const looksLikeName = (value: string): boolean => {
    if (!value) return false;
    // IDs do Bubble geralmente são sequências longas sem espaços
    // Nomes geralmente têm espaços ou são muito curtos e descritivos
    return value.includes(' ') || (value.length < 20 && /[a-zA-Z]/.test(value) && !/^[0-9a-f]{10,}$/i.test(value));
  };
  
  // Verifica se há filtros com valores suspeitos
  const hasInvalidFilters = (): boolean => {
    return filters.some(f => {
      if (!f.key || !f.value) return false;
      // Campos que geralmente requerem IDs relacionados
      const relatedFields = ['empresa', 'cliente', 'usuario', 'user', 'company', 'customer'];
      const isRelatedField = relatedFields.some(rf => f.key.toLowerCase().includes(rf));
      return isRelatedField && looksLikeName(f.value);
    });
  };

  const buildConstraints = () => {
    const builtFilters = filters
      .filter(f => f.key && f.value)
      .map(f => ({
        key: f.key,
        constraint_type: f.operator,
        value: f.value
      }));
    
    // Adicionar filtros de data se definidos
    if (startDate) {
      builtFilters.push({
        key: dateField,
        constraint_type: "greater than",
        value: new Date(startDate).getTime().toString()
      });
    }
    
    if (endDate) {
      builtFilters.push({
        key: dateField,
        constraint_type: "less than",
        value: new Date(endDate + "T23:59:59").getTime().toString()
      });
    }
    
    return builtFilters;
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

  const getAvailableFields = () => {
    if (!queryResult?.data?.response?.results?.[0]) return [];
    return Object.keys(queryResult.data.response.results[0]);
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
            <TabsTrigger value="reports" disabled={!config || !queryHistory || queryHistory.length === 0}>
              <BarChart className="w-4 h-4 mr-2" />
              Relatórios de Uso
            </TabsTrigger>
            <TabsTrigger value="analysis" disabled={!config}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Análise de Clientes
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="api-key">API Key (Segura)</Label>
                    {config && (
                      <Badge variant="secondary" className="text-xs">
                        Conectada e Protegida
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder={config ? "••••••••••••••••" : "Digite sua API Key do Bubble"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      disabled={isLoading}
                    />
                    {(apiKey || config) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? "Ocultar" : "Mostrar"}
                      </Button>
                    )}
                  </div>
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-xs text-blue-800">
                      🔒 Sua API Key é armazenada de forma segura e protegida por criptografia. 
                      Apenas você e membros da sua organização têm acesso.
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm text-muted-foreground">
                    Encontre sua API Key nas configurações do Bubble.io → Settings → API
                  </p>
                </div>

                {config && (
                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Configuração Atual</p>
                      <Badge variant="outline" className="text-xs">Ativa</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>URL:</strong> {config.api_url}</p>
                      <p><strong>API Key:</strong> ••••••••••••••••</p>
                      <p><strong>Última atualização:</strong> {new Date(config.updated_at).toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={handleSave} 
                    disabled={!apiUrl.trim() || !apiKey.trim() || isSaving || isLoading}
                  >
                    {isSaving ? "Salvando..." : config ? "Atualizar Configuração" : "Conectar API Bubble"}
                  </Button>

                  {config && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" disabled={isDeleting || isLoading}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Desconectar API
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desconectar API Bubble.io?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá remover permanentemente a configuração da API Bubble.io. 
                            <br /><br />
                            <strong>Consequências:</strong>
                            <br />• Todas as consultas salvas permanecerão, mas não poderá fazer novas
                            <br />• Você precisará reconectar a API para fazer novas consultas
                            <br />• Seus dados no Bubble.io não serão afetados
                            <br /><br />
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Confirmar Desconexão
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
                  <h3 className="font-medium mb-2">🔒 Segurança da API</h3>
                  <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                    <li><strong>Proteção de Dados:</strong> Sua API Key é armazenada criptografada no banco de dados</li>
                    <li><strong>Acesso Restrito:</strong> Apenas membros da sua organização podem visualizar/usar</li>
                    <li><strong>Isolamento:</strong> Cada organização tem suas próprias credenciais separadas</li>
                    <li><strong>Controle Total:</strong> Você pode desconectar a API a qualquer momento</li>
                    <li><strong>Cache Inteligente:</strong> Consultas são armazenadas por 24h para reduzir chamadas</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Como usar esta integração:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Configure sua API URL e API Key acima</li>
                    <li>Acesse a aba "Consultas" para fazer requisições controladas</li>
                    <li>Todas as consultas são registradas para controle de uso</li>
                    <li>Utilize os relatórios para análise dos dados obtidos</li>
                    <li>Para desconectar, use o botão "Desconectar API" acima</li>
                  </ol>
                </div>

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Cache automático:</strong> As consultas são armazenadas localmente por 24 horas 
                    para evitar gastos excessivos com a API do Bubble.io e melhorar a performance.
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
                  <Label htmlFor="example-select">Selecione a Tabela</Label>
                  <Select onValueChange={handleSelectExample} value={endpoint}>
                    <SelectTrigger id="example-select">
                      <SelectValue placeholder="Escolha uma tabela do Bubble.io..." />
                    </SelectTrigger>
                    <SelectContent>
                      {preConfiguredExamples.map((example) => (
                        <SelectItem key={example.endpoint} value={example.endpoint}>
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            {example.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>💡 Fluxo Recomendado para Filtrar por Empresa:</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-1">
                        <li><strong>PASSO 1:</strong> Selecione a tabela <code className="bg-background px-1 rounded">empresa_principal</code></li>
                        <li><strong>PASSO 2:</strong> Clique em "Consultar" SEM adicionar filtros</li>
                        <li><strong>PASSO 3:</strong> Na tabela de resultados abaixo, localize a empresa desejada</li>
                        <li><strong>PASSO 4:</strong> Copie EXATAMENTE o valor do campo <code className="bg-background px-1 rounded">_id</code> (ex: 1667190288736x968847483630780400)</li>
                        <li><strong>PASSO 5:</strong> Volte e selecione a tabela desejada (vendas, lançamentos, etc)</li>
                        <li><strong>PASSO 6:</strong> Adicione filtro no campo "empresa" com o _id copiado</li>
                      </ol>
                      <p className="mt-2 text-xs text-muted-foreground">
                        ⚠️ Campos relacionados no Bubble.io requerem o _id EXATO. Se receber erro "object does not exist", verifique se copiou o _id correto da empresa certa!
                      </p>
                    </AlertDescription>
                  </Alert>
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

                <div className="space-y-4">
                  {/* Filtros de Data */}
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <Label className="font-semibold">Filtrar por Data de Criação</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Campo de Data</Label>
                        <Input
                          placeholder="Created Date"
                          value={dateField}
                          onChange={(e) => setDateField(e.target.value)}
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Padrão: "Created Date" (formato Bubble)
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Data Inicial</Label>
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs">Data Final</Label>
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    
                    {(startDate || endDate) && (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {startDate && endDate ? (
                            <>Buscando registros criados entre {new Date(startDate).toLocaleDateString('pt-BR')} e {new Date(endDate).toLocaleDateString('pt-BR')}</>
                          ) : startDate ? (
                            <>Buscando registros criados a partir de {new Date(startDate).toLocaleDateString('pt-BR')}</>
                          ) : (
                            <>Buscando registros criados até {new Date(endDate).toLocaleDateString('pt-BR')}</>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* Filtros Avançados */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Filtros Adicionais</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowFilters(!showFilters)}
                        disabled={!queryResult}
                        title={!queryResult ? "Faça uma consulta sem filtros primeiro para descobrir os campos disponíveis" : ""}
                      >
                        <Filter className="w-4 h-4 mr-2" />
                        {showFilters ? "Modo Manual" : "Filtros Avançados"}
                      </Button>
                    </div>
                    
                    {!queryResult && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <Info className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-800">
                          <strong>⚠️ PRIMEIRO PASSO OBRIGATÓRIO:</strong>
                          <br />Clique em "Consultar" abaixo SEM adicionar filtros.
                          <br />Isso mostrará os campos disponíveis nesta tabela.
                          <br />Depois você poderá adicionar filtros usando os campos reais.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {showFilters ? (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <Alert className="bg-destructive/10 border-destructive/30">
                        <Info className="h-4 w-4 text-destructive" />
                        <AlertDescription className="text-sm">
                          <strong className="text-destructive">🚫 ATENÇÃO: NÃO use nomes de empresas como valores!</strong>
                          <div className="mt-2 space-y-1 text-xs">
                            <p><strong>❌ ERRADO:</strong> Campo "empresa" com valor "pubdigital ADM"</p>
                            <p><strong>✅ CORRETO:</strong> Campo "empresa" com valor "1667190288736x968847483630780400" (formato de _id do Bubble)</p>
                          </div>
                          <div className="mt-3 p-2 bg-background rounded text-xs space-y-1">
                            <p className="font-semibold">Como obter o ID correto:</p>
                            <p>1. Consulte <code className="bg-muted px-1 rounded">empresa_principal</code> SEM filtros</p>
                            <p>2. Encontre a empresa na lista de resultados</p>
                            <p>3. Copie o valor EXATO do campo <code className="bg-muted px-1 rounded">_id</code></p>
                            <p>4. Cole esse ID no filtro aqui</p>
                            <p className="text-muted-foreground mt-2">💡 Se receber erro "object does not exist", o ID está correto no formato mas não existe no banco - verifique se copiou o _id certo!</p>
                          </div>
                        </AlertDescription>
                      </Alert>

                      {getAvailableFields().length > 0 && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <strong>✅ Campos encontrados na última consulta:</strong>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {getAvailableFields().map((field) => (
                                <Badge key={field} variant="secondary" className="text-xs">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                            <p className="mt-2">Use esses nomes exatos nos filtros abaixo.</p>
                          </AlertDescription>
                        </Alert>
                      )}

                      {filters.map((filter, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-4 space-y-1">
                            <Label className="text-xs">Campo da Tabela</Label>
                            {getAvailableFields().length > 0 ? (
                              <Select
                                value={filter.key}
                                onValueChange={(v) => updateFilter(index, "key", v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o campo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailableFields().map((field) => (
                                    <SelectItem key={field} value={field}>
                                      {field}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                placeholder="Digite o nome do campo"
                                value={filter.key}
                                onChange={(e) => updateFilter(index, "key", e.target.value)}
                              />
                            )}
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
                            <div className="space-y-1">
                              <Input
                                placeholder="Digite o valor"
                                value={filter.value}
                                onChange={(e) => updateFilter(index, "value", e.target.value)}
                                disabled={filter.operator === "is_empty" || filter.operator === "is_not_empty"}
                                className={
                                  filter.key && 
                                  ['empresa', 'cliente', 'usuario', 'user', 'company', 'customer'].some(rf => filter.key.toLowerCase().includes(rf)) &&
                                  looksLikeName(filter.value)
                                    ? "border-destructive focus-visible:ring-destructive"
                                    : ""
                                }
                              />
                              {filter.key && 
                               ['empresa', 'cliente', 'usuario', 'user', 'company', 'customer'].some(rf => filter.key.toLowerCase().includes(rf)) &&
                               looksLikeName(filter.value) && (
                                <p className="text-xs text-destructive font-medium">
                                  ⚠️ Este parece ser um nome! Use o _id do objeto relacionado
                                </p>
                              )}
                            </div>
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

                <div className="flex gap-2 flex-col">
                  {hasInvalidFilters() && (
                    <Alert className="bg-destructive/10 border-destructive">
                      <Info className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-sm text-destructive">
                        <strong>❌ FILTRO INVÁLIDO DETECTADO</strong>
                        <br />Você está tentando usar NOMES ao invés de IDs em campos relacionados.
                        <br />Bubble.io requer o <strong>_id</strong> do objeto, não o nome!
                        <br /><br />
                        <strong>Corrija antes de consultar:</strong>
                        <br />1. Consulte a tabela relacionada (ex: empresa_principal) SEM filtros
                        <br />2. Copie o <strong>_id</strong> do registro que você quer
                        <br />3. Cole esse ID no filtro
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleQuery}
                      disabled={!endpoint.trim() || isExecuting || hasInvalidFilters()}
                      title={hasInvalidFilters() ? "Corrija os filtros inválidos antes de consultar" : ""}
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

          <TabsContent value="reports" className="space-y-4">
            <BubbleUsageReport 
              queries={queryHistory || []} 
            />
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <BubbleClientAnalysis queryHistory={queryHistory} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
