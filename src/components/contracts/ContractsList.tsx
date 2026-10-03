import { useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Contract } from '@/types/contract';
import { FileSignature, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ContractTableRow } from './ContractTableRow';
import { cn } from '@/lib/utils';

interface ContractsListProps {
  contracts: Contract[];
  loading?: boolean;
  onView?: (contract: Contract) => void;
  onSend?: (contract: Contract) => void;
  onSign?: (contract: Contract) => void;
  onCancel?: (contract: Contract) => void;
  onDownload?: (contract: Contract) => void;
  onEditMessage?: (contract: Contract) => void;
  onEditTemplate?: (contract: Contract) => void;
}

type SortKey = 'number' | 'client' | 'template' | 'status' | 'created' | 'expires' | 'signed';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const STATUS_ORDER = ['draft', 'sent', 'signed', 'expired', 'cancelled'];

function compareText(a?: string | null, b?: string | null) {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' });
}

function compareDate(a?: string | null, b?: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return aTime - bTime;
}

export function ContractsList({
  contracts,
  loading,
  onView,
  onSend,
  onSign,
  onCancel,
  onDownload,
  onEditMessage,
  onEditTemplate,
}: ContractsListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedContracts = useMemo(() => {
    const list = [...contracts];
    list.sort((a, b) => {
      let result = 0;
      if (sortKey === 'number') result = compareText(a.contract_number, b.contract_number);
      else if (sortKey === 'client') result = compareText(a.lead?.name, b.lead?.name);
      else if (sortKey === 'template') result = compareText(a.template?.name, b.template?.name);
      else if (sortKey === 'status') {
        result = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
      } else if (sortKey === 'created') result = compareDate(a.created_at, b.created_at);
      else if (sortKey === 'expires') result = compareDate(a.expires_at, b.expires_at);
      else result = compareDate(a.signed_at, b.signed_at);
      return sortDir === 'asc' ? result : -result;
    });
    return list;
  }, [contracts, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedContracts.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [contracts, pageSize, sortKey, sortDir]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'created' || key === 'expires' || key === 'signed' ? 'desc' : 'asc');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border bg-white p-8">
        <p className="text-muted-foreground">Carregando contratos...</p>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white p-8 text-center">
        <FileSignature className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Nenhum contrato encontrado</p>
      </div>
    );
  }

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedContracts = sortedContracts.slice(startIndex, endIndex);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  );

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const headerButton = (label: string, column: SortKey, align: 'left' | 'center' = 'left') => (
    <button
      type="button"
      onClick={() => toggleSort(column)}
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800',
        align === 'center' && 'mx-auto'
      )}
    >
      {label}
      <SortIcon column={column} />
    </button>
  );

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50">
          <TableRow className="hover:bg-slate-50">
            <TableHead>{headerButton('Número', 'number')}</TableHead>
            <TableHead>{headerButton('Cliente', 'client')}</TableHead>
            <TableHead>{headerButton('Template', 'template')}</TableHead>
            <TableHead>{headerButton('Status', 'status')}</TableHead>
            <TableHead>{headerButton('Criação', 'created')}</TableHead>
            <TableHead>{headerButton('Vigência', 'expires')}</TableHead>
            <TableHead>{headerButton('Assinatura', 'signed')}</TableHead>
            <TableHead className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedContracts.map((contract) => (
            <ContractTableRow
              key={contract.id}
              contract={contract}
              onView={onView}
              onSend={onSend}
              onSign={onSign}
              onCancel={onCancel}
              onDownload={onDownload}
              onEditMessage={onEditMessage}
              onEditTemplate={onEditTemplate}
            />
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Mostrando {startIndex + 1} a {Math.min(endIndex, sortedContracts.length)} de {sortedContracts.length} contratos
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-200"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageNumbers.map((page, index) => {
              const previous = pageNumbers[index - 1];
              const showGap = previous && page - previous > 1;
              return (
                <span key={page} className="flex items-center gap-1">
                  {showGap ? <span className="px-1 text-slate-400">…</span> : null}
                  <Button
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="icon"
                    className={cn(
                      'h-8 w-8',
                      page === currentPage ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-200'
                    )}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                </span>
              );
            })}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-slate-200"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-600"
            aria-label="Contratos por página"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
