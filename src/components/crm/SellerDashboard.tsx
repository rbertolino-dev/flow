import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOrganizationUsers } from "@/hooks/useOrganizationUsers";
// Tabs não utilizado, removido
import { useSellerPerformanceMetrics } from "@/hooks/useSellerPerformanceMetrics";
import { useSellerGoals } from "@/hooks/useSellerGoals";
import { useProducts } from "@/hooks/useProducts";
import { useLeads } from "@/hooks/useLeads";
import { Lead } from "@/types/lead";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target,
  DollarSign,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SellerGoalFormData } from "@/types/product";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SellerDashboard() {
  const { leads } = useLeads();
  const { products } = useProducts();
  const { goals, loading: goalsLoading, createGoal, updateGoal, deleteGoal, getCurrentGoal, refetch: refetchGoals } = useSellerGoals();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [periodType, setPeriodType] = useState<'monthly' | 'weekly' | 'quarterly' | 'yearly'>('monthly');
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchCurrentUser();
  }, []);

  const metrics = useSellerPerformanceMetrics({
    leads,
    products,
    goals,
    sellerId: currentUserId || undefined,
    periodType,
  });

  const currentMetric = metrics.find((m) => m.sellerId === currentUserId) || metrics[0];
  // Buscar meta atual usando getCurrentGoal também (fallback)
  const currentGoalFromHook = currentUserId ? getCurrentGoal(currentUserId, periodType) : null;
  const currentGoal = currentMetric?.currentGoal || currentGoalFromHook;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleCreateOrUpdateGoal = async (goalData: SellerGoalFormData) => {
    try {
      if (editingGoal) {
        // Ao editar, não enviar user_id (não pode mudar o vendedor da meta)
        const { user_id, ...updateData } = goalData;
        await updateGoal(editingGoal.id, updateData);
      } else {
        await createGoal({
          ...goalData,
          user_id: currentUserId!,
        });
      }
      // Forçar atualização das metas
      await refetchGoals();
      // Forçar atualização das metas
      await refetchGoals();
      setGoalDialogOpen(false);
      setEditingGoal(null);
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  const handleEditGoal = () => {
    if (currentGoal) {
      setEditingGoal(currentGoal);
      setGoalDialogOpen(true);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await deleteGoal(goalId);
      await refetchGoals();
      toast({
        title: "Meta excluída",
        description: "A meta foi excluída com sucesso.",
      });
    } catch (error) {
      // Erro já tratado no hook
    }
  };

  if (!currentUserId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Carregando informações do vendedor...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentMetric) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado de performance disponível</p>
            <p className="text-sm mt-2">
              Você ainda não possui leads atribuídos ou vendas registradas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressData = [
    {
      name: "Leads",
      meta: currentGoal?.target_leads || 0,
      realizado: currentMetric.actualLeads,
      progress: currentMetric.leadsProgress,
    },
    {
      name: "Valor",
      meta: currentGoal?.target_value || 0,
      realizado: currentMetric.actualValue,
      progress: currentMetric.valueProgress,
    },
    {
      name: "Comissão",
      meta: currentGoal?.target_commission || 0,
      realizado: currentMetric.actualCommission,
      progress: currentMetric.commissionProgress,
    },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meu Painel de Vendas</h2>
          <p className="text-muted-foreground">
            Acompanhe suas metas e comissões em tempo real
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={periodType} onValueChange={(v: any) => setPeriodType(v)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => {
                setEditingGoal(null);
                setGoalDialogOpen(true);
              }}>
                <Target className="h-4 w-4 mr-2" />
                {currentGoal ? "Editar Meta" : "Definir Meta"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGoal ? "Editar Meta" : "Nova Meta"}
                </DialogTitle>
                <DialogDescription>
                  Defina suas metas de vendas para o período selecionado
                </DialogDescription>
              </DialogHeader>
              <GoalForm
                goal={editingGoal || currentGoal}
                periodType={periodType}
                onSubmit={handleCreateOrUpdateGoal}
                onCancel={() => {
                  setGoalDialogOpen(false);
                  setEditingGoal(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Meta de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMetric.actualLeads} / {currentGoal?.target_leads || 0}
            </div>
            <Progress
              value={Math.min(currentMetric.leadsProgress, 100)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetric.leadsProgress.toFixed(1)}% concluído
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Meta de Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(currentMetric.actualValue)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Meta: {formatCurrency(currentGoal?.target_value || 0)}
            </div>
            <Progress
              value={Math.min(currentMetric.valueProgress, 100)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetric.valueProgress.toFixed(1)}% concluído
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Comissão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(currentMetric.actualCommission)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Meta: {formatCurrency(currentGoal?.target_commission || 0)}
            </div>
            <Progress
              value={Math.min(currentMetric.commissionProgress, 100)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetric.commissionProgress.toFixed(1)}% concluído
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentMetric.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentMetric.wonLeads} ganhos de {currentMetric.totalLeads} leads
            </p>
            <div className="mt-2">
              <Badge
                variant={
                  currentMetric.conversionRate >= 30
                    ? "default"
                    : currentMetric.conversionRate >= 15
                    ? "secondary"
                    : "outline"
                }
              >
                {currentMetric.conversionRate >= 30
                  ? "Excelente"
                  : currentMetric.conversionRate >= 15
                  ? "Bom"
                  : "Melhorar"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Progresso vs Meta</CardTitle>
            <CardDescription>Comparação entre realizado e meta</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => {
                    if (typeof value === 'number') {
                      return value.toLocaleString('pt-BR');
                    }
                    return value;
                  }}
                />
                <Legend />
                <Bar dataKey="meta" fill="#8884d8" name="Meta" />
                <Bar dataKey="realizado" fill="#82ca9d" name="Realizado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status das Metas</CardTitle>
            <CardDescription>Percentual de conclusão de cada meta</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={progressData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, progress }) => `${name}: ${progress.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="progress"
                >
                  {progressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Informações da Meta Atual */}
      {currentGoal && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Meta Atual</CardTitle>
                <CardDescription>
                  Período: {format(new Date(currentGoal.period_start), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                  {format(new Date(currentGoal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleEditGoal}>
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => currentGoal && handleDeleteGoal(currentGoal.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Meta de Leads</Label>
                <div className="text-2xl font-bold mt-1">{currentGoal.target_leads}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Realizado: {currentMetric.actualLeads}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Meta de Valor</Label>
                <div className="text-2xl font-bold mt-1">
                  {formatCurrency(currentGoal.target_value)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Realizado: {formatCurrency(currentMetric.actualValue)}
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Meta de Comissão</Label>
                <div className="text-2xl font-bold mt-1 text-primary">
                  {formatCurrency(currentGoal.target_commission)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Realizado: {formatCurrency(currentMetric.actualCommission)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!currentGoal && (
        <Card>
          <CardContent className="p-6 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-4">
              Você ainda não possui uma meta definida para este período ({periodType === 'monthly' ? 'mensal' : periodType === 'weekly' ? 'semanal' : periodType === 'quarterly' ? 'trimestral' : 'anual'}).
            </p>
            <Button onClick={() => {
              setEditingGoal(null);
              setGoalDialogOpen(true);
            }}>
              <Target className="h-4 w-4 mr-2" />
              Definir Meta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de todas as metas do período */}
      {goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Todas as Metas {periodType === 'monthly' ? 'Mensais' : periodType === 'weekly' ? 'Semanais' : periodType === 'quarterly' ? 'Trimestrais' : 'Anuais'}</CardTitle>
            <CardDescription>
              Metas definidas para o período {periodType === 'monthly' ? 'mensal' : periodType === 'weekly' ? 'semanal' : periodType === 'quarterly' ? 'trimestral' : 'anual'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goals
                .filter(g => g.user_id === currentUserId && g.period_type === periodType)
                .sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime())
                .map((goal) => {
                  const isActive = goal.id === currentGoal?.id;
                  return (
                    <div
                      key={goal.id}
                      className={`p-4 border rounded-lg ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={isActive ? 'default' : 'secondary'}>
                              {isActive ? 'Ativa' : 'Inativa'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(goal.period_start), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(goal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 mt-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Meta Leads</p>
                              <p className="text-lg font-semibold">{goal.target_leads}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Meta Valor</p>
                              <p className="text-lg font-semibold">{formatCurrency(goal.target_value)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Meta Comissão</p>
                              <p className="text-lg font-semibold">{formatCurrency(goal.target_commission)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingGoal(goal);
                              setGoalDialogOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Meta</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {goals.filter(g => g.user_id === currentUserId && g.period_type === periodType).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma meta encontrada para este período
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GoalForm({
  goal,
  periodType,
  onSubmit,
  onCancel,
}: {
  goal?: any;
  periodType: 'monthly' | 'weekly' | 'quarterly' | 'yearly';
  onSubmit: (data: SellerGoalFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<SellerGoalFormData>({
    user_id: "",
    period_type: periodType,
    period_start: "",
    period_end: "",
    target_leads: goal?.target_leads || 0,
    target_value: goal?.target_value || 0,
    target_commission: goal?.target_commission || 0,
  });
  const [selectedPeriodType, setSelectedPeriodType] = useState<'monthly' | 'weekly' | 'quarterly' | 'yearly'>(periodType);
  const [userSelectedPeriod, setUserSelectedPeriod] = useState(false); // Flag para saber se usuário já selecionou período

  // Inicializar formData quando goal mudar (ao editar)
  useEffect(() => {
    if (goal) {
      setFormData({
        user_id: goal.user_id,
        period_type: goal.period_type,
        period_start: goal.period_start,
        period_end: goal.period_end,
        target_leads: goal.target_leads || 0,
        target_value: goal.target_value || 0,
        target_commission: goal.target_commission || 0,
      });
      setSelectedPeriodType(goal.period_type);
      setUserSelectedPeriod(true); // Meta já tem período definido
    } else {
      setUserSelectedPeriod(false); // Nova meta, pode recalcular
    }
  }, [goal]);

  useEffect(() => {
    // Só recalcular automaticamente se o usuário ainda não selecionou um período específico
    // E não estiver editando uma meta existente
    if (userSelectedPeriod || goal) {
      return; // Não recalcular se usuário já selecionou ou está editando
    }

    // Calcular período baseado no tipo selecionado
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (selectedPeriodType) {
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

    setFormData((prev) => ({
      ...prev,
      period_type: selectedPeriodType,
      period_start: format(start, "yyyy-MM-dd"),
      period_end: format(end, "yyyy-MM-dd"),
    }));
  }, [selectedPeriodType, userSelectedPeriod, goal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="period_type">Tipo de Período</Label>
        <Select value={selectedPeriodType} onValueChange={(v: any) => setSelectedPeriodType(v)}>
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
      {selectedPeriodType === 'monthly' && (
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
              value={formData.period_start ? new Date(formData.period_start).getFullYear().toString() : new Date().getFullYear().toString()}
              onValueChange={(year) => {
                const month = formData.period_start ? new Date(formData.period_start).getMonth() : new Date().getMonth();
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

      {selectedPeriodType === 'quarterly' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Trimestre</Label>
            <Select 
              value={formData.period_start ? Math.floor(new Date(formData.period_start).getMonth() / 3).toString() : Math.floor(new Date().getMonth() / 3).toString()}
              onValueChange={(quarter) => {
                const year = formData.period_start ? new Date(formData.period_start).getFullYear() : new Date().getFullYear();
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
              value={formData.period_start ? new Date(formData.period_start).getFullYear().toString() : new Date().getFullYear().toString()}
              onValueChange={(year) => {
                const quarter = formData.period_start ? Math.floor(new Date(formData.period_start).getMonth() / 3) : Math.floor(new Date().getMonth() / 3);
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

      {selectedPeriodType === 'yearly' && (
        <div className="space-y-2">
          <Label>Ano</Label>
          <Select 
            value={formData.period_start ? new Date(formData.period_start).getFullYear().toString() : new Date().getFullYear().toString()}
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

      {selectedPeriodType === 'weekly' && (
        <div className="space-y-2">
          <Label>Semana (edite manualmente as datas abaixo)</Label>
          <p className="text-xs text-muted-foreground">
            Para semanas específicas, ajuste as datas de início e fim manualmente
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="period_start">Data de Início</Label>
          <Input
            id="period_start"
            type="date"
            value={formData.period_start}
            onChange={(e) =>
              setFormData({ ...formData, period_start: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period_end">Data de Fim</Label>
          <Input
            id="period_end"
            type="date"
            value={formData.period_end}
            onChange={(e) =>
              setFormData({ ...formData, period_end: e.target.value })
            }
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Período: {formData.period_start && formData.period_end 
          ? `${format(new Date(formData.period_start), "dd/MM/yyyy", { locale: ptBR })} até ${format(new Date(formData.period_end), "dd/MM/yyyy", { locale: ptBR })}`
          : "Selecione um período"}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="target_leads">Meta de Leads</Label>
          <Input
            id="target_leads"
            type="number"
            min="0"
            value={formData.target_leads}
            onChange={(e) =>
              setFormData({ ...formData, target_leads: parseInt(e.target.value) || 0 })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target_value">Meta de Valor (R$)</Label>
          <Input
            id="target_value"
            type="number"
            step="0.01"
            min="0"
            value={formData.target_value}
            onChange={(e) =>
              setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })
            }
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="target_commission">Meta de Comissão (R$)</Label>
        <Input
          id="target_commission"
          type="number"
          step="0.01"
          min="0"
          value={formData.target_commission}
          onChange={(e) =>
            setFormData({ ...formData, target_commission: parseFloat(e.target.value) || 0 })
          }
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          {goal ? "Salvar Alterações" : "Criar Meta"}
        </Button>
      </div>
    </form>
  );
}

