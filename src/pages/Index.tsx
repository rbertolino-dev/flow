import { useState } from "react";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { CallQueue } from "@/components/crm/CallQueue";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useLeads } from "@/hooks/useLeads";
import { useCallQueue } from "@/hooks/useCallQueue";
import { useAutoSync } from "@/hooks/useAutoSync";
import { Loader2, Search } from "lucide-react";
import Settings from "./Settings";
import { Input } from "@/components/ui/input";

const Index = () => {
  const [activeView, setActiveView] = useState<"kanban" | "calls" | "contacts" | "settings">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const { leads, loading: leadsLoading, updateLeadStatus } = useLeads();
  const { callQueue, loading: queueLoading, completeCall, rescheduleCall } = useCallQueue();
  
  // Sincronização automática a cada 5 minutos
  const { lastSync, nextSync, isSyncing } = useAutoSync({ intervalMinutes: 5, enabled: true });

  const handleLeadUpdate = (leadId: string, newStatus: string) => {
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
          <div className="p-6 border-b border-border space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Funil de Vendas</h1>
              <p className="text-muted-foreground">
                Gerencie seus leads através do pipeline de vendas
              </p>
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
