import { useState } from "react";
import { useSellerGoals, SellerGoal, SellerGoalFormData } from "@/hooks/useSellerGoals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrganization } from "@/hooks/useActiveOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SellerGoalsManagement() {
  const { activeOrgId } = useActiveOrganization();
  const { goals, loading, createGoal, updateGoal, deleteGoal } = useSellerGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SellerGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SellerGoalFormData>({
    user_id: "",
    period_type: "monthly",
    period_start: "",
    period_end: "",
    target_leads: 0,
    target_value: 0,
    target_commission: 0,
  });

  // Buscar membros da organização
  const { data: members = [] } = useQuery({
    queryKey: ['org-members', activeOrgId],
    queryFn: async () => {
      if (!activeOrgId) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', activeOrgId);
      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      if (profilesError) throw profilesError;
      
      return data.map(m => ({
        user_id: m.user_id,
        profile: profiles?.find(p => p.id === m.user_id)
      }));
    },
    enabled: !!activeOrgId,
  });

  const handleOpenDialog = (goal?: SellerGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        user_id: goal.user_id,
        period_type: goal.period_type,
        period_start: goal.period_start,
        period_end: goal.period_end,
        target_leads: goal.target_leads,
        target_value: goal.target_value,
        target_commission: goal.target_commission,
      });
    } else {
      setEditingGoal(null);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormData({
        user_id: "",
        period_type: "monthly",
        period_start: startOfMonth.toISOString().split('T')[0],
        period_end: endOfMonth.toISOString().split('T')[0],
        target_leads: 0,
        target_value: 0,
        target_commission: 0,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.user_id || !formData.target_value) {
      toast.error("Vendedor e meta de valor são obrigatórios");
      return;
    }

    try {
      setSaving(true);
      if (editingGoal) {
        await updateGoal(editingGoal.id, formData);
      } else {
        await createGoal(formData);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta meta?")) {
      await deleteGoal(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getPeriodTypeLabel = (type: string) => {
    switch (type) {
      case 'monthly': return 'Mensal';
      case 'weekly': return 'Semanal';
      case 'quarterly': return 'Trimestral';
      case 'yearly': return 'Anual';
      default: return type;
    }
  };

  const getMemberName = (userId: string) => {
    const member = members.find((m: any) => m.user_id === userId);
    return member?.profile?.full_name || member?.profile?.email || 'N/A';
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Metas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {goals.reduce((acc, g) => acc + g.target_leads, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Meta Total Valor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(goals.reduce((acc, g) => acc + g.target_value, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
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
                  <TableHead>Meta Leads</TableHead>
                  <TableHead>Meta Valor</TableHead>
                  <TableHead>Meta Comissão</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => (
                  <TableRow key={goal.id}>
                    <TableCell className="font-medium">
                      {getMemberName(goal.user_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getPeriodTypeLabel(goal.period_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(goal.period_start), "dd/MM", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{goal.target_leads}</TableCell>
                    <TableCell>{formatCurrency(goal.target_value)}</TableCell>
                    <TableCell>{formatCurrency(goal.target_commission)}</TableCell>
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
                      {m.profile?.full_name || m.profile?.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Período</Label>
              <Select value={formData.period_type} onValueChange={(v: any) => setFormData({ ...formData, period_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
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
            <div className="space-y-2">
              <Label>Meta de Leads</Label>
              <Input
                type="number"
                value={formData.target_leads}
                onChange={(e) => setFormData({ ...formData, target_leads: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta de Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.target_value}
                onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta de Comissão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.target_commission}
                onChange={(e) => setFormData({ ...formData, target_commission: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : (editingGoal ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
