import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Employee } from "@/hooks/useEmployees";
import { useEmployees } from "@/hooks/useEmployees";
import { SalaryHistory } from "./SalaryHistory";
import { PositionHistory } from "./PositionHistory";
import { Loader2 } from "lucide-react";

interface EmployeeDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeeDetails({ open, onOpenChange, employee: initialEmployee }: EmployeeDetailsProps) {
  const { getEmployee } = useEmployees();
  const [employee, setEmployee] = useState<Employee | null>(initialEmployee);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && initialEmployee) {
      setLoading(true);
      getEmployee(initialEmployee.id).then((emp) => {
        setEmployee(emp);
        setLoading(false);
      });
    } else {
      setEmployee(initialEmployee);
    }
  }, [open, initialEmployee, getEmployee]);

  if (!employee) return null;

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return cpf;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    } else if (cleaned.length === 10) {
      return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return phone;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
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
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee.full_name}</DialogTitle>
          <DialogDescription>
            Detalhes completos do funcionário
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Dados Pessoais</TabsTrigger>
              <TabsTrigger value="salary">Histórico Salarial</TabsTrigger>
              <TabsTrigger value="position">Histórico de Cargos</TabsTrigger>
              <TabsTrigger value="teams">Equipes</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                  <p className="text-base font-medium">{employee.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CPF</label>
                  <p className="text-base">{formatCPF(employee.cpf)}</p>
                </div>
                {employee.rg && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">RG</label>
                    <p className="text-base">{employee.rg}</p>
                  </div>
                )}
                {employee.birth_date && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Nascimento</label>
                    <p className="text-base">
                      {new Date(employee.birth_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}
                {employee.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                    <p className="text-base">{formatPhone(employee.phone)}</p>
                  </div>
                )}
                {employee.email && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-base">{employee.email}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(employee.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cargo Atual</label>
                  <p className="text-base">{employee.position_name || "-"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Data de Admissão</label>
                  <p className="text-base">
                    {new Date(employee.admission_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {employee.dismissal_date && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data de Demissão</label>
                    <p className="text-base">
                      {new Date(employee.dismissal_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                )}
              </div>

              {(employee.address || employee.city || employee.state || employee.zip_code) && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Endereço</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {employee.address && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                        <p className="text-base">{employee.address}</p>
                      </div>
                    )}
                    {employee.city && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Cidade</label>
                        <p className="text-base">{employee.city}</p>
                      </div>
                    )}
                    {employee.state && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Estado</label>
                        <p className="text-base">{employee.state}</p>
                      </div>
                    )}
                    {employee.zip_code && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">CEP</label>
                        <p className="text-base">{employee.zip_code}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(employee.bank_name || employee.bank_agency || employee.bank_account) && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Dados Bancários</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {employee.bank_name && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Banco</label>
                        <p className="text-base">{employee.bank_name}</p>
                      </div>
                    )}
                    {employee.bank_agency && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Agência</label>
                        <p className="text-base">{employee.bank_agency}</p>
                      </div>
                    )}
                    {employee.bank_account && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Conta</label>
                        <p className="text-base">{employee.bank_account}</p>
                      </div>
                    )}
                    {employee.account_type && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Tipo de Conta</label>
                        <p className="text-base">
                          {employee.account_type === "corrente" ? "Corrente" : "Poupança"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="salary">
              <SalaryHistory employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="position">
              <PositionHistory employeeId={employee.id} />
            </TabsContent>

            <TabsContent value="teams">
              <div className="text-center py-8 text-muted-foreground">
                Funcionalidade de equipes em desenvolvimento
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

