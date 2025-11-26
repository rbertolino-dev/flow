import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useBubbleLeadsSync, FieldMapping } from "@/hooks/useBubbleLeadsSync";
import { useBubbleConfig } from "@/hooks/useBubbleConfig";
import { Loader2, RefreshCw, Play, CheckCircle2, AlertCircle, Plus, Trash2, List, Edit3 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const LEAD_FIELDS: { value: FieldMapping['lead_field']; label: string }[] = [
  { value: 'name', label: 'Nome' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'company', label: 'Empresa' },
  { value: 'value', label: 'Valor' },
  { value: 'notes', label: 'Observações' },
];

export function BubbleLeadsSyncPanel() {
  const { toast } = useToast();
  const { config: bubbleConfig, isLoading: isLoadingBubbleConfig } = useBubbleConfig();
  const { 
    savedConfig, 
    isLoadingConfig, 
    saveConfig, 
    isSavingConfig, 
    syncLeads, 
    isSyncing,
    lastSyncResult,
    dataTypes,
    isLoadingDataTypes,
    fetchDataTypes
  } = useBubbleLeadsSync();

  const [endpoint, setEndpoint] = useState("");
  const [inputMode, setInputMode] = useState<"select" | "manual">("select");
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([
    { bubble_field: "", lead_field: "name" },
    { bubble_field: "", lead_field: "phone" },
  ]);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (savedConfig) {
      setEndpoint(savedConfig.endpoint);
      setFieldMappings(savedConfig.field_mappings.length > 0 
        ? savedConfig.field_mappings 
        : [{ bubble_field: "", lead_field: "name" }, { bubble_field: "", lead_field: "phone" }]
      );
    }
  }, [savedConfig]);

  // Buscar Data Types quando carregar
  useEffect(() => {
    if (bubbleConfig) {
      fetchDataTypes();
    }
  }, [bubbleConfig]);

  const handleAddMapping = () => {
    setFieldMappings([...fieldMappings, { bubble_field: "", lead_field: "name" }]);
  };

  const handleRemoveMapping = (index: number) => {
    setFieldMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const handleMappingChange = (index: number, field: keyof FieldMapping, value: any) => {
    const updated = [...fieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setFieldMappings(updated);
  };

  const handleSaveConfig = () => {
    // Validar mapeamentos obrigatórios
    const hasName = fieldMappings.some(m => m.lead_field === 'name' && m.bubble_field);
    const hasPhone = fieldMappings.some(m => m.lead_field === 'phone' && m.bubble_field);

    if (!hasName || !hasPhone) {
      toast({
        title: "Mapeamento incompleto",
        description: "É obrigatório mapear os campos 'Nome' e 'Telefone'",
        variant: "destructive",
      });
      return;
    }

    if (!endpoint) {
      toast({
        title: "Endpoint obrigatório",
        description: "Informe o nome da tabela/endpoint do Bubble",
        variant: "destructive",
      });
      return;
    }

    saveConfig({
      endpoint,
      field_mappings: fieldMappings.filter(m => m.bubble_field), // Remover mapeamentos vazios
    });
  };

  const handleTestSync = () => {
    if (!endpoint) {
      toast({
        title: "Endpoint obrigatório",
        description: "Informe o nome da tabela/endpoint do Bubble",
        variant: "destructive",
      });
      return;
    }

    syncLeads({
      config: {
        endpoint,
        field_mappings: fieldMappings.filter(m => m.bubble_field),
      },
      dry_run: true,
    });
  };

  const handleSync = () => {
    if (!endpoint) {
      toast({
        title: "Endpoint obrigatório",
        description: "Informe o nome da tabela/endpoint do Bubble",
        variant: "destructive",
      });
      return;
    }

    syncLeads({
      config: {
        endpoint,
        field_mappings: fieldMappings.filter(m => m.bubble_field),
      },
      dry_run: false,
    });
  };

  if (isLoadingBubbleConfig || isLoadingConfig) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!bubbleConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sincronização de Leads do Bubble</CardTitle>
          <CardDescription>
            Configure a integração com Bubble.io primeiro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configure a API do Bubble.io na seção de Configurações antes de usar a sincronização de leads.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronização de Leads do Agilize Total (Bubble)
        </CardTitle>
        <CardDescription>
          Configure o mapeamento de campos e sincronize leads do seu ERP Bubble para o sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Endpoint/Tabela do Bubble */}
        <div className="space-y-2">
          <Label htmlFor="bubble-endpoint">Tabela do Bubble</Label>
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "select" | "manual")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="select">
                <List className="h-4 w-4 mr-2" />
                Selecionar
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Edit3 className="h-4 w-4 mr-2" />
                Digitar Manualmente
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="select" className="space-y-2 mt-2">
              <div className="flex gap-2">
                <Select
                  value={endpoint}
                  onValueChange={(value) => {
                    setEndpoint(value);
                    // Resetar mapeamentos quando mudar de tabela
                    setFieldMappings([
                      { bubble_field: "", lead_field: "name" },
                      { bubble_field: "", lead_field: "phone" },
                    ]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma tabela..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingDataTypes ? (
                      <div className="p-2 text-center">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      </div>
                    ) : dataTypes && dataTypes.length > 0 ? (
                      dataTypes.map((dt) => (
                        <SelectItem key={dt.name} value={dt.name}>
                          {dt.name} ({dt.fields.length} campos)
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-sm text-muted-foreground">
                        Nenhuma tabela encontrada
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fetchDataTypes()}
                  disabled={isLoadingDataTypes}
                >
                  {isLoadingDataTypes ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione o Data Type do Bubble que contém os leads/clientes
              </p>
            </TabsContent>
            
            <TabsContent value="manual" className="space-y-2 mt-2">
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="Digite o nome da tabela (ex: contato)"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Digite exatamente o nome do Data Type no Bubble (case-sensitive)
              </p>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mapeamento de Campos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Mapeamento de Campos</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddMapping}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Campo
            </Button>
          </div>

          <div className="space-y-3 border rounded-lg p-4">
            {endpoint ? (
              fieldMappings.map((mapping, index) => {
                const currentDataType = dataTypes?.find(dt => dt.name === endpoint);
                
                return (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Campo no Bubble</Label>
                      <Select
                        value={mapping.bubble_field}
                        onValueChange={(value) => handleMappingChange(index, 'bubble_field', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {currentDataType?.fields.map((field) => (
                            <SelectItem key={field.name} value={field.name}>
                              {field.name} ({field.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Campo no Sistema</Label>
                      <Select
                        value={mapping.lead_field}
                        onValueChange={(value) => handleMappingChange(index, 'lead_field', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_FIELDS.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveMapping(index)}
                      disabled={fieldMappings.length <= 2}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Selecione uma tabela do Bubble primeiro
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Obrigatório:</strong> Nome e Telefone devem estar mapeados. 
              Os outros campos são opcionais.
            </AlertDescription>
          </Alert>
        </div>

        {/* Resultado do Teste/Sincronização */}
        {lastSyncResult && (
          <Alert variant={lastSyncResult.success ? "default" : "destructive"}>
            {lastSyncResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <p><strong>Total encontrado:</strong> {lastSyncResult.stats.total_found}</p>
                {lastSyncResult.dry_run ? (
                  <>
                    <p><strong>Seriam criados:</strong> {lastSyncResult.stats.created}</p>
                    <p><strong>Seriam atualizados:</strong> {lastSyncResult.stats.updated}</p>
                  </>
                ) : (
                  <>
                    <p><strong>Criados:</strong> {lastSyncResult.stats.created}</p>
                    <p><strong>Atualizados:</strong> {lastSyncResult.stats.updated}</p>
                  </>
                )}
                {lastSyncResult.stats.skipped > 0 && (
                  <p><strong>Ignorados:</strong> {lastSyncResult.stats.skipped}</p>
                )}
                {lastSyncResult.stats.errors > 0 && (
                  <p className="text-destructive">
                    <strong>Erros:</strong> {lastSyncResult.stats.errors}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-2">
          <Button
            onClick={handleSaveConfig}
            disabled={isSavingConfig || !endpoint}
            variant="outline"
          >
            {isSavingConfig ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Configuração"
            )}
          </Button>
          <Button
            onClick={handleTestSync}
            disabled={isSyncing || !endpoint}
            variant="outline"
          >
            <Play className="h-4 w-4 mr-2" />
            Testar Sincronização
          </Button>
          <Button
            onClick={handleSync}
            disabled={isSyncing || !endpoint}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Agora
              </>
            )}
          </Button>
        </div>

        {savedConfig && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Configuração salva</Badge>
            {savedConfig.last_sync_at && (
              <span>Última sincronização: {new Date(savedConfig.last_sync_at).toLocaleString('pt-BR')}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

