import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Budget } from '@/types/budget';
import { isAfter, isBefore, addDays } from 'date-fns';
import { Calendar, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Indicadores de Orçamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Total de orçamentos criados no período */}
          <div className="flex items-center justify-between pb-2 border-b">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Total de Orçamentos
              </p>
              <p className="text-lg font-bold">{total}</p>
              {(dateFrom || dateTo) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateFrom && dateTo && `Período: ${new Date(dateFrom).toLocaleDateString('pt-BR')} - ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
                  {dateFrom && !dateTo && `A partir de: ${new Date(dateFrom).toLocaleDateString('pt-BR')}`}
                  {!dateFrom && dateTo && `Até: ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
                </p>
              )}
              {!dateFrom && !dateTo && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Todos os orçamentos
                </p>
              )}
            </div>
          </div>

          {/* Status dos orçamentos */}
          <div className="grid grid-cols-3 gap-2">
            {/* Expirou */}
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mb-1" />
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Expirou</p>
              <p className="text-lg font-bold text-destructive">{expired}</p>
            </div>

            {/* Próximo de Expirar */}
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Clock className="w-4 h-4 text-yellow-600 mb-1" />
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Próximo</p>
              <p className="text-lg font-bold text-yellow-600">{expiringSoon}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">(até 7 dias)</p>
            </div>

            {/* Válido */}
            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-600 mb-1" />
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Válido</p>
              <p className="text-lg font-bold text-green-600">{valid}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">(mais de 7 dias)</p>
            </div>
          </div>

          {/* Resumo visual */}
          {total > 0 && (
            <div className="pt-2 border-t">
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted">
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
              <div className="flex items-center justify-center gap-1 mt-1.5">
                {expired > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                    {expired} expirado{expired !== 1 ? 's' : ''}
                  </Badge>
                )}
                {expiringSoon > 0 && (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px] px-1.5 py-0 h-4">
                    {expiringSoon} próximo{expiringSoon !== 1 ? 's' : ''}
                  </Badge>
                )}
                {valid > 0 && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0 h-4">
                    {valid} válido{valid !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

