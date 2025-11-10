import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { RotateCcw, Search, Calendar, Phone, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ArchivedLeadsPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: archivedLeads, isLoading } = useQuery({
    queryKey: ["archived-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          stage:pipeline_stages(name, color),
          activities(id, created_at)
        `)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const restoreLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ 
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead restaurado com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao restaurar lead:", error);
      toast.error("Erro ao restaurar lead");
    },
  });

  const filteredLeads = archivedLeads?.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Leads Arquivados
        </CardTitle>
        <CardDescription>
          Restaure leads que foram excluídos anteriormente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando leads arquivados...
          </div>
        ) : !filteredLeads?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery
              ? "Nenhum lead encontrado"
              : "Nenhum lead arquivado"}
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <Card key={lead.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{lead.name}</h3>
                        {lead.stage && (
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: lead.stage.color,
                              color: lead.stage.color,
                            }}
                          >
                            {lead.stage.name}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.company && (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3" />
                            <span>{lead.company}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          <span>
                            Arquivado em{" "}
                            {format(new Date(lead.deleted_at), "dd/MM/yyyy 'às' HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {lead.activities && lead.activities.length > 0 && (
                          <div className="text-xs">
                            {lead.activities.length} atividade(s) registrada(s)
                          </div>
                        )}
                      </div>

                      {lead.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {lead.notes}
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => restoreLead.mutate(lead.id)}
                      disabled={restoreLead.isPending}
                      className="shrink-0"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restaurar
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {filteredLeads && filteredLeads.length > 0 && (
          <div className="text-sm text-muted-foreground text-center pt-2 border-t">
            {filteredLeads.length} lead(s) arquivado(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
