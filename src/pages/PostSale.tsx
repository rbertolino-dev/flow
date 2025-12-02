import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PostSaleKanbanBoard } from "@/components/crm/PostSaleKanbanBoard";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FollowUpTemplateManager } from "@/components/crm/FollowUpTemplateManager";

export default function PostSale() {
  const { leads, loading, updateLead, refetch } = usePostSaleLeads();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("kanban");

  const handleLeadUpdate = async (leadId: string, newStageId: string) => {
    await updateLead(leadId, { stageId: newStageId });
    await refetch();
  };

  if (loading && activeTab === "kanban") {
    return (
      <AuthGuard>
        <CRMLayout activeView="post-sale" onViewChange={() => {}}>
          <div className="h-full w-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CRMLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <CRMLayout activeView="post-sale" onViewChange={() => {}}>
        <div className="h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="p-4 border-b bg-background">
              <TabsList>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="followup">Follow-up</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="kanban" className="flex-1 flex flex-col overflow-hidden m-0">
              {/* Search Bar */}
              <div className="p-4 border-b bg-background">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar clientes por nome, telefone, email ou empresa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Kanban Board */}
              <div className="flex-1 overflow-hidden">
                <PostSaleKanbanBoard
                  leads={leads}
                  onLeadUpdate={handleLeadUpdate}
                  searchQuery={searchQuery}
                  onRefetch={refetch}
                />
              </div>
            </TabsContent>

            <TabsContent value="followup" className="flex-1 overflow-y-auto m-0 p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Templates de Follow-up - Pós-Venda</CardTitle>
                  <CardDescription>
                    Crie e gerencie templates de acompanhamento para clientes de pós-venda.
                    Defina etapas e automações para garantir um acompanhamento consistente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FollowUpTemplateManager />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

