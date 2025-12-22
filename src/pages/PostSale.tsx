import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { PostSaleKanbanBoard } from "@/components/crm/PostSaleKanbanBoard";
import { usePostSaleLeads } from "@/hooks/usePostSaleLeads";
import { Input } from "@/components/ui/input";
import { Search, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FollowUpTemplateManager } from "@/components/crm/FollowUpTemplateManager";
import { useFollowUpTemplates } from "@/hooks/useFollowUpTemplates";
import { Badge } from "@/components/ui/badge";

export default function PostSale() {
  const { leads, loading, updateLead, refetch } = usePostSaleLeads();
  const { templates, loading: templatesLoading } = useFollowUpTemplates();
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
              <div className="space-y-6">
                {/* Listagem de Templates Ativos */}
                <Card>
                  <CardHeader>
                    <CardTitle>Templates Disponíveis</CardTitle>
                    <CardDescription>
                      Templates de follow-up ativos que podem ser aplicados aos clientes de pós-venda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {templatesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum template criado ainda. Use o botão abaixo para criar seu primeiro template.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {templates
                          .filter(t => t.isActive)
                          .map((template) => (
                            <Card key={template.id} className="border-l-4 border-l-primary">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{template.name}</h3>
                                      <Badge variant="secondary" className="text-xs">
                                        {template.steps.length} etapa{template.steps.length !== 1 ? 's' : ''}
                                      </Badge>
                                    </div>
                                    {template.description && (
                                      <p className="text-sm text-muted-foreground mb-2">
                                        {template.description}
                                      </p>
                                    )}
                                    <div className="space-y-1 mt-2">
                                      {template.steps.slice(0, 3).map((step, index) => (
                                        <div key={step.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <span className="w-5 text-xs">{index + 1}.</span>
                                          <span>{step.title}</span>
                                        </div>
                                      ))}
                                      {template.steps.length > 3 && (
                                        <p className="text-xs text-muted-foreground ml-7">
                                          +{template.steps.length - 3} etapa{template.steps.length - 3 !== 1 ? 's' : ''} mais
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 ml-4">
                                    {template.isActive ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : (
                                      <Circle className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        {templates.filter(t => t.isActive).length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhum template ativo. Ative um template ou crie um novo.
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Gerenciador de Templates */}
                <Card>
                  <CardHeader>
                    <CardTitle>Gerenciar Templates</CardTitle>
                    <CardDescription>
                      Crie e gerencie templates de acompanhamento para clientes de pós-venda.
                      Defina etapas e automações para garantir um acompanhamento consistente.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FollowUpTemplateManager />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

