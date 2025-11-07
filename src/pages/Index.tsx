import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { CallQueue } from "@/components/crm/CallQueue";
import { LidContactsList } from "@/components/crm/LidContactsList";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PipelineStageManager } from "@/components/crm/PipelineStageManager";
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useAutoSync } from "@/hooks/useAutoSync";
import { Loader2, Search, Plus } from "lucide-react";
import Settings from "./Settings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [activeView, setActiveView] = useState<"kanban" | "calls" | "contacts" | "settings">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const { leads, loading: leadsLoading, updateLeadStatus, refetch: refetchLeads } = useLeads();
  const { callQueue, loading: queueLoading, completeCall, rescheduleCall, addCallQueueTag, removeCallQueueTag, refetch: refetchCallQueue } = useCallQueue();
  const { stages } = usePipelineStages();
  
  // Sincronização automática a cada 5 minutos
  const { lastSync, nextSync, isSyncing } = useAutoSync({ intervalMinutes: 5, enabled: true });

  const handleLeadUpdate = (leadId: string, newStatus: string) => {
    updateLeadStatus(leadId, newStatus);
  };

  const handleCallComplete = (callId: string, callNotes?: string) => {
    completeCall(callId, callNotes);
  };

  const handleCallReschedule = (callId: string, newDate: Date) => {
    rescheduleCall(callId, newDate);
  };

  if (leadsLoading || queueLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthGuard>
      <CRMLayout 
        activeView={activeView} 
        onViewChange={setActiveView}
        syncInfo={{ lastSync, nextSync, isSyncing }}
      >
      {activeView === "kanban" && (
        <div className="h-full bg-background">
          <div className="p-6 border-b border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Funil de Vendas</h1>
                <p className="text-muted-foreground">
                  Gerencie seus leads através do pipeline de vendas
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCreateLeadOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Contato
                </Button>
                <PipelineStageManager />
              </div>
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou etiqueta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} searchQuery={searchQuery} />
        </div>
      )}

      {activeView === "calls" && (
        <CallQueue
          callQueue={callQueue}
          onCallComplete={handleCallComplete}
          onCallReschedule={handleCallReschedule}
          onAddTag={addCallQueueTag}
          onRemoveTag={removeCallQueueTag}
          onRefetch={refetchCallQueue}
        />
      )}

      {activeView === "contacts" && (
        <LidContactsList />
      )}

      {activeView === "settings" && <Settings />}
      
      <CreateLeadDialog
        open={createLeadOpen}
        onOpenChange={setCreateLeadOpen}
        onLeadCreated={refetchLeads}
        stages={stages}
      />
      </CRMLayout>
    </AuthGuard>
  );
};

export default Index;
