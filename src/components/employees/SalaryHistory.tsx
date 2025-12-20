import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface SalaryHistoryItem {
  id: string;
  employee_id: string;
  salary: number;
  effective_date: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  position_name?: string;
}

interface SalaryHistoryProps {
  employeeId: string;
}

export function SalaryHistory({ employeeId }: SalaryHistoryProps) {
  const [history, setHistory] = useState<SalaryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newSalary, setNewSalary] = useState({
    salary: "",
    effective_date: "",
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
        `${SUPABASE_URL}/functions/v1/employee-history?employee_id=${employeeId}&type=salary`,
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
      console.error("Erro ao buscar histórico salarial:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao buscar histórico salarial",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSalary = async () => {
    if (!newSalary.salary || !newSalary.effective_date) {
      toast({
        title: "Erro",
        description: "Salário e data são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const salaryValue = parseFloat(newSalary.salary);
    if (salaryValue <= 0) {
      toast({
        title: "Erro",
        description: "Salário deve ser maior que zero",
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
            type: "salary",
            employee_id: employeeId,
            salary: salaryValue,
            effective_date: newSalary.effective_date,
            notes: newSalary.notes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao registrar salário");
      }

      toast({
        title: "Sucesso",
        description: "Salário registrado com sucesso",
      });

      setNewSalary({ salary: "", effective_date: "", notes: "" });
      setIsDialogOpen(false);
      fetchHistory();
    } catch (error: any) {
      console.error("Erro ao registrar salário:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao registrar salário",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchHistory();
    }
  }, [employeeId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Histórico Salarial</CardTitle>
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
            Nenhum registro de salário encontrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Efetiva</TableHead>
                  <TableHead>Salário</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Registrado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {new Date(item.effective_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(item.salary)}
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

      {/* Dialog para adicionar salário */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Salário</DialogTitle>
            <DialogDescription>
              Registre uma nova alteração salarial para este funcionário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="salary">
                Salário <span className="text-destructive">*</span>
              </Label>
              <Input
                id="salary"
                type="number"
                step="0.01"
                min="0"
                value={newSalary.salary}
                onChange={(e) => setNewSalary({ ...newSalary, salary: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="effective_date">
                Data Efetiva <span className="text-destructive">*</span>
              </Label>
              <Input
                id="effective_date"
                type="date"
                value={newSalary.effective_date}
                onChange={(e) => setNewSalary({ ...newSalary, effective_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={newSalary.notes}
                onChange={(e) => setNewSalary({ ...newSalary, notes: e.target.value })}
                placeholder="Observações sobre a alteração"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSalary}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

