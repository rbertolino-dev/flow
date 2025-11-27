import { useState, useMemo } from "react";
import { useLabelsReport } from "@/hooks/useLabelsReport";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag, Users, MessageSquare, TrendingUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const LabelsReport = () => {
  const { report, isLoading } = useLabelsReport();
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const stats = useMemo(() => {
    const totalLabels = report.length;
    const totalConversations = report.reduce((sum, r) => sum + r.totalConversations, 0);
    const totalLeads = report.reduce((sum, r) => sum + r.totalLeads, 0);
    const avgLeads = totalLabels > 0 ? (totalLeads / totalLabels).toFixed(1) : '0';
    return { totalLabels, totalConversations, totalLeads, avgLeads };
  }, [report]);

  const selectedLabel = useMemo(() => {
    if (!selectedLabelId) return null;
    return report.find(r => r.labelId === selectedLabelId);
  }, [report, selectedLabelId]);

  const filteredLeads = useMemo(() => {
    if (!selectedLabel) return [];
    if (!searchQuery.trim()) return selectedLabel.leads;
    const query = searchQuery.toLowerCase();
    return selectedLabel.leads.filter(lead =>
      lead.leadName.toLowerCase().includes(query) ||
      lead.leadPhone.includes(query) ||
      lead.contactName.toLowerCase().includes(query)
    );
  }, [selectedLabel, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando relatório...</p>
        </div>
      </div>
    );
  }

  if (report.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Tag className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold mb-2">Nenhuma etiqueta encontrada</p>
          <p className="text-sm text-muted-foreground">Crie etiquetas no Chatwoot para ver o relatório</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Estatísticas no Topo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Tag className="h-5 w-5 opacity-80" />
            <span className="text-2xl font-bold">{stats.totalLabels}</span>
          </div>
          <p className="text-sm opacity-90">Total de Etiquetas</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-5 w-5 opacity-80" />
            <span className="text-2xl font-bold">{stats.totalConversations}</span>
          </div>
          <p className="text-sm opacity-90">Total de Conversas</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-5 w-5 opacity-80" />
            <span className="text-2xl font-bold">{stats.totalLeads}</span>
          </div>
          <p className="text-sm opacity-90">Total de Leads</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 opacity-80" />
            <span className="text-2xl font-bold">{stats.avgLeads}</span>
          </div>
          <p className="text-sm opacity-90">Média por Etiqueta</p>
        </div>
      </div>

      {/* Conteúdo Principal - Layout Horizontal */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Coluna Esquerda - Lista de Etiquetas */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Etiquetas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
              <Button
                variant={selectedLabelId === null ? "default" : "outline"}
                className="w-full justify-start h-auto py-3"
                onClick={() => setSelectedLabelId(null)}
              >
                <div className="flex items-center gap-2 w-full">
                  <Tag className="h-4 w-4" />
                  <span className="flex-1 text-left">Todas</span>
                  <Badge variant="secondary">{stats.totalLeads}</Badge>
                </div>
              </Button>
              
              {report.map((label) => (
                <Button
                  key={label.labelId}
                  variant={selectedLabelId === label.labelId ? "default" : "outline"}
                  className="w-full justify-start h-auto py-3"
                  onClick={() => setSelectedLabelId(label.labelId)}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div
                      className="h-4 w-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.labelColor }}
                    />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium truncate">{label.labelTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {label.totalLeads} leads
                      </div>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0">
                      {label.totalLeads}
                    </Badge>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Detalhes dos Leads */}
        <div className="flex-1 min-w-0">
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {selectedLabel ? selectedLabel.labelTitle : 'Todas as Etiquetas'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedLabel 
                      ? `${selectedLabel.totalLeads} leads encontrados`
                      : `${stats.totalLeads} leads no total`
                    }
                  </p>
                </div>
                {selectedLabelId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLabelId(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedLabel && (
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone ou contato..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
              
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {selectedLabel ? (
                  filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => (
                      <div
                        key={lead.leadId}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        style={{ borderLeft: `4px solid ${selectedLabel.labelColor}` }}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                              {lead.leadName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{lead.leadName}</h4>
                                <p className="text-sm text-muted-foreground truncate">{lead.contactName}</p>
                                <p className="text-xs text-muted-foreground mt-1">{lead.leadPhone}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <Badge variant="outline" className="text-xs">
                                  {lead.leadStatus}
                                </Badge>
                                {lead.leadStage && (
                                  <Badge variant="secondary" className="text-xs">
                                    Etapa
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">Nenhum lead encontrado</p>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {report.map((label) => (
                      <div
                        key={label.labelId}
                        className="border rounded-lg p-4"
                        style={{ borderLeft: `4px solid ${label.labelColor}` }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded-full"
                              style={{ backgroundColor: label.labelColor }}
                            />
                            <h3 className="font-semibold">{label.labelTitle}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {label.totalConversations} conversas
                            </Badge>
                            <Badge variant="default" className="text-xs">
                              {label.totalLeads} leads
                            </Badge>
                          </div>
                        </div>
                        {label.leads.length > 0 ? (
                          <div className="space-y-2">
                            {label.leads.slice(0, 3).map((lead) => (
                              <div key={lead.leadId} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                    {lead.leadName.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{lead.leadName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{lead.leadPhone}</p>
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  {lead.leadStatus}
                                </Badge>
                              </div>
                            ))}
                            {label.leads.length > 3 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{label.leads.length - 3} leads adicionais
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhum lead associado
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
