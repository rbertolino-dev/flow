import { Budget } from '@/types/budget-module';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Download, Send, Edit, Trash2, RefreshCw, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BudgetViewerProps {
  budget: Budget;
  onRegeneratePDF?: () => void;
  onDownload?: () => void;
  onSendWhatsApp?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBack?: () => void;
  regenerating?: boolean;
  sending?: boolean;
}

export function BudgetViewer({
  budget,
  onRegeneratePDF,
  onDownload,
  onSendWhatsApp,
  onEdit,
  onDelete,
  onBack,
  regenerating = false,
  sending = false,
}: BudgetViewerProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const isExpired = budget.expires_at ? new Date(budget.expires_at) < new Date() : false;
  const client = budget.client_data || budget.lead;

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold">{budget.budget_number}</h2>
            <p className="text-sm text-muted-foreground">
              Criado em {format(new Date(budget.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpired && <Badge variant="destructive">Expirado</Badge>}
          {!isExpired && <Badge variant="default">Válido</Badge>}
          {onRegeneratePDF && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegeneratePDF}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Regenerar PDF
            </Button>
          )}
          {onDownload && budget.pdf_url && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}
          {onSendWhatsApp && client?.phone && (
            <Button variant="outline" size="sm" onClick={onSendWhatsApp} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar WhatsApp
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir
            </Button>
          )}
        </div>
      </div>

      {/* Preview do PDF */}
      {budget.pdf_url && (
        <Card>
          <CardHeader>
            <CardTitle>Preview do PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              src={budget.pdf_url}
              className="w-full h-[600px] border rounded"
              title="PDF Preview"
            />
          </CardContent>
        </Card>
      )}

      {/* Informações do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{client?.name || 'N/A'}</p>
            </div>
            {client?.phone && (
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{client.phone}</p>
              </div>
            )}
            {client?.email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{client.email}</p>
              </div>
            )}
            {client?.company && (
              <div>
                <p className="text-sm text-muted-foreground">Empresa</p>
                <p className="font-medium">{client.company}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Produtos */}
      {budget.products && budget.products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budget.products.map((product, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{product.name}</p>
                    {product.description && (
                      <p className="text-sm text-muted-foreground">{product.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(product.subtotal)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(product.price)} x {product.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Serviços */}
      {budget.services && budget.services.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Serviços</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budget.services.map((service, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    {service.description && (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(service.subtotal)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(service.price)} x {service.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totais */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal Produtos:</span>
              <span>{formatCurrency(budget.subtotal_products)}</span>
            </div>
            <div className="flex justify-between">
              <span>Subtotal Serviços:</span>
              <span>{formatCurrency(budget.subtotal_services)}</span>
            </div>
            {budget.additions !== 0 && (
              <div className="flex justify-between">
                <span>{budget.additions > 0 ? 'Acréscimo' : 'Desconto'}:</span>
                <span>{formatCurrency(Math.abs(budget.additions))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total:</span>
              <span>{formatCurrency(budget.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forma de Pagamento */}
      {budget.payment_methods && budget.payment_methods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {budget.payment_methods.map((method) => (
                <Badge key={method} variant="secondary">
                  {method}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entrega */}
      {(budget.delivery_date || budget.delivery_location) && (
        <Card>
          <CardHeader>
            <CardTitle>Informações de Entrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budget.delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {format(new Date(budget.delivery_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
              {budget.delivery_location && (
                <div>
                  <p className="text-sm text-muted-foreground">Local</p>
                  <p className="font-medium">{budget.delivery_location}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações */}
      {budget.observations && (
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{budget.observations}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
