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
        <div className="h-full bg-background flex flex-col">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-border space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Funil de Vendas</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Gerencie seus leads através do pipeline
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setCreateLeadOpen(true)} size="sm" className="flex-1 sm:flex-none">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="sm:inline">Novo Contato</span>
                </Button>
                <PipelineStageManager />
              </div>
            </div>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} searchQuery={searchQuery} onRefetch={refetchLeads} />
          </div>
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
