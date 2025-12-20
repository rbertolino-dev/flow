import { useContractAuditLog } from '@/hooks/useContractAuditLog';
import { ContractAuditLog as AuditLog, AuditAction } from '@/types/contract';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Download,
  User,
  Clock,
} from 'lucide-react';

interface ContractAuditLogProps {
  contractId: string;
}

const ACTION_ICONS: Record<AuditAction, React.ReactNode> = {
  created: <FileText className="w-4 h-4" />,
  updated: <Edit className="w-4 h-4" />,
  deleted: <Trash2 className="w-4 h-4" />,
  sent: <Send className="w-4 h-4" />,
  signed: <CheckCircle2 className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
  status_changed: <Edit className="w-4 h-4" />,
  pdf_generated: <Download className="w-4 h-4" />,
  reminder_sent: <Send className="w-4 h-4" />,
};

const ACTION_LABELS: Record<AuditAction, string> = {
  created: 'Criado',
  updated: 'Atualizado',
  deleted: 'Deletado',
  sent: 'Enviado',
  signed: 'Assinado',
  cancelled: 'Cancelado',
  status_changed: 'Status Alterado',
  pdf_generated: 'PDF Gerado',
  reminder_sent: 'Lembrete Enviado',
};

const ACTION_COLORS: Record<AuditAction, string> = {
  created: 'bg-blue-100 text-blue-800',
  updated: 'bg-yellow-100 text-yellow-800',
  deleted: 'bg-red-100 text-red-800',
  sent: 'bg-green-100 text-green-800',
  signed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
  status_changed: 'bg-purple-100 text-purple-800',
  pdf_generated: 'bg-cyan-100 text-cyan-800',
  reminder_sent: 'bg-indigo-100 text-indigo-800',
};

export function ContractAuditLog({ contractId }: ContractAuditLogProps) {
  const { auditLogs, loading } = useContractAuditLog(contractId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Auditoria</CardTitle>
          <CardDescription>Carregando histórico...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Auditoria</CardTitle>
          <CardDescription>Nenhuma ação registrada ainda</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Histórico de Auditoria
        </CardTitle>
        <CardDescription>
          Registro completo de todas as ações realizadas neste contrato
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="border-l-4 pl-4 py-2 space-y-2"
                style={{
                  borderLeftColor: log.action === 'created' ? '#3b82f6' :
                                  log.action === 'updated' ? '#eab308' :
                                  log.action === 'deleted' ? '#ef4444' :
                                  log.action === 'signed' ? '#10b981' :
                                  '#6b7280',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded ${ACTION_COLORS[log.action]}`}>
                      {ACTION_ICONS[log.action]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {ACTION_LABELS[log.action]}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </Badge>
                      </div>
                      {log.user && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <User className="w-3 h-3" />
                          <span>
                            {typeof log.user === 'object' && log.user !== null
                              ? (log.user as any).full_name || (log.user as any).email || 'Usuário desconhecido'
                              : 'Usuário desconhecido'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                    <div className="space-y-1">
                      {Object.entries(log.details).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(log.old_value || log.new_value) && (
                  <div className="text-xs space-y-1 mt-2">
                    {log.old_value && (
                      <div className="bg-red-50 border border-red-200 rounded p-2">
                        <span className="font-medium text-red-800">Valor Anterior:</span>
                        <pre className="mt-1 text-red-700 whitespace-pre-wrap break-words">
                          {JSON.stringify(log.old_value, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.new_value && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <span className="font-medium text-green-800">Valor Novo:</span>
                        <pre className="mt-1 text-green-700 whitespace-pre-wrap break-words">
                          {JSON.stringify(log.new_value, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {(log.ip_address || log.user_agent) && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    {log.ip_address && (
                      <div>IP: {log.ip_address}</div>
                    )}
                    {log.user_agent && (
                      <div className="line-clamp-1">User Agent: {log.user_agent}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
} 





