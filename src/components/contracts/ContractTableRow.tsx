import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ContractStatusBadge } from './ContractStatusBadge';
import { Contract } from '@/types/contract';
import { format } from 'date-fns';
import { Eye, Send, X, Download, FileSignature, MessageSquare, FileText, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContractSignatures } from '@/hooks/useContractSignatures';

interface ContractTableRowProps {
  contract: Contract;
  onView?: (contract: Contract) => void;
  onSend?: (contract: Contract) => void;
  onSign?: (contract: Contract) => void;
  onCancel?: (contract: Contract) => void;
  onDownload?: (contract: Contract) => void;
  onEditMessage?: (contract: Contract) => void;
  onEditTemplate?: (contract: Contract) => void;
}

export function ContractTableRow({
  contract,
  onView,
  onSend,
  onSign,
  onCancel,
  onDownload,
  onEditMessage,
  onEditTemplate,
}: ContractTableRowProps) {
  const { signatures } = useContractSignatures(contract.id);
  const userHasSigned = signatures.some(sig => sig.signer_type === 'user');

  return (
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
              title="Editar template deste contrato"
            >
              <FileText className="h-3 w-3" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <ContractStatusBadge status={contract.status} />
      </TableCell>
      <TableCell>
        {format(new Date(contract.created_at), 'dd/MM/yyyy')}
      </TableCell>
      <TableCell>
        {contract.expires_at
          ? format(new Date(contract.expires_at), 'dd/MM/yyyy')
          : '-'}
      </TableCell>
      <TableCell>
        {contract.signed_at
          ? format(new Date(contract.signed_at), 'dd/MM/yyyy')
          : '-'}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onView && (
              <DropdownMenuItem onClick={() => onView(contract)}>
                <Eye className="w-4 h-4 mr-2" />
                Visualizar
              </DropdownMenuItem>
            )}
            {onEditMessage && (
              <DropdownMenuItem onClick={() => {
                console.log('🔵 Editando mensagem do contrato:', contract.id);
                onEditMessage(contract);
              }}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Editar Mensagem WhatsApp
              </DropdownMenuItem>
            )}
            {onEditTemplate && contract.template && (
              <DropdownMenuItem onClick={() => {
                console.log('🔵 Editando template do contrato:', contract.id, contract.template?.id);
                onEditTemplate(contract);
              }}>
                <FileText className="w-4 h-4 mr-2" />
                Editar Template
              </DropdownMenuItem>
            )}
            {(onEditMessage || (onEditTemplate && contract.template)) && (
              <DropdownMenuItem className="opacity-50 cursor-default" disabled>
                ────────────
              </DropdownMenuItem>
            )}
            {onDownload && contract.pdf_url && (
              <DropdownMenuItem onClick={() => onDownload(contract)}>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </DropdownMenuItem>
            )}
            {onSign && !userHasSigned && (
              <DropdownMenuItem onClick={() => onSign(contract)}>
                <FileSignature className="w-4 h-4 mr-2" />
                Assinar
              </DropdownMenuItem>
            )}
            {onSend && contract.status !== 'sent' && contract.status !== 'signed' && (
              <DropdownMenuItem onClick={() => onSend(contract)}>
                <Send className="w-4 h-4 mr-2" />
                Enviar
              </DropdownMenuItem>
            )}
            {onCancel && contract.status !== 'cancelled' && (
              <DropdownMenuItem
                onClick={() => onCancel(contract)}
                className="text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}



