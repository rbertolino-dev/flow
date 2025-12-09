import { useState } from "react";
import { useSellerGoals, SellerGoal } from "@/hooks/useSellerGoals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Target, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SellerGoalsManagement() {
  const { organizationId } = useAuth();
  const { goals, isLoading, createGoal, updateGoal, deleteGoal } = useSellerGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SellerGoal | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    period_start: "",
    period_end: "",
    goal_type: "revenue" as 'revenue' | 'deals' | 'leads',
    target_value: 0,
    current_value: 0,
    status: "in_progress" as 'in_progress' | 'achieved' | 'missed',
    notes: "",
  });

  // Buscar membros da organização
  const { data: members = [] } = useQuery({
    queryKey: ['org-members', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          profiles!organization_members_user_id_fkey(id, full_name, email)
        `)
        .eq('organization_id', organizationId);
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });

  const handleOpenDialog = (goal?: SellerGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        user_id: goal.user_id,
        period_start: goal.period_start,
        period_end: goal.period_end,
        goal_type: goal.goal_type,
        target_value: goal.target_value,
        current_value: goal.current_value,
        status: goal.status,
        notes: goal.notes || "",
      });
    } else {
      setEditingGoal(null);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormData({
        user_id: "",
        period_start: startOfMonth.toISOString().split('T')[0],
        period_end: endOfMonth.toISOString().split('T')[0],
        goal_type: "revenue",
        target_value: 0,
        current_value: 0,
        status: "in_progress",
        notes: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.user_id || !formData.target_value) {
      toast.error("Vendedor e meta são obrigatórios");
      return;
    }

    try {
      if (editingGoal) {
        await updateGoal.mutateAsync({ id: editingGoal.id, ...formData });
      } else {
        await createGoal.mutateAsync(formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta meta?")) {
      await deleteGoal.mutateAsync(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case 'revenue': return 'Faturamento';
      case 'deals': return 'Negócios';
      case 'leads': return 'Leads';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'achieved': return <Badge className="bg-green-500">Atingida</Badge>;
      case 'missed': return <Badge variant="destructive">Não atingida</Badge>;
      default: return <Badge variant="secondary">Em progresso</Badge>;
    }
  };

  const getProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min((current / target) * 100, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Metas de Vendedores</h2>
          <p className="text-muted-foreground">Defina e acompanhe metas individuais</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Metas Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {goals.filter(g => g.status === 'in_progress').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Metas Atingidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {goals.filter(g => g.status === 'achieved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {goals.length > 0 
                ? ((goals.filter(g => g.status === 'achieved').length / goals.length) * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : goals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma meta cadastrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">
                      {goal.user?.full_name || goal.user?.email || 'N/A'}
                    </TableCell>
                    <TableCell>{getGoalTypeLabel(goal.goal_type)}</TableCell>
                    <TableCell>
                      {format(new Date(goal.period_start), "dd/MM", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{goal.goal_type === 'revenue' ? formatCurrency(goal.current_value) : goal.current_value}</span>
                          <span className="text-muted-foreground">
                            {goal.goal_type === 'revenue' ? formatCurrency(goal.target_value) : goal.target_value}
                          </span>
                        </div>
                        <Progress value={getProgress(goal.current_value, goal.target_value)} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(goal.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(goal)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Editar Meta" : "Nova Meta"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Vendedor *</Label>
              <Select value={formData.user_id} onValueChange={(v) => setFormData({ ...formData, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || m.profiles?.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início do Período</Label>
                <Input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim do Período</Label>
                <Input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Meta</Label>
                <Select value={formData.goal_type} onValueChange={(v: any) => setFormData({ ...formData, goal_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Faturamento (R$)</SelectItem>
                    <SelectItem value="deals">Negócios Fechados</SelectItem>
                    <SelectItem value="leads">Leads Convertidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor da Meta *</Label>
                <Input
                  type="number"
                  step={formData.goal_type === 'revenue' ? "0.01" : "1"}
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            {editingGoal && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor Atual</Label>
                  <Input
                    type="number"
                    step={formData.goal_type === 'revenue' ? "0.01" : "1"}
                    value={formData.current_value}
                    onChange={(e) => setFormData({ ...formData, current_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                      <SelectItem value="achieved">Atingida</SelectItem>
                      <SelectItem value="missed">Não Atingida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createGoal.isPending || updateGoal.isPending}>
              {editingGoal ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
