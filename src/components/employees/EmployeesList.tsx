import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEmployees, Employee } from "@/hooks/useEmployees";
import { usePositions } from "@/hooks/usePositions";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Trash2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { EmployeeForm } from "./EmployeeForm";
import { EmployeeDetails } from "./EmployeeDetails";
import { EmployeesSkeleton } from "./EmployeesSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function EmployeesList() {
  const { employees, loading, pagination, fetchEmployees, deleteEmployee } = useEmployees();
  const { positions } = usePositions();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
  const [employeeToView, setEmployeeToView] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Memoizar filtros para evitar re-renders desnecessários
  const memoizedFilters = useMemo(() => ({
    search: debouncedSearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    positionId: positionFilter !== "all" ? positionFilter : undefined,
  }), [debouncedSearch, statusFilter, positionFilter]);

  // Função memoizada para buscar funcionários
  const handleFetchEmployees = useCallback(() => {
    fetchEmployees(
      currentPage,
      memoizedFilters.search,
      memoizedFilters.status,
      memoizedFilters.positionId
    );
  }, [currentPage, memoizedFilters, fetchEmployees]);

  useEffect(() => {
    handleFetchEmployees();
  }, [handleFetchEmployees]);

  const handleCreate = () => {
    setEmployeeToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setEmployeeToEdit(employee);
    setIsFormOpen(true);
  };

  const handleView = (employee: Employee) => {
    setEmployeeToView(employee);
    setIsDetailsOpen(true);
  };

  const handleDelete = useCallback(async () => {
    if (!employeeToDelete) return;

    const success = await deleteEmployee(employeeToDelete.id);
    if (success) {
      setEmployeeToDelete(null);
      handleFetchEmployees();
    }
  }, [employeeToDelete, deleteEmployee, handleFetchEmployees]);

  // Memoizar funções de formatação
  const formatCPF = useCallback((cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  }, []);

  const formatPhone = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  }, []);

  const getStatusBadge = useCallback((status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      ativo: "default",
      inativo: "secondary",
      afastado: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Funcionários</CardTitle>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Funcionário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros e Busca */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
                <SelectItem value="afastado">Afastado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabela */}
          {loading ? (
            <EmployeesSkeleton />
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum funcionário encontrado
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Admissão</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                          {employee.full_name}
                        </TableCell>
                        <TableCell>{formatCPF(employee.cpf)}</TableCell>
                        <TableCell>
                          {employee.phone ? formatPhone(employee.phone) : "-"}
                        </TableCell>
                        <TableCell>
                          {employee.position_name || "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(employee.status)}</TableCell>
                        <TableCell>
                          {new Date(employee.admission_date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(employee)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(employee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEmployeeToDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * pagination.limit) + 1} a{" "}
                    {Math.min(currentPage * pagination.limit, pagination.total)} de{" "}
                    {pagination.total} funcionários
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <div className="text-sm">
                      Página {currentPage} de {pagination.totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Formulário */}
      <EmployeeForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        employee={employeeToEdit}
        onSuccess={() => {
          setIsFormOpen(false);
          handleFetchEmployees();
        }}
      />

      {/* Detalhes */}
      <EmployeeDetails
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        employee={employeeToView}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog
        open={!!employeeToDelete}
        onOpenChange={(open) => !open && setEmployeeToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar inativação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja inativar o funcionário{" "}
              <strong>{employeeToDelete?.full_name}</strong>? Esta ação pode ser revertida
              editando o funcionário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

