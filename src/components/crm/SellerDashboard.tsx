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
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Target,
  DollarSign,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  AlertCircle,
  Edit,
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
  const currentGoal = currentMetric?.currentGoal;
  
  // Debug: Log para verificar se a meta está sendo encontrada
  useEffect(() => {
    if (currentUserId && goals.length > 0) {
      const userGoals = goals.filter(g => g.user_id === currentUserId);
      const goalsForPeriod = userGoals.filter(g => g.period_type === periodType);
      
      console.log('🔍 Debug Meta de Valor:', {
        currentUserId,
        periodType,
        goalsCount: goals.length,
        userGoalsCount: userGoals.length,
        goalsForPeriodCount: goalsForPeriod.length,
        goalsForPeriod: goalsForPeriod.map(g => ({
          id: g.id,
          period_start: g.period_start,
          period_end: g.period_end,
          target_value: g.target_value,
          period_type: g.period_type,
        })),
        currentGoal: currentGoal ? {
          id: currentGoal.id,
          period_start: currentGoal.period_start,
          period_end: currentGoal.period_end,
          target_value: currentGoal.target_value,
        } : null,
        currentMetric: currentMetric ? {
          actualValue: currentMetric.actualValue,
          valueProgress: currentMetric.valueProgress,
        } : null,
      });
    }
  }, [currentUserId, periodType, goals, currentGoal, currentMetric]);
  
  // Filtrar metas do vendedor atual
  const userGoals = goals.filter(goal => goal.user_id === currentUserId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleCreateOrUpdateGoal = async (goalData: SellerGoalFormData) => {
    try {
      if (editingGoal) {
        // Para atualização, remover campos vazios e campos que não devem ser atualizados
        // NUNCA atualizar user_id, organization_id ou outros campos de identificação
        const updateData: Partial<SellerGoalFormData> = {
          period_type: goalData.period_type,
          period_start: goalData.period_start,
          period_end: goalData.period_end,
          target_leads: goalData.target_leads,
          target_value: goalData.target_value,
          target_commission: goalData.target_commission,
        };
        
        // Remover campos vazios, nulos ou inválidos
        Object.keys(updateData).forEach(key => {
          const value = updateData[key as keyof typeof updateData];
          if (value === "" || value === null || value === undefined) {
            delete updateData[key as keyof typeof updateData];
          }
        });
        
        // Garantir que user_id NUNCA seja enviado na atualização
        delete (updateData as any).user_id;
        
        await updateGoal(editingGoal.id, updateData);
      } else {
        const newGoal = await createGoal({
          ...goalData,
          user_id: currentUserId!,
        });
        console.log('✅ Meta criada:', newGoal);
      }
      
      // Refetch para garantir que a lista está atualizada
      await refetchGoals();
      
      // Forçar atualização das métricas aguardando um pouco para garantir que o banco foi atualizado
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Fechar dialog
      setGoalDialogOpen(false);
      setEditingGoal(null);
      
      // Log para debug
      console.log('🔄 Metas atualizadas após criar/editar');
    } catch (error) {
      // Erro já tratado no hook
      console.error('❌ Erro ao criar/atualizar meta:', error);
    }
  };

  const handleEditGoal = (goal?: any) => {
    const goalToEdit = goal || currentGoal;
    if (goalToEdit) {
      setEditingGoal(goalToEdit);
      setGoalDialogOpen(true);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (confirm("Tem certeza que deseja excluir esta meta?")) {
      try {
        await deleteGoal(goalId);
        await refetchGoals();
      } catch (error) {
        // Erro já tratado no hook
      }
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
            {currentGoal ? (
              <>
                <div className="text-sm text-muted-foreground mt-1">
                  Meta: {formatCurrency(currentGoal.target_value)}
                </div>
                <Progress
                  value={Math.min(currentMetric.valueProgress, 100)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {currentMetric.valueProgress.toFixed(1)}% concluído
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Período: {format(new Date(currentGoal.period_start), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(currentGoal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground mt-1">
                <p className="text-amber-600 dark:text-amber-400">
                  Nenhuma meta definida para este período
                </p>
                <p className="text-xs mt-1">
                  Clique em "Definir Meta" para criar uma meta de valor
                </p>
                {/* Debug: Mostrar informações sobre metas disponíveis */}
                {userGoals.length > 0 && (
                  <p className="text-xs mt-2 text-muted-foreground">
                    {userGoals.filter(g => g.period_type === periodType).length} meta(s) do tipo "{periodType}" encontrada(s), mas nenhuma está ativa para o período atual.
                  </p>
                )}
              </div>
            )}
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
              <Button variant="outline" size="sm" onClick={handleEditGoal}>
                Editar
              </Button>
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
              Você ainda não possui uma meta definida para este período.
            </p>
            <Button onClick={() => setGoalDialogOpen(true)}>
              <Target className="h-4 w-4 mr-2" />
              Definir Meta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de Todas as Metas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Minhas Metas</CardTitle>
              <CardDescription>
                Todas as metas criadas para você ({userGoals.length} {userGoals.length === 1 ? 'meta' : 'metas'})
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {userGoals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Você ainda não possui metas criadas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {userGoals.map((goal) => {
                const isCurrent = currentGoal?.id === goal.id;
                const periodTypeLabel = {
                  monthly: 'Mensal',
                  weekly: 'Semanal',
                  quarterly: 'Trimestral',
                  yearly: 'Anual'
                }[goal.period_type] || goal.period_type;

                return (
                  <div
                    key={goal.id}
                    className={`border rounded-lg p-4 ${
                      isCurrent ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">
                            Meta {periodTypeLabel}
                            {isCurrent && (
                              <Badge variant="default" className="ml-2">
                                Atual
                              </Badge>
                            )}
                          </h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {format(new Date(goal.period_start), "dd/MM/yyyy", { locale: ptBR })} até{" "}
                          {format(new Date(goal.period_end), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-xs text-muted-foreground">Meta de Leads</Label>
                            <div className="text-lg font-semibold">{goal.target_leads}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Meta de Valor</Label>
                            <div className="text-lg font-semibold">
                              {formatCurrency(goal.target_value)}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Meta de Comissão</Label>
                            <div className="text-lg font-semibold text-primary">
                              {formatCurrency(goal.target_commission)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditGoal(goal)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGoal(goal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
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
  const [selectedPeriodType, setSelectedPeriodType] = useState<'monthly' | 'weekly' | 'quarterly' | 'yearly'>(periodType);
  const [formData, setFormData] = useState<SellerGoalFormData>({
    user_id: "",
    period_type: periodType,
    period_start: "",
    period_end: "",
    target_leads: goal?.target_leads || 0,
    target_value: goal?.target_value || 0,
    target_commission: goal?.target_commission || 0,
  });

  // Atualizar formData quando goal mudar
  useEffect(() => {
    if (goal) {
      setFormData({
        user_id: goal.user_id || "",
        period_type: goal.period_type || periodType,
        period_start: goal.period_start || "",
        period_end: goal.period_end || "",
        target_leads: goal.target_leads || 0,
        target_value: goal.target_value || 0,
        target_commission: goal.target_commission || 0,
      });
      setSelectedPeriodType(goal.period_type || periodType);
    } else {
      // Resetar para valores padrão quando não há meta
      setFormData({
        user_id: "",
        period_type: periodType,
        period_start: "",
        period_end: "",
        target_leads: 0,
        target_value: 0,
        target_commission: 0,
      });
    }
  }, [goal, periodType]);

  useEffect(() => {
    // Calcular período baseado no tipo selecionado
    // Usar a mesma lógica do useSellerPerformanceMetrics para garantir consistência
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (selectedPeriodType) {
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'quarterly':
        start = startOfQuarter(now);
        end = endOfQuarter(now);
        break;
      case 'yearly':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    setFormData((prev) => ({
      ...prev,
      period_type: selectedPeriodType,
      period_start: format(start, "yyyy-MM-dd"),
      period_end: format(end, "yyyy-MM-dd"),
    }));
  }, [selectedPeriodType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Período da Meta</Label>
        <Select value={selectedPeriodType} onValueChange={(v: any) => setSelectedPeriodType(v)}>
          <SelectTrigger id="period_type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="quarterly">Trimestral</SelectItem>
            <SelectItem value="yearly">Anual</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Período: {formData.period_start && formData.period_end 
            ? `${format(new Date(formData.period_start), "dd/MM/yyyy", { locale: ptBR })} até ${format(new Date(formData.period_end), "dd/MM/yyyy", { locale: ptBR })}`
            : "Selecione um período"}
        </p>
      </div>
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

