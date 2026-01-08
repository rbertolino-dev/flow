import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function UserAvailabilitySettings() {
  const { activeOrgId } = useActiveOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    if (activeOrgId) {
      loadAvailability();
    }
  }, [activeOrgId]);

  const loadAvailability = async () => {
    if (!activeOrgId) return;

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_availability_slots')
        .select('*')
        .eq('organization_id', activeOrgId)
        .eq('user_id', user.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      setSlots((data || []) as AvailabilitySlot[]);
    } catch (error: any) {
      console.error('Erro ao carregar disponibilidade:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar horários disponíveis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addSlot = () => {
    setSlots([...slots, {
      day_of_week: 1,
      start_time: '09:00:00',
      end_time: '18:00:00',
      is_active: true,
    }]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof AvailabilitySlot, value: any) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const handleSave = async () => {
    if (!activeOrgId) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Deletar slots existentes
      const { error: deleteError } = await supabase
        .from('user_availability_slots')
        .delete()
        .eq('organization_id', activeOrgId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Inserir novos slots
      if (slots.length > 0) {
        const slotsToInsert = slots
          .filter(slot => slot.is_active)
          .map(slot => ({
            organization_id: activeOrgId,
            user_id: user.id,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: true,
          }));

        if (slotsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('user_availability_slots')
            .insert(slotsToInsert);

          if (insertError) throw insertError;
        }
      }

      toast({
        title: "Salvo!",
        description: "Horários disponíveis atualizados com sucesso",
      });

      await loadAvailability();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar horários disponíveis",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Meus Horários Disponíveis
        </CardTitle>
        <CardDescription>
          Configure os horários em que você está disponível para receber agendamentos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {slots.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhum horário configurado. Adicione seus horários disponíveis.</p>
            </div>
          )}

          {slots.map((slot, index) => (
            <Card key={index} className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Dia da Semana</Label>
                  <Select
                    value={String(slot.day_of_week)}
                    onValueChange={(value) => updateSlot(index, 'day_of_week', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input
                    type="time"
                    value={slot.start_time.slice(0, 5)}
                    onChange={(e) => updateSlot(index, 'start_time', `${e.target.value}:00`)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={slot.end_time.slice(0, 5)}
                    onChange={(e) => updateSlot(index, 'end_time', `${e.target.value}:00`)}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`active-${index}`}
                    checked={slot.is_active}
                    onCheckedChange={(checked) => updateSlot(index, 'is_active', checked)}
                  />
                  <Label htmlFor={`active-${index}`} className="cursor-pointer">
                    Ativo
                  </Label>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlot(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={addSlot} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Horário
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Horários"
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

