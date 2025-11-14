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
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowEnvio | null>(null);

  const handleViewChange = (
    view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp" | "phonebook" | "workflows",
  ) => {
    switch (view) {
      case "users":
        navigate("/users");
        break;
      case "broadcast":
        navigate("/broadcast");
        break;
      case "whatsapp":
        navigate("/whatsapp");
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

