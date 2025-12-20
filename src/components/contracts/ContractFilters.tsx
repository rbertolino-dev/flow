import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleDropdown } from '@/components/ui/simple-dropdown';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Filter, X } from 'lucide-react';
import { useContractCategories } from '@/hooks/useContractCategories';
import { ContractStatus } from '@/types/contract';

interface ContractFiltersProps {
  status?: ContractStatus | 'all';
  categoryId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  expiresFrom?: string;
  expiresTo?: string;
  onFiltersChange: (filters: {
    status?: ContractStatus | 'all';
    categoryId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    expiresFrom?: string;
    expiresTo?: string;
  }) => void;
}

// Helper para validar se um ID é válido (não vazio, não null, não undefined)
const isValidId = (id: any): id is string => {
  return typeof id === 'string' && id.trim() !== '' && id !== 'null' && id !== 'undefined';
};

export function ContractFilters({
  status = 'all',
  categoryId,
  search = '',
  dateFrom,
  dateTo,
  expiresFrom,
  expiresTo,
  onFiltersChange,
}: ContractFiltersProps) {
  const { categories } = useContractCategories();
  const [isOpen, setIsOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    status,
    categoryId,
    search,
    dateFrom,
    dateTo,
    expiresFrom,
    expiresTo,
  });

  const hasActiveFilters =
    status !== 'all' ||
    !!categoryId ||
    !!dateFrom ||
    !!dateTo ||
    !!expiresFrom ||
    !!expiresTo;

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleClearFilters = () => {
    const cleared = {
      status: 'all' as const,
      categoryId: undefined,
      search: '',
      dateFrom: undefined,
      dateTo: undefined,
      expiresFrom: undefined,
      expiresTo: undefined,
    };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
    setIsOpen(false);
  };

  return (
    <div className="flex gap-2 items-center">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant={hasActiveFilters ? 'default' : 'outline'} size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtros Avançados
            {hasActiveFilters && (
              <span className="ml-2 bg-white/20 rounded-full px-1.5 py-0.5 text-xs">
                {[
                  status !== 'all' ? 1 : 0,
                  categoryId ? 1 : 0,
                  dateFrom || dateTo ? 1 : 0,
                  expiresFrom || expiresTo ? 1 : 0,
                ].reduce((a, b) => a + b, 0)}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Filtros Avançados</h3>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-8"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <SimpleDropdown
                  value={localFilters.status || 'all'}
                  onChange={(v) => setLocalFilters({ ...localFilters, status: v as any })}
                  options={[
                    { value: 'all', label: 'Todos os status' },
                    { value: 'draft', label: 'Rascunho' },
                    { value: 'sent', label: 'Enviado' },
                    { value: 'signed', label: 'Assinado' },
                    { value: 'expired', label: 'Expirado' },
                    { value: 'cancelled', label: 'Cancelado' },
                  ]}
                  placeholder="Todos os status"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <SimpleDropdown
                  value={
                    !localFilters.categoryId || 
                    localFilters.categoryId.trim() === '' || 
                    !isValidId(localFilters.categoryId)
                      ? 'all'
                      : localFilters.categoryId
                  }
                  onChange={(v) => {
                    if (isValidId(v) && v !== 'all') {
                      setLocalFilters({
                        ...localFilters,
                        categoryId: v,
                      });
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        categoryId: undefined,
                      });
                    }
                  }}
                  options={[
                    { value: 'all', label: 'Todas as categorias' },
                    ...categories
                      .filter((cat) => isValidId(cat.id))
                      .map((cat) => ({
                        value: cat.id!.trim(),
                        label: cat.name,
                      })),
                  ]}
                  placeholder="Todas as categorias"
                  searchable={true}
                />
              </div>

              <div className="space-y-2">
                <Label>Data de Criação</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Input
                      type="date"
                      value={localFilters.dateFrom || ''}
                      onChange={(e) =>
                        setLocalFilters({
                          ...localFilters,
                          dateFrom: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Input
                      type="date"
                      value={localFilters.dateTo || ''}
                      onChange={(e) =>
                        setLocalFilters({
                          ...localFilters,
                          dateTo: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Input
                      type="date"
                      value={localFilters.expiresFrom || ''}
                      onChange={(e) =>
                        setLocalFilters({
                          ...localFilters,
                          expiresFrom: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Input
                      type="date"
                      value={localFilters.expiresTo || ''}
                      onChange={(e) =>
                        setLocalFilters({
                          ...localFilters,
                          expiresTo: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleApplyFilters} className="flex-1">
                Aplicar Filtros
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}


