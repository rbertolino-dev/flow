import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DigitalContractStatusBadge } from './DigitalContractStatusBadge';
import { DigitalContract } from '@/types/digital-contract';
import { format } from 'date-fns';
import { Eye, Send, X, Download, FileSignature, MessageSquare, FileText, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DigitalContractsListProps {
  contracts: DigitalContract[];
  loading?: boolean;
  onView?: (contract: DigitalContract) => void;
  onSend?: (contract: DigitalContract) => void;
  onSign?: (contract: DigitalContract) => void;
  onCancel?: (contract: DigitalContract) => void;
  onDownload?: (contract: DigitalContract) => void;
  onEditMessage?: (contract: DigitalContract) => void;
  onEditTemplate?: (contract: DigitalContract) => void;
}

export function DigitalContractsList({
  contracts,
  loading,
  onView,
  onSend,
  onSign,
  onCancel,
  onDownload,
  onEditMessage,
  onEditTemplate,
}: DigitalContractsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando contratos...</p>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FileSignature className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum contrato encontrado</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criação</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Assinatura</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell className="font-mono text-sm">
                {contract.contract_number}
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">
                    {contract.lead?.name || 'N/A'}
                  </div>
                  {contract.lead?.phone && (
                    <div className="text-sm text-muted-foreground">
                      {contract.lead.phone}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span>{contract.template?.name || 'N/A'}</span>
                  {contract.template && onEditTemplate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs opacity-70 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTemplate(contract);
                      }}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <DigitalContractStatusBadge status={contract.status} />
              </TableCell>
              <TableCell>
                {contract.created_at
                  ? format(new Date(contract.created_at), 'dd/MM/yyyy')
                  : 'N/A'}
              </TableCell>
              <TableCell>
                {contract.expires_at
                  ? format(new Date(contract.expires_at), 'dd/MM/yyyy')
                  : 'N/A'}
              </TableCell>
              <TableCell>
                {contract.signed_at
                  ? format(new Date(contract.signed_at), 'dd/MM/yyyy HH:mm')
                  : 'Não assinado'}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onView && (
                      <DropdownMenuItem onClick={() => onView(contract)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                    )}
                    {onEditMessage && (
                      <DropdownMenuItem onClick={() => onEditMessage(contract)}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Editar Mensagem WhatsApp
                      </DropdownMenuItem>
                    )}
                    {onEditTemplate && contract.template && (
                      <DropdownMenuItem onClick={() => onEditTemplate(contract)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Editar Template
                      </DropdownMenuItem>
                    )}
                    {onDownload && contract.pdf_url && (
                      <DropdownMenuItem onClick={() => onDownload(contract)}>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar PDF
                      </DropdownMenuItem>
                    )}
                    {onSign && contract.status !== 'signed' && (
                      <DropdownMenuItem onClick={() => onSign(contract)}>
                        <FileSignature className="mr-2 h-4 w-4" />
                        Assinar
                      </DropdownMenuItem>
                    )}
                    {onSend && contract.status !== 'sent' && contract.status !== 'signed' && (
                      <DropdownMenuItem onClick={() => onSend(contract)}>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                      </DropdownMenuItem>
                    )}
                    {onCancel && contract.status !== 'cancelled' && (
                      <DropdownMenuItem
                        onClick={() => onCancel(contract)}
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

