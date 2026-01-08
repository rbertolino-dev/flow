import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Budget } from '@/types/budget';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface BudgetIndicatorsProps {
  budgets: Budget[];
}

type PeriodType = 'week' | 'month' | 'year';

export function BudgetIndicators({ budgets }: BudgetIndicatorsProps) {
  const [periodType, setPeriodType] = useState<PeriodType>('month');

  // Calcular período baseado no tipo selecionado
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (periodType) {
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 }); // Segunda-feira
        end = endOfWeek(now, { weekStartsOn: 1 }); // Domingo
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return { periodStart: start, periodEnd: end };
  }, [periodType]);

  // Filtrar orçamentos criados no período
  const budgetsInPeriod = useMemo(() => {
    if (!budgets || !Array.isArray(budgets)) return [];
    
    return budgets.filter((budget) => {
      if (!budget.created_at) return false;
      const createdAt = new Date(budget.created_at);
      return createdAt >= periodStart && createdAt <= periodEnd;
    });
  }, [budgets, periodStart, periodEnd]);

  // Calcular status dos orçamentos
  const { expired, expiringSoon, valid } = useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = addDays(now, 7);
    
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let validCount = 0;

    budgetsInPeriod.forEach((budget) => {
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
    };
  }, [budgetsInPeriod]);

  const total = budgetsInPeriod.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Indicadores de Orçamentos
          </CardTitle>
          <Select value={periodType} onValueChange={(value: PeriodType) => setPeriodType(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year">Anual</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Total de orçamentos criados no período */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Orçamentos Criados
                </p>
                <p className="text-2xl font-bold">{total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {periodType === 'week' && 'Esta semana'}
                  {periodType === 'month' && 'Este mês'}
                  {periodType === 'year' && 'Este ano'}
                </p>
              </div>
            </div>

            {/* Status dos orçamentos */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              {/* Expirou */}
              <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
                <p className="text-xs font-medium text-muted-foreground mb-1">Expirou</p>
                <p className="text-xl font-bold text-destructive">{expired}</p>
              </div>

              {/* Próximo de Expirar */}
              <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Clock className="w-5 h-5 text-yellow-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground mb-1">Próximo de Expirar</p>
                <p className="text-xl font-bold text-yellow-600">{expiringSoon}</p>
                <p className="text-xs text-muted-foreground mt-1">(até 7 dias)</p>
              </div>

              {/* Válido */}
              <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-600 mb-2" />
                <p className="text-xs font-medium text-muted-foreground mb-1">Válido</p>
                <p className="text-xl font-bold text-green-600">{valid}</p>
                <p className="text-xs text-muted-foreground mt-1">(mais de 7 dias)</p>
              </div>
            </div>

            {/* Resumo visual */}
            {total > 0 && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted-foreground">Distribuição:</p>
                </div>
                <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                  {expired > 0 && (
                    <div
                      className="bg-destructive"
                      style={{ width: `${(expired / total) * 100}%` }}
                      title={`${expired} expirado(s)`}
                    />
                  )}
                  {expiringSoon > 0 && (
                    <div
                      className="bg-yellow-500"
                      style={{ width: `${(expiringSoon / total) * 100}%` }}
                      title={`${expiringSoon} próximo(s) de expirar`}
                    />
                  )}
                  {valid > 0 && (
                    <div
                      className="bg-green-500"
                      style={{ width: `${(valid / total) * 100}%` }}
                      title={`${valid} válido(s)`}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>
                    {expired > 0 && (
                      <Badge variant="destructive" className="mr-1">
                        {expired} expirado{expired !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {expiringSoon > 0 && (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 mr-1">
                        {expiringSoon} próximo{expiringSoon !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {valid > 0 && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                        {valid} válido{valid !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

