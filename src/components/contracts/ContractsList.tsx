import { useState } from 'react';
import { Table, TableBody, TableHead, TableHeader } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Contract } from '@/types/contract';
import { FileSignature, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContractTableRow } from './ContractTableRow';

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

const ITEMS_PER_PAGE = 25;

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

  // Calcular paginação
  const totalPages = Math.ceil(contracts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedContracts = contracts.slice(startIndex, endIndex);

  // Resetar página se necessário
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criação</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </tr>
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
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1} a {Math.min(endIndex, contracts.length)} de {contracts.length} contratos
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
