import { useState, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Target, Calendar, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export function SellerGoalsManagement() {
  const { activeOrgId } = useActiveOrganization();
  const { goals, loading, createGoal, updateGoal, deleteGoal, refetch } = useSellerGoals();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SellerGoal | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedPeriodType, setSelectedPeriodType] = useState<string>("all");
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
        // Ao editar, não enviar user_id (não pode mudar o vendedor da meta)
        const { user_id, ...updateData } = formData;
        await updateGoal(editingGoal.id, updateData);
        toast.success("Meta atualizada com sucesso!");
      } else {
        await createGoal(formData);
        toast.success("Meta criada com sucesso!");
      }
      setIsDialogOpen(false);
      // Resetar formulário
      setFormData({
        user_id: "",
        period_type: "monthly",
        period_start: "",
        period_end: "",
        target_leads: 0,
        target_value: 0,
        target_commission: 0,
      });
      setEditingGoal(null);
      // Forçar atualização da lista
      await refetch();
    } catch (error) {
      console.error(error);
      // Erro já é tratado no hook, mas podemos adicionar feedback adicional se necessário
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

  // Agrupar metas por período
  const goalsByPeriod = useMemo(() => {
    const grouped: Record<string, SellerGoal[]> = {
      monthly: [],
      weekly: [],
      quarterly: [],
      yearly: [],
    };

    goals.forEach((goal) => {
      if (goal.period_type && grouped[goal.period_type]) {
        grouped[goal.period_type].push(goal);
      }
    });

    return grouped;
  }, [goals]);

  // Filtrar metas por período selecionado
  const filteredGoals = useMemo(() => {
    if (selectedPeriodType === "all") {
      return goals;
    }
    return goals.filter((goal) => goal.period_type === selectedPeriodType);
  }, [goals, selectedPeriodType]);

  // Estatísticas por período
  const periodStats = useMemo(() => {
    return {
      monthly: {
        count: goalsByPeriod.monthly.length,
        totalLeads: goalsByPeriod.monthly.reduce((acc, g) => acc + g.target_leads, 0),
        totalValue: goalsByPeriod.monthly.reduce((acc, g) => acc + g.target_value, 0),
      },
      weekly: {
        count: goalsByPeriod.weekly.length,
        totalLeads: goalsByPeriod.weekly.reduce((acc, g) => acc + g.target_leads, 0),
        totalValue: goalsByPeriod.weekly.reduce((acc, g) => acc + g.target_value, 0),
      },
      quarterly: {
        count: goalsByPeriod.quarterly.length,
        totalLeads: goalsByPeriod.quarterly.reduce((acc, g) => acc + g.target_leads, 0),
        totalValue: goalsByPeriod.quarterly.reduce((acc, g) => acc + g.target_value, 0),
      },
      yearly: {
        count: goalsByPeriod.yearly.length,
        totalLeads: goalsByPeriod.yearly.reduce((acc, g) => acc + g.target_leads, 0),
        totalValue: goalsByPeriod.yearly.reduce((acc, g) => acc + g.target_value, 0),
      },
    };
  }, [goalsByPeriod]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Metas</h2>
          <p className="text-muted-foreground">Defina e edite metas por período para cada vendedor</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Total de Metas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{goals.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Meta Total Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {goals.reduce((acc, g) => acc + g.target_leads, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Meta Total Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(goals.reduce((acc, g) => acc + g.target_value, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas por Período */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Metas Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{periodStats.monthly.count}</div>
            <div className="text-xs text-muted-foreground">
              {periodStats.monthly.totalLeads} leads • {formatCurrency(periodStats.monthly.totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Metas Semanais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{periodStats.weekly.count}</div>
            <div className="text-xs text-muted-foreground">
              {periodStats.weekly.totalLeads} leads • {formatCurrency(periodStats.weekly.totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Metas Trimestrais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{periodStats.quarterly.count}</div>
            <div className="text-xs text-muted-foreground">
              {periodStats.quarterly.totalLeads} leads • {formatCurrency(periodStats.quarterly.totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Metas Anuais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{periodStats.yearly.count}</div>
            <div className="text-xs text-muted-foreground">
              {periodStats.yearly.totalLeads} leads • {formatCurrency(periodStats.yearly.totalValue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro por Período */}
      <div className="flex items-center gap-4">
        <Label htmlFor="period-filter" className="text-sm font-medium">Filtrar por Período:</Label>
        <Select value={selectedPeriodType} onValueChange={setSelectedPeriodType}>
          <SelectTrigger id="period-filter" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Períodos</SelectItem>
            <SelectItem value="monthly">Mensais</SelectItem>
            <SelectItem value="weekly">Semanais</SelectItem>
            <SelectItem value="quarterly">Trimestrais</SelectItem>
            <SelectItem value="yearly">Anuais</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs por Período para Gestão */}
      <Tabs defaultValue="all" value={selectedPeriodType} onValueChange={setSelectedPeriodType} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="monthly">Mensais ({periodStats.monthly.count})</TabsTrigger>
          <TabsTrigger value="weekly">Semanais ({periodStats.weekly.count})</TabsTrigger>
          <TabsTrigger value="quarterly">Trimestrais ({periodStats.quarterly.count})</TabsTrigger>
          <TabsTrigger value="yearly">Anuais ({periodStats.yearly.count})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : goals.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma meta cadastrada</p>
                  <Button onClick={() => handleOpenDialog()} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Meta
                  </Button>
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
                      <TableHead className="w-[150px] text-right">Ações</TableHead>
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
                        <TableCell className="w-[150px]">
                          <div className="flex gap-2 items-center justify-end">
                            <Button 
                              variant="default" 
                              size="sm" 
                              onClick={() => handleOpenDialog(goal)} 
                              title="Editar meta"
                              className="h-8 px-3"
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Editar
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => handleDelete(goal.id)} 
                              title="Excluir meta"
                              className="h-8 px-3"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
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
        </TabsContent>

        {(['monthly', 'weekly', 'quarterly', 'yearly'] as const).map((periodType) => (
          <TabsContent key={periodType} value={periodType} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Metas {getPeriodTypeLabel(periodType)}s
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 overflow-x-auto">
                {goalsByPeriod[periodType].length === 0 ? (
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Nenhuma meta {getPeriodTypeLabel(periodType).toLowerCase()} cadastrada</p>
                    <Button onClick={() => {
                      const now = new Date();
                      let start: Date, end: Date;
                      switch (periodType) {
                        case 'monthly':
                          start = new Date(now.getFullYear(), now.getMonth(), 1);
                          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                          break;
                        case 'weekly':
                          const dayOfWeek = now.getDay();
                          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                          const weekStart = new Date(now);
                          weekStart.setDate(diff);
                          weekStart.setHours(0, 0, 0, 0);
                          start = weekStart;
                          const weekEnd = new Date(weekStart);
                          weekEnd.setDate(weekStart.getDate() + 6);
                          weekEnd.setHours(23, 59, 59, 999);
                          end = weekEnd;
                          break;
                        case 'quarterly':
                          const quarter = Math.floor(now.getMonth() / 3);
                          start = new Date(now.getFullYear(), quarter * 3, 1);
                          end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
                          end.setHours(23, 59, 59, 999);
                          break;
                        case 'yearly':
                          start = new Date(now.getFullYear(), 0, 1);
                          end = new Date(now.getFullYear(), 11, 31);
                          end.setHours(23, 59, 59, 999);
                          break;
                        default:
                          start = new Date(now.getFullYear(), now.getMonth(), 1);
                          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      }
                      setFormData({
                        user_id: "",
                        period_type: periodType,
                        period_start: start.toISOString().split('T')[0],
                        period_end: end.toISOString().split('T')[0],
                        target_leads: 0,
                        target_value: 0,
                        target_commission: 0,
                      });
                      setIsDialogOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Meta {getPeriodTypeLabel(periodType)}
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Meta Leads</TableHead>
                        <TableHead>Meta Valor</TableHead>
                        <TableHead>Meta Comissão</TableHead>
                        <TableHead className="w-[150px] text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {goalsByPeriod[periodType]
                        .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime())
                        .map((goal) => (
                        <TableRow key={goal.id}>
                          <TableCell className="font-medium">
                            {getMemberName(goal.user_id)}
                          </TableCell>
                          <TableCell>
                            {format(new Date(goal.period_start), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{goal.target_leads}</TableCell>
                          <TableCell>{formatCurrency(goal.target_value)}</TableCell>
                          <TableCell>{formatCurrency(goal.target_commission)}</TableCell>
                          <TableCell className="w-[150px]">
                            <div className="flex gap-2 items-center justify-end">
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleOpenDialog(goal)} 
                                title="Editar meta"
                                className="h-8 px-3"
                              >
                                <Pencil className="h-4 w-4 mr-1" />
                                Editar
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => handleDelete(goal.id)} 
                                title="Excluir meta"
                                className="h-8 px-3"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
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
          </TabsContent>
        ))}
      </Tabs>

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
              <Select 
                value={formData.period_type} 
                onValueChange={(v: any) => {
                  // Calcular datas automaticamente quando mudar o tipo
                  const now = new Date();
                  let start: Date, end: Date;
                  
                  switch (v) {
                    case 'monthly':
                      start = new Date(now.getFullYear(), now.getMonth(), 1);
                      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      break;
                    case 'weekly':
                      const dayOfWeek = now.getDay();
                      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                      const weekStart = new Date(now);
                      weekStart.setDate(diff);
                      weekStart.setHours(0, 0, 0, 0);
                      start = weekStart;
                      const weekEnd = new Date(weekStart);
                      weekEnd.setDate(weekStart.getDate() + 6);
                      weekEnd.setHours(23, 59, 59, 999);
                      end = weekEnd;
                      break;
                    case 'quarterly':
                      const quarter = Math.floor(now.getMonth() / 3);
                      start = new Date(now.getFullYear(), quarter * 3, 1);
                      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
                      end.setHours(23, 59, 59, 999);
                      break;
                    case 'yearly':
                      start = new Date(now.getFullYear(), 0, 1);
                      end = new Date(now.getFullYear(), 11, 31);
                      end.setHours(23, 59, 59, 999);
                      break;
                    default:
                      start = new Date(now.getFullYear(), now.getMonth(), 1);
                      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  }
                  
                  setFormData({ 
                    ...formData, 
                    period_type: v,
                    period_start: format(start, "yyyy-MM-dd"),
                    period_end: format(end, "yyyy-MM-dd"),
                  });
                }}
              >
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
            
            {/* Seletor de Período Específico */}
            {formData.period_type === 'monthly' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mês</Label>
                  <Select 
                    value={formData.period_start ? new Date(formData.period_start).getMonth().toString() : new Date().getMonth().toString()}
                    onValueChange={(month) => {
                      const year = formData.period_start ? new Date(formData.period_start).getFullYear() : new Date().getFullYear();
                      const start = new Date(year, parseInt(month), 1);
                      const end = new Date(year, parseInt(month) + 1, 0);
                      setFormData({
                        ...formData,
                        period_start: format(start, "yyyy-MM-dd"),
                        period_end: format(end, "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select 
                    value={new Date(formData.period_start || new Date()).getFullYear().toString()}
                    onValueChange={(year) => {
                      const month = new Date(formData.period_start || new Date()).getMonth();
                      const start = new Date(parseInt(year), month, 1);
                      const end = new Date(parseInt(year), month + 1, 0);
                      setFormData({
                        ...formData,
                        period_start: format(start, "yyyy-MM-dd"),
                        period_end: format(end, "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.period_type === 'quarterly' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trimestre</Label>
                  <Select 
                    value={Math.floor(new Date(formData.period_start || new Date()).getMonth() / 3).toString()}
                    onValueChange={(quarter) => {
                      const year = new Date(formData.period_start || new Date()).getFullYear();
                      const start = new Date(year, parseInt(quarter) * 3, 1);
                      const end = new Date(year, (parseInt(quarter) + 1) * 3, 0);
                      end.setHours(23, 59, 59, 999);
                      setFormData({
                        ...formData,
                        period_start: format(start, "yyyy-MM-dd"),
                        period_end: format(end, "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">1º Trimestre</SelectItem>
                      <SelectItem value="1">2º Trimestre</SelectItem>
                      <SelectItem value="2">3º Trimestre</SelectItem>
                      <SelectItem value="3">4º Trimestre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ano</Label>
                  <Select 
                    value={new Date(formData.period_start || new Date()).getFullYear().toString()}
                    onValueChange={(year) => {
                      const quarter = Math.floor(new Date(formData.period_start || new Date()).getMonth() / 3);
                      const start = new Date(parseInt(year), quarter * 3, 1);
                      const end = new Date(parseInt(year), (quarter + 1) * 3, 0);
                      end.setHours(23, 59, 59, 999);
                      setFormData({
                        ...formData,
                        period_start: format(start, "yyyy-MM-dd"),
                        period_end: format(end, "yyyy-MM-dd"),
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, i) => {
                        const year = new Date().getFullYear() - 2 + i;
                        return (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            
            {formData.period_type === 'yearly' && (
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select 
                  value={new Date(formData.period_start || new Date()).getFullYear().toString()}
                  onValueChange={(year) => {
                    const start = new Date(parseInt(year), 0, 1);
                    const end = new Date(parseInt(year), 11, 31);
                    end.setHours(23, 59, 59, 999);
                    setFormData({
                      ...formData,
                      period_start: format(start, "yyyy-MM-dd"),
                      period_end: format(end, "yyyy-MM-dd"),
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {formData.period_type === 'weekly' && (
              <div className="space-y-2">
                <Label>Semana (edite manualmente as datas abaixo)</Label>
                <p className="text-xs text-muted-foreground">
                  Para semanas específicas, ajuste as datas de início e fim manualmente
                </p>
              </div>
            )}
            
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
