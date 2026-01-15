import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Budget } from '@/types/budget';
import { isAfter, isBefore, addDays } from 'date-fns';
import { Calendar, AlertTriangle, CheckCircle2, Clock, DollarSign } from 'lucide-react';

interface BudgetIndicatorsProps {
  budgets: Budget[];
  dateFrom?: string;
  dateTo?: string;
}

export function BudgetIndicators({ budgets, dateFrom, dateTo }: BudgetIndicatorsProps) {
  // Filtrar orçamentos baseado nos filtros de data da página
  const budgetsInPeriod = useMemo(() => {
    if (!budgets || !Array.isArray(budgets)) return [];
    
    // Se não houver filtro de data, usar todos os orçamentos
    if (!dateFrom && !dateTo) {
      return budgets;
    }
    
    return budgets.filter((budget) => {
      if (!budget.created_at) return false;
      const createdAt = new Date(budget.created_at);
      
      if (dateFrom && createdAt < new Date(dateFrom)) {
        return false;
      }
      
      if (dateTo) {
        const dateToEnd = new Date(dateTo);
        dateToEnd.setHours(23, 59, 59, 999); // Incluir o dia inteiro
        if (createdAt > dateToEnd) {
          return false;
        }
      }
      
      return true;
    });
  }, [budgets, dateFrom, dateTo]);

  // Calcular status dos orçamentos
  const { expired, expiringSoon, valid, approved } = useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = addDays(now, 7);
    
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;
    let approvedCount = 0;

    budgetsInPeriod.forEach((budget) => {
      // Contar aprovados
      if (budget.approved) {
        approvedCount++;
      }

      if (!budget.expires_at) {
        validCount++;
        return;
      }

      const expiresAt = new Date(budget.expires_at);
      
      if (isBefore(expiresAt, now)) {
        // Já expirou
        expiredCount++;
      } else if (isAfter(expiresAt, oneWeekFromNow)) {
        // Válido (mais de 1 semana)
        validCount++;
      } else {
        // Próximo de expirar (dentro de 1 semana)
        expiringSoonCount++;
      }
    });

    return {
      expired: expiredCount,
      expiringSoon: expiringSoonCount,
      valid: validCount,
      approved: approvedCount,
    };
  }, [budgetsInPeriod]);

  const total = budgetsInPeriod.length;

  // Calcular total em reais dos orçamentos no período
  const totalValue = useMemo(() => {
    return budgetsInPeriod.reduce((sum, budget) => {
      return sum + (budget.total || 0);
    }, 0);
  }, [budgetsInPeriod]);

  // Calcular total em reais dos orçamentos aprovados no período
  const approvedValue = useMemo(() => {
    return budgetsInPeriod
      .filter(budget => budget.approved)
      .reduce((sum, budget) => {
        return sum + (budget.total || 0);
      }, 0);
  }, [budgetsInPeriod]);

  // Formatar valor em reais
  const formattedTotalValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(totalValue);

  // Formatar valor em reais dos aprovados
  const formattedApprovedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(approvedValue);

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-background to-muted/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          Indicadores
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Todos os indicadores em uma linha - Design moderno e compacto */}
        <div className="grid grid-cols-4 gap-3">
          {/* Total de Orçamentos */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 via-blue-100/60 to-blue-50 dark:from-blue-950/40 dark:via-blue-900/30 dark:to-blue-950/40 border border-blue-200/60 dark:border-blue-800/40 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <p className="text-[9px] font-semibold text-blue-700 dark:text-blue-300 mb-2 uppercase tracking-wide">
              Total
            </p>
            <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 leading-none mb-1">{total}</p>
            <p className="text-[9px] text-blue-600/80 dark:text-blue-400/80 font-medium">orçamentos</p>
          </div>
          
          {/* Valor Total Orçado */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 via-emerald-100/60 to-emerald-50 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <p className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 mb-2 uppercase tracking-wide flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Valor Total
            </p>
            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 leading-none mb-1">{formattedTotalValue}</p>
            <p className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-medium">orçado</p>
          </div>
          
          {/* Aprovados - Quantidade */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 via-green-100/60 to-green-50 dark:from-green-950/40 dark:via-green-900/30 dark:to-green-950/40 border border-green-200/60 dark:border-green-800/40 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <p className="text-[9px] font-semibold text-green-700 dark:text-green-300 mb-2 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Aprovados
            </p>
            <p className="text-3xl font-bold text-green-900 dark:text-green-100 leading-none mb-1">{approved}</p>
            <p className="text-[9px] text-green-600/80 dark:text-green-400/80 font-medium">orçamentos</p>
          </div>
          
          {/* Valor Aprovado */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 via-green-100/60 to-green-50 dark:from-green-950/40 dark:via-green-900/30 dark:to-green-950/40 border border-green-200/60 dark:border-green-800/40 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]">
            <p className="text-[9px] font-semibold text-green-700 dark:text-green-300 mb-2 uppercase tracking-wide flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              Valor Aprovado
            </p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100 leading-none mb-1">{formattedApprovedValue}</p>
            <p className="text-[9px] text-green-600/80 dark:text-green-400/80 font-medium">aprovado</p>
          </div>
        </div>

        {/* Período - Compacto */}
        {(dateFrom || dateTo) && (
          <div className="px-2 py-1.5 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-[10px] text-muted-foreground">
              {dateFrom && dateTo && `📅 ${new Date(dateFrom).toLocaleDateString('pt-BR')} - ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
              {dateFrom && !dateTo && `📅 A partir de ${new Date(dateFrom).toLocaleDateString('pt-BR')}`}
              {!dateFrom && dateTo && `📅 Até ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        )}
        {!dateFrom && !dateTo && (
          <div className="px-2 py-1.5 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-[10px] text-muted-foreground">
              📅 Todos os orçamentos
            </p>
          </div>
        )}

        {/* Status dos orçamentos - Design moderno com gradientes */}
        <div className="grid grid-cols-3 gap-2">
          {/* Expirou */}
          <div className="group relative p-2.5 rounded-xl bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border border-red-200/50 dark:border-red-800/30 hover:border-red-300 dark:hover:border-red-700 transition-all">
            <div className="flex flex-col items-center">
              <div className="p-1.5 rounded-lg bg-red-500/10 mb-1.5 group-hover:bg-red-500/20 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-[11px] font-semibold text-red-700 dark:text-red-300 mb-0.5">Expirou</p>
              <p className="text-lg font-bold text-red-900 dark:text-red-100">{expired}</p>
            </div>
          </div>

          {/* Próximo de Expirar */}
          <div className="group relative p-2.5 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 hover:border-amber-300 dark:hover:border-amber-700 transition-all">
            <div className="flex flex-col items-center">
              <div className="p-1.5 rounded-lg bg-amber-500/10 mb-1.5 group-hover:bg-amber-500/20 transition-colors">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">Próximo</p>
              <p className="text-lg font-bold text-amber-900 dark:text-amber-100">{expiringSoon}</p>
              <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">≤ 7 dias</p>
            </div>
          </div>

          {/* Válido */}
          <div className="group relative p-2.5 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border border-green-200/50 dark:border-green-800/30 hover:border-green-300 dark:hover:border-green-700 transition-all">
            <div className="flex flex-col items-center">
              <div className="p-1.5 rounded-lg bg-green-500/10 mb-1.5 group-hover:bg-green-500/20 transition-colors">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-[11px] font-semibold text-green-700 dark:text-green-300 mb-0.5">Válido</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100">{valid}</p>
              <p className="text-[9px] text-green-600/70 dark:text-green-400/70 mt-0.5">&gt; 7 dias</p>
            </div>
          </div>
        </div>

        {/* Resumo visual - Barra de progresso moderna */}
        {total > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted/50">
              {expired > 0 && (
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 transition-all"
                  style={{ width: `${(expired / total) * 100}%` }}
                  title={`${expired} expirado(s)`}
                />
              )}
              {expiringSoon > 0 && (
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-600 transition-all"
                  style={{ width: `${(expiringSoon / total) * 100}%` }}
                  title={`${expiringSoon} próximo(s) de expirar`}
                />
              )}
              {valid > 0 && (
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 transition-all"
                  style={{ width: `${(valid / total) * 100}%` }}
                  title={`${valid} válido(s)`}
                />
              )}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {expired > 0 && (
                <Badge variant="destructive" className="text-[10px] px-2 py-0.5 h-5 font-medium">
                  {expired} expirado{expired !== 1 ? 's' : ''}
                </Badge>
              )}
              {expiringSoon > 0 && (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] px-2 py-0.5 h-5 font-medium">
                  {expiringSoon} próximo{expiringSoon !== 1 ? 's' : ''}
                </Badge>
              )}
              {valid > 0 && (
                <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20 text-[10px] px-2 py-0.5 h-5 font-medium">
                  {valid} válido{valid !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

