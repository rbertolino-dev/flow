import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Bell } from "lucide-react";
import { Lead } from "@/types/lead";
import { format, differenceInDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface CRMNotificationsProps {
  leads: Lead[];
  onViewLeads?: (leadIds: string[]) => void;
}

export function CRMNotifications({ leads, onViewLeads }: CRMNotificationsProps) {
  const navigate = useNavigate();

  const notifications = useMemo(() => {
    const now = new Date();
    const returnToday: Lead[] = [];
    const returnOverdue: Lead[] = [];
    const noContact: Lead[] = [];

    leads.forEach((lead) => {
      // Leads com retorno hoje
      if (lead.returnDate && isToday(new Date(lead.returnDate))) {
        returnToday.push(lead);
      }

      // Leads com retorno vencido
      if (lead.returnDate && isPast(new Date(lead.returnDate)) && !isToday(new Date(lead.returnDate))) {
        returnOverdue.push(lead);
      }

      // Leads sem contato há mais de 7 dias
      if (lead.lastContact) {
        const daysSinceContact = differenceInDays(now, new Date(lead.lastContact));
        if (daysSinceContact > 7) {
          noContact.push(lead);
        }
      }
    });

    return {
      returnToday,
      returnOverdue,
      noContact,
      total: returnToday.length + returnOverdue.length + noContact.length,
    };
  }, [leads]);

  const handleViewLeads = (leadIds: string[]) => {
    if (onViewLeads) {
      onViewLeads(leadIds);
    } else {
      // Navegar para o CRM com filtro aplicado
      navigate("/crm");
    }
  };

  if (notifications.total === 0) return null;

  return (
    <Card className="mb-4 border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
            <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">Atenção Necessária</h3>
              <Badge variant="destructive">{notifications.total}</Badge>
            </div>

            {notifications.returnToday.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-yellow-600" />
                    Retorno hoje: {notifications.returnToday.length} lead(s)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleViewLeads(notifications.returnToday.map((l) => l.id))
                    }
                    className="h-7 text-xs"
                  >
                    Ver
                  </Button>
                </div>
              </div>
            )}

            {notifications.returnOverdue.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    Retorno vencido: {notifications.returnOverdue.length} lead(s)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleViewLeads(notifications.returnOverdue.map((l) => l.id))
                    }
                    className="h-7 text-xs"
                  >
                    Ver
                  </Button>
                </div>
              </div>
            )}

            {notifications.noContact.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2 text-orange-600">
                    <Clock className="h-4 w-4" />
                    Sem contato há 7+ dias: {notifications.noContact.length} lead(s)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleViewLeads(notifications.noContact.map((l) => l.id))
                    }
                    className="h-7 text-xs"
                  >
                    Ver
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



