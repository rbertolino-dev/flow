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
import { cn } from '@/lib/utils';

const AVATAR_TONES = [
  'bg-orange-100 text-orange-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-800',
];

function clientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarTone(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash + char.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

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
  const clientName = contract.lead?.name || 'N/A';

  return (
    <TableRow key={contract.id} className="hover:bg-slate-50/80">
      <TableCell className="text-sm text-slate-600">
        {contract.contract_number}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              avatarTone(clientName)
            )}
          >
            {clientInitials(clientName)}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800">
              {clientName}
            </div>
            <div className="text-xs text-slate-500">
              {contract.lead?.phone || 'Sem telefone'}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-slate-700">
        {contract.template?.name || 'N/A'}
      </TableCell>
      <TableCell>
        <ContractStatusBadge status={contract.status} />
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {format(new Date(contract.created_at), 'dd/MM/yyyy')}
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {contract.expires_at
          ? format(new Date(contract.expires_at), 'dd/MM/yyyy')
          : '-'}
      </TableCell>
      <TableCell className="text-sm text-slate-600">
        {contract.signed_at
          ? format(new Date(contract.signed_at), 'dd/MM/yyyy')
          : '-'}
      </TableCell>
      <TableCell className="text-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-md border-slate-200 text-slate-500"
            >
              <MoreHorizontal className="h-4 w-4" />
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




