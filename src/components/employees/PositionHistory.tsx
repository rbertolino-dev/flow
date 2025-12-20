import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePositions } from "@/hooks/usePositions";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface PositionHistoryItem {
  id: string;
  employee_id: string;
  position_id: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  position_name: string;
}

interface PositionHistoryProps {
  employeeId: string;
}

export function PositionHistory({ employeeId }: PositionHistoryProps) {
  const [history, setHistory] = useState<PositionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { positions } = usePositions();
  const { toast } = useToast();

  const [newPosition, setNewPosition] = useState({
    position_id: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  const fetchHistory = async () => {
    if (!employeeId) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-history?employee_id=${employeeId}&type=position`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao buscar histórico");
      }

      const result = await response.json();
      setHistory(result.data || []);
    } catch (error: any) {
      console.error("Erro ao buscar histórico de cargos:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar histórico de cargos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = async () => {
    if (!newPosition.position_id || !newPosition.start_date) {
      toast({
        title: "Erro",
        description: "Cargo e data de início são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/employee-history`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "position",
            employee_id: employeeId,
            position_id: newPosition.position_id,
            start_date: newPosition.start_date,
            end_date: newPosition.end_date || undefined,
            notes: newPosition.notes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao registrar cargo");
      }

      toast({
        title: "Sucesso",
        description: "Cargo registrado com sucesso",
      });

      setNewPosition({ position_id: "", start_date: "", end_date: "", notes: "" });
      setIsDialogOpen(false);
      fetchHistory();
    } catch (error: any) {
      console.error("Erro ao registrar cargo:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao registrar cargo",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchHistory();
    }
  }, [employeeId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Histórico de Cargos</CardTitle>
          <Button onClick={() => setIsDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum registro de cargo encontrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Data Início</TableHead>
                  <TableHead>Data Fim</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Registrado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.position_name}
                    </TableCell>
                    <TableCell>
                      {new Date(item.start_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {item.end_date
                        ? new Date(item.end_date).toLocaleDateString("pt-BR")
                        : "-"}
                    </TableCell>
                    <TableCell>{item.notes || "-"}</TableCell>
                    <TableCell>
                      {new Date(item.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog para adicionar cargo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Cargo</DialogTitle>
            <DialogDescription>
              Registre uma nova mudança de cargo para este funcionário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="position_id">
                Cargo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={newPosition.position_id}
                onValueChange={(value) => setNewPosition({ ...newPosition, position_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cargo" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start_date">
                Data de Início <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_date"
                type="date"
                value={newPosition.start_date}
                onChange={(e) => setNewPosition({ ...newPosition, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="end_date">Data de Fim</Label>
              <Input
                id="end_date"
                type="date"
                value={newPosition.end_date}
                onChange={(e) => setNewPosition({ ...newPosition, end_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={newPosition.notes}
                onChange={(e) => setNewPosition({ ...newPosition, notes: e.target.value })}
                placeholder="Observações sobre a mudança"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPosition}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

