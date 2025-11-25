import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowFilters } from "@/components/whatsapp/workflows/WorkflowFilters";
import { WorkflowListTable } from "@/components/whatsapp/workflows/WorkflowListTable";
import { WorkflowFormDrawer } from "@/components/whatsapp/workflows/WorkflowFormDrawer";
import { WorkflowApprovalQueue } from "@/components/whatsapp/workflows/WorkflowApprovalQueue";
import { BoletoManagement } from "@/components/whatsapp/workflows/BoletoManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkflowApprovals } from "@/hooks/useWorkflowApprovals";
import {
  WorkflowFilters as FiltersState,
  WorkflowEnvio,
  WorkflowFormValues,
} from "@/types/workflows";
import { useWorkflowLists } from "@/hooks/useWorkflowLists";
import { useWhatsAppWorkflows } from "@/hooks/useWhatsAppWorkflows";
import { useLeadOptions } from "@/hooks/useLeadOptions";
import { useEvolutionConfigs } from "@/hooks/useEvolutionConfigs";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { Plus, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAsaasConfig } from "@/hooks/useAsaasConfig";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BoletosList } from "@/components/whatsapp/workflows/BoletosList";
import { MercadoPagoIntegrationPanel } from "@/components/mercado-pago/MercadoPagoIntegrationPanel";
import { MercadoPagoCobrancasManagement } from "@/components/mercado-pago/MercadoPagoCobrancasManagement";
import { MercadoPagoCobrancaForm } from "@/components/mercado-pago/MercadoPagoCobrancaForm";
import { useMercadoPago } from "@/hooks/useMercadoPago";

const DEFAULT_FILTERS: FiltersState = {
  status: "all",
  type: "all",
  listId: "all",
  search: "",
};

export default function PeriodicWorkflows() {
  const navigate = useNavigate();
  const { workflows, isLoading, createWorkflow, updateWorkflow, toggleWorkflowStatus, deleteWorkflow } =
    useWhatsAppWorkflows();
  const { lists, saveList, deleteList, ensureSingleRecipientList } = useWorkflowLists();
  const { leadOptions } = useLeadOptions();
  const { configs: instances } = useEvolutionConfigs();
  const { templates } = useMessageTemplates();
  const { pendingApprovals } = useWorkflowApprovals();
  const { config: asaasConfig, loading: loadingAsaas, saving: savingAsaas, saveConfig: saveAsaasConfig, testConnection } =
    useAsaasConfig();
  const { config: mercadoPagoConfig, isLoadingConfig: loadingMercadoPago } = useMercadoPago();

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowEnvio | null>(null);

  const handleViewChange = (
    view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "agilizechat" | "phonebook" | "workflows",
  ) => {
    switch (view) {
      case "users":
        navigate("/users");
        break;
      case "broadcast":
        navigate("/broadcast");
        break;
      case "agilizechat":
        navigate("/agilizechat");
        break;
      case "settings":
        navigate("/settings");
        break;
      case "phonebook":
        navigate("/lista-telefonica");
        break;
      case "workflows":
        navigate("/workflows");
        break;
      default:
        navigate("/");
    }
  };

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      if (filters.status !== "all" && workflow.status !== filters.status) {
        return false;
      }
      if (filters.type !== "all" && workflow.workflow_type !== filters.type) {
        return false;
      }
      if (filters.listId !== "all" && workflow.workflow_list_id !== filters.listId) {
        return false;
      }
      if (
        filters.search &&
        !workflow.name.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [workflows, filters]);

  const availableTypes = useMemo(() => {
    const set = new Set(workflows.map((workflow) => workflow.workflow_type));
    return Array.from(set);
  }, [workflows]);

  const handleCreate = () => {
    setEditingWorkflow(null);
    setFormOpen(true);
  };

  const handleEdit = (workflow: WorkflowEnvio) => {
    setEditingWorkflow(workflow);
    setFormOpen(true);
  };

  const handleToggle = async (workflow: WorkflowEnvio) => {
    await toggleWorkflowStatus({
      workflowId: workflow.id,
      isActive: !workflow.is_active,
    });
  };

  const handleDeleteWorkflow = async (workflow: WorkflowEnvio) => {
    const confirmed = window.confirm(
      `Excluir workflow "${workflow.name}"? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;
    await deleteWorkflow(workflow.id);
  };

  const handleSaveWorkflow = async (
    data: WorkflowFormValues & { workflow_list_id: string },
    extras: { attachmentsToUpload: File[]; attachmentsToRemove: string[] },
  ) => {
    if (data.id) {
      await updateWorkflow({
        ...data,
        attachmentsToUpload: extras.attachmentsToUpload,
        attachmentsToRemove: extras.attachmentsToRemove,
      });
    } else {
      await createWorkflow({
        ...data,
        attachmentsToUpload: extras.attachmentsToUpload,
        attachmentsToRemove: extras.attachmentsToRemove,
      });
    }
  };

  const pageContent = (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Fluxo Automatizado</CardTitle>
              <p className="text-sm text-muted-foreground">
                Agende cobranças e lembretes automáticos com controle por organização.
              </p>
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Novo workflow
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="workflows" className="w-full">
              <TabsList>
                <TabsTrigger value="workflows">Workflows</TabsTrigger>
                <TabsTrigger value="approvals">
                  Fila de Aprovação
                  {pendingApprovals.length > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {pendingApprovals.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="boletos">Gestão de Boletos Asaas</TabsTrigger>
                <TabsTrigger value="asaas">Integração Asaas</TabsTrigger>
                <TabsTrigger value="mercado-pago">Integração Mercado Pago</TabsTrigger>
                <TabsTrigger value="mercado-pago-cobrancas">Cobranças Mercado Pago</TabsTrigger>
              </TabsList>
              <TabsContent value="workflows" className="space-y-6 mt-6">
                <WorkflowFilters
                  filters={filters}
                  onChange={setFilters}
                  availableTypes={availableTypes}
                  lists={lists}
                  onClear={() => setFilters(DEFAULT_FILTERS)}
                />

                <WorkflowListTable
                  workflows={filteredWorkflows}
                  isLoading={isLoading}
                  onEdit={handleEdit}
                  onToggle={handleToggle}
                  onDelete={handleDeleteWorkflow}
                />
              </TabsContent>
              <TabsContent value="approvals" className="mt-6">
                <WorkflowApprovalQueue />
              </TabsContent>
              <TabsContent value="boletos" className="mt-6">
                <BoletoManagement />
              </TabsContent>
              <TabsContent value="asaas" className="mt-6">
                <Tabs defaultValue="config" className="w-full">
                  <TabsList>
                    <TabsTrigger value="config">Configuração Asaas</TabsTrigger>
                    <TabsTrigger value="boletos">Gestão de Boletos Asaas</TabsTrigger>
                  </TabsList>
                  <TabsContent value="config" className="mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-sm">
                          <Link2 className="h-4 w-4" />
                          Configuração da API Asaas
                        </h3>
                    <p className="text-xs text-muted-foreground">
                      Informe a chave de API do Asaas e o ambiente (sandbox ou produção). Esses dados
                      serão usados para gerar cobranças de boleto nos fluxos de cobrança.
                    </p>
                    <form
                      className="space-y-4"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const formData = new FormData(event.currentTarget);
                        const environment = formData.get("environment") as "sandbox" | "production";
                        const api_key = String(formData.get("api_key") || "");
                        const base_url = String(formData.get("base_url") || "");
                        await saveAsaasConfig({ environment, api_key, base_url });
                      }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="asaas-environment">Ambiente</Label>
                        <Select
                          name="environment"
                          defaultValue={asaasConfig?.environment || "sandbox"}
                        >
                          <SelectTrigger id="asaas-environment">
                            <SelectValue placeholder="Selecione o ambiente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox (teste)</SelectItem>
                            <SelectItem value="production">Produção</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asaas-api-key">API Key Asaas</Label>
                        <Input
                          id="asaas-api-key"
                          name="api_key"
                          type="password"
                          placeholder="Cole aqui a API Key do Asaas"
                          defaultValue={asaasConfig?.api_key || ""}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          A chave será armazenada por organização. Não compartilhe com terceiros.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="asaas-base-url">Base URL</Label>
                        <Input
                          id="asaas-base-url"
                          name="base_url"
                          type="text"
                          defaultValue={asaasConfig?.base_url || "https://www.asaas.com/api/v3"}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" disabled={savingAsaas || loadingAsaas}>
                          {savingAsaas ? "Salvando..." : "Salvar configuração"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!asaasConfig || loadingAsaas}
                          onClick={() => testConnection()}
                        >
                          Testar conexão
                        </Button>
                      </div>
                    </form>
                  </div>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <h4 className="font-semibold text-sm">Como obter a API Key do Asaas</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Acesse o painel do Asaas</li>
                      <li>Vá em Configurações &gt; Integrações &gt; API</li>
                      <li>Copie a API Key (sandbox ou produção)</li>
                      <li>Cole neste formulário e salve</li>
                    </ol>
                    <p>
                      Depois de configurar, os fluxos de cobrança poderão buscar e gerar boletos automaticamente
                      usando a API do Asaas, mantendo os dados separados por organização.
                    </p>
                  </div>
                </div>
                  </TabsContent>
                  <TabsContent value="boletos" className="mt-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-sm">Boletos Gerados</h3>
                      <p className="text-xs text-muted-foreground">
                        Visualize e gerencie todos os boletos criados através dos workflows de cobrança.
                      </p>
                      <BoletosList />
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>
              <TabsContent value="mercado-pago" className="mt-6">
                <MercadoPagoIntegrationPanel />
              </TabsContent>
              <TabsContent value="mercado-pago-cobrancas" className="mt-6">
                <MercadoPagoCobrancasManagement />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <AuthGuard>
      <CRMLayout activeView="workflows" onViewChange={handleViewChange}>
        {pageContent}
      </CRMLayout>
      <WorkflowFormDrawer
        open={formOpen}
        workflow={editingWorkflow}
        lists={lists}
        leadOptions={leadOptions}
        instances={instances}
        templates={templates}
        onOpenChange={setFormOpen}
        onSubmit={handleSaveWorkflow}
        onSaveList={saveList}
        onDeleteList={deleteList}
        ensureSingleList={ensureSingleRecipientList}
      />
    </AuthGuard>
  );
}

