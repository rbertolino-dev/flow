import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { useLeads } from "@/hooks/useLeads";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useTags } from "@/hooks/useTags";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Phone, Calendar, DollarSign, Tag, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CRM() {
  const { leads, loading } = useLeads();
  const { stages } = usePipelineStages();
  const { tags } = useTags();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         lead.phone.includes(searchQuery);
    const matchesStage = selectedStage === "all" || lead.stageId === selectedStage;
    const matchesTag = selectedTag === "all" || lead.tags?.some(tag => tag.id === selectedTag);
    
    return matchesSearch && matchesStage && matchesTag;
  });

  const getStage = (stageId?: string) => stages.find(s => s.id === stageId);

  return (
    <AuthGuard>
      <CRMLayout activeView="kanban" onViewChange={() => {}}>
        <div className="h-full bg-gradient-to-br from-background via-background to-muted/20">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header Section */}
            <div className="mb-8 space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                CRM
              </h1>
              <p className="text-muted-foreground text-lg">
                Gestão completa dos seus contatos e oportunidades
              </p>
            </div>

            {/* Filters Section */}
            <Card className="mb-6 border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou telefone..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as etapas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedTag} onValueChange={setSelectedTag}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as tags</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-border/50 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Leads</p>
                      <p className="text-3xl font-bold">{filteredLeads.length}</p>
                    </div>
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stages.slice(0, 3).map(stage => {
                const stageLeads = filteredLeads.filter(l => l.stageId === stage.id);
                return (
                  <Card key={stage.id} className="border-border/50 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">{stage.name}</p>
                          <p className="text-3xl font-bold">{stageLeads.length}</p>
                        </div>
                        <div 
                          className="h-12 w-12 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${stage.color}20` }}
                        >
                          <div 
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Leads Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {loading ? (
                <div className="col-span-2 text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Carregando leads...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="col-span-2 text-center py-12">
                  <p className="text-muted-foreground">Nenhum lead encontrado</p>
                </div>
              ) : (
                filteredLeads.map(lead => {
                  const stage = getStage(lead.stageId);
                  return (
                    <Card 
                      key={lead.id} 
                      className="border-border/50 shadow-md hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer group"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {lead.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                {lead.name}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3" />
                                {lead.phone}
                              </CardDescription>
                            </div>
                          </div>
                          {stage && (
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                              style={{ 
                                borderColor: stage.color,
                                color: stage.color,
                                backgroundColor: `${stage.color}10`
                              }}
                            >
                              {stage.name}
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {lead.value && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              <span>R$ {lead.value.toLocaleString('pt-BR')}</span>
                            </div>
                          )}
                          {lead.returnDate && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(lead.returnDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                          )}
                          {lead.source && (
                            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-xs">Origem: {lead.source}</span>
                            </div>
                          )}
                        </div>

                        {lead.tags && lead.tags.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            {lead.tags.map(tag => (
                              <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-xs"
                                style={{
                                  backgroundColor: `${tag.color}20`,
                                  color: tag.color,
                                  borderColor: tag.color
                                }}
                              >
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {lead.notes && (
                          <p className="text-sm text-muted-foreground line-clamp-2 pt-2 border-t">
                            {lead.notes}
                          </p>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`, '_blank')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => window.location.href = `tel:${lead.phone}`}
                          >
                            <Phone className="h-4 w-4 mr-1" />
                            Ligar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
