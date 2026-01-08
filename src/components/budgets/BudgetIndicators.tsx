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
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Indicadores de Orçamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Total de orçamentos criados no período */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Orçamentos
                </p>
                <p className="text-2xl font-bold">{total}</p>
                {(dateFrom || dateTo) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {dateFrom && dateTo && `Período: ${new Date(dateFrom).toLocaleDateString('pt-BR')} - ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
                    {dateFrom && !dateTo && `A partir de: ${new Date(dateFrom).toLocaleDateString('pt-BR')}`}
                    {!dateFrom && dateTo && `Até: ${new Date(dateTo).toLocaleDateString('pt-BR')}`}
                  </p>
                )}
                {!dateFrom && !dateTo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os orçamentos
                  </p>
                )}
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

