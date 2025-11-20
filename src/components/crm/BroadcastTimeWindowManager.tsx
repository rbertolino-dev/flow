import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Save, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TimeWindow {
  id: string;
  organization_id: string;
  name: string;
  enabled: boolean;
  monday_start: string | null;
  monday_end: string | null;
  tuesday_start: string | null;
  tuesday_end: string | null;
  wednesday_start: string | null;
  wednesday_end: string | null;
  thursday_start: string | null;
  thursday_end: string | null;
  friday_start: string | null;
  friday_end: string | null;
  saturday_start: string | null;
  saturday_end: string | null;
  sunday_start: string | null;
  sunday_end: string | null;
  created_at: string;
  updated_at: string;
}

interface BroadcastTimeWindowManagerProps {
  organizationId: string;
}

const DAYS = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

export function BroadcastTimeWindowManager({ organizationId }: BroadcastTimeWindowManagerProps) {
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<TimeWindow | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    enabled: true,
    monday_start: "",
    monday_end: "",
    tuesday_start: "",
    tuesday_end: "",
    wednesday_start: "",
    wednesday_end: "",
    thursday_start: "",
    thursday_end: "",
    friday_start: "",
    friday_end: "",
    saturday_start: "",
    saturday_end: "",
    sunday_start: "",
    sunday_end: "",
  });

  useEffect(() => {
    if (organizationId) {
      fetchWindows();
    }
  }, [organizationId]);

  const fetchWindows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("broadcast_time_windows")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWindows(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar janelas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe um nome para a janela de horário",
        variant: "destructive",
      });
      return;
    }

    try {
      const windowData: any = {
        organization_id: organizationId,
        name: formData.name.trim(),
        enabled: formData.enabled,
      };

      // Adicionar horários apenas se preenchidos
      DAYS.forEach(day => {
        const startKey = `${day.key}_start` as keyof typeof formData;
        const endKey = `${day.key}_end` as keyof typeof formData;
        
        if (formData[startKey] && formData[endKey]) {
          windowData[startKey] = formData[startKey];
          windowData[endKey] = formData[endKey];
        } else {
          windowData[startKey] = null;
          windowData[endKey] = null;
        }
      });

      if (editingWindow) {
        const { error } = await supabase
          .from("broadcast_time_windows")
          .update(windowData)
          .eq("id", editingWindow.id);

        if (error) throw error;

        toast({
          title: "Janela atualizada!",
          description: `A janela "${formData.name}" foi atualizada com sucesso`,
        });
      } else {
        const { error } = await supabase
          .from("broadcast_time_windows")
          .insert(windowData);

        if (error) throw error;

        toast({
          title: "Janela criada!",
          description: `A janela "${formData.name}" foi criada com sucesso`,
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchWindows();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar janela",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta janela de horário?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("broadcast_time_windows")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Janela excluída",
        description: "A janela de horário foi excluída com sucesso",
      });

      fetchWindows();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir janela",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (window: TimeWindow) => {
    setEditingWindow(window);
    setFormData({
      name: window.name,
      enabled: window.enabled,
      monday_start: window.monday_start || "",
      monday_end: window.monday_end || "",
      tuesday_start: window.tuesday_start || "",
      tuesday_end: window.tuesday_end || "",
      wednesday_start: window.wednesday_start || "",
      wednesday_end: window.wednesday_end || "",
      thursday_start: window.thursday_start || "",
      thursday_end: window.thursday_end || "",
      friday_start: window.friday_start || "",
      friday_end: window.friday_end || "",
      saturday_start: window.saturday_start || "",
      saturday_end: window.saturday_end || "",
      sunday_start: window.sunday_start || "",
      sunday_end: window.sunday_end || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingWindow(null);
    setFormData({
      name: "",
      enabled: true,
      monday_start: "",
      monday_end: "",
      tuesday_start: "",
      tuesday_end: "",
      wednesday_start: "",
      wednesday_end: "",
      thursday_start: "",
      thursday_end: "",
      friday_start: "",
      friday_end: "",
      saturday_start: "",
      saturday_end: "",
      sunday_start: "",
      sunday_end: "",
    });
  };

  const formatTimeWindow = (window: TimeWindow, dayKey: string) => {
    const start = window[`${dayKey}_start` as keyof TimeWindow] as string | null;
    const end = window[`${dayKey}_end` as keyof TimeWindow] as string | null;
    
    if (!start || !end) return "Não configurado";
    return `${start.substring(0, 5)} - ${end.substring(0, 5)}`;
  };

  const activeWindow = windows.find(w => w.enabled);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Janelas de Horário de Envio
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Janela
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingWindow ? "Editar Janela" : "Nova Janela de Horário"}
                </DialogTitle>
                <DialogDescription>
                  Configure os horários permitidos para envio de mensagens em massa
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Janela *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Horário Comercial"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Ativar esta janela</Label>
                  <Switch
                    id="enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-semibold">Horários por Dia da Semana</Label>
                  {DAYS.map((day) => (
                    <div key={day.key} className="grid grid-cols-3 gap-3 items-center p-3 border rounded-lg">
                      <Label className="font-medium">{day.label}</Label>
                      <div className="space-y-1">
                        <Label htmlFor={`${day.key}_start`} className="text-xs text-muted-foreground">
                          Início
                        </Label>
                        <Input
                          id={`${day.key}_start`}
                          type="time"
                          value={formData[`${day.key}_start` as keyof typeof formData] as string}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [`${day.key}_start`]: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${day.key}_end`} className="text-xs text-muted-foreground">
                          Fim
                        </Label>
                        <Input
                          id={`${day.key}_end`}
                          type="time"
                          value={formData[`${day.key}_end` as keyof typeof formData] as string}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              [`${day.key}_end`]: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 <strong>Dica:</strong> Deixe os campos vazios para desabilitar o envio naquele dia. 
                    Os horários são verificados automaticamente ao criar e iniciar campanhas.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : windows.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma janela de horário configurada. Crie uma para limitar os horários de envio.
          </div>
        ) : (
          <div className="space-y-4">
            {windows.map((window) => (
              <Card key={window.id} className={window.enabled ? "border-primary" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{window.name}</h3>
                        {window.enabled ? (
                          <Badge variant="default">Ativa</Badge>
                        ) : (
                          <Badge variant="secondary">Inativa</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {DAYS.map((day) => {
                          const timeWindow = formatTimeWindow(window, day.key);
                          return (
                            <div key={day.key} className="flex items-center gap-2">
                              <span className="text-muted-foreground w-12">{day.short}:</span>
                              <span className={timeWindow === "Não configurado" ? "text-muted-foreground" : ""}>
                                {timeWindow}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(window)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(window.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {activeWindow && (
              <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary mb-1">
                  ⚠️ Janela Ativa: {activeWindow.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  As campanhas serão bloqueadas se tentarem enviar fora dos horários configurados.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

