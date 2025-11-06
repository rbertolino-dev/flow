import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { CallQueue } from "@/components/crm/CallQueue";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { useAutoSync } from "@/hooks/useAutoSync";
import { LeadStatus } from "@/types/lead";
import { Loader2 } from "lucide-react";
import Settings from "./Settings";

const Index = () => {
  const [activeView, setActiveView] = useState<"kanban" | "calls" | "contacts" | "settings">("kanban");
  const { leads, loading: leadsLoading, updateLeadStatus } = useLeads();
  const { callQueue, loading: queueLoading, completeCall, rescheduleCall } = useCallQueue();
  
  // Sincronização automática a cada 5 minutos
  const { lastSync, nextSync, isSyncing } = useAutoSync({ intervalMinutes: 5, enabled: true });

  const handleLeadUpdate = (leadId: string, newStatus: LeadStatus) => {
    updateLeadStatus(leadId, newStatus);
  };

  const handleCallComplete = (callId: string) => {
    completeCall(callId);
  };

  const handleCallReschedule = (callId: string) => {
    rescheduleCall(callId);
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
          <div className="p-6 border-b border-border">
            <h1 className="text-3xl font-bold mb-2">Funil de Vendas</h1>
            <p className="text-muted-foreground">
              Gerencie seus leads através do pipeline de vendas
            </p>
          </div>
          <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} />
        </div>
      )}

      {activeView === "calls" && (
        <CallQueue
          callQueue={callQueue}
          onCallComplete={handleCallComplete}
          onCallReschedule={handleCallReschedule}
        />
      )}

      {activeView === "contacts" && (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Contatos</h2>
            <p className="text-muted-foreground">Em desenvolvimento</p>
          </div>
        </div>
      )}

      {activeView === "settings" && <Settings />}
      </CRMLayout>
    </AuthGuard>
  );
};

export default Index;
