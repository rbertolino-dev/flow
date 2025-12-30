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
  const [employeeTeams, setEmployeeTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  useEffect(() => {
    if (open && initialEmployee) {
      setLoading(true);
      getEmployee(initialEmployee.id).then((emp) => {
        setEmployee(emp);
        setLoading(false);
      });

      // Buscar equipes do funcionário
      setLoadingTeams(true);
      fetchEmployeeTeams(initialEmployee.id).then((teams) => {
        setEmployeeTeams(teams);
        setLoadingTeams(false);
      }).catch(() => {
        setEmployeeTeams([]);
        setLoadingTeams(false);
      });
    } else {
      setEmployee(initialEmployee);
      setEmployeeTeams([]);
    }
  }, [open, initialEmployee, getEmployee]);

  const fetchEmployeeTeams = async (employeeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      
      // Buscar todas as equipes
      const teamsResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/teams`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!teamsResponse.ok) return [];

      const teamsData = await teamsResponse.json();
      const allTeams = teamsData.data || [];

      // Para cada equipe, verificar se o funcionário é membro
      const employeeTeamsList = [];
      for (const team of allTeams) {
        const membersResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/teams?action=members&team_id=${team.id}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          const members = membersData.data || [];
          const isMember = members.some((m: any) => m.employee_id === employeeId);
          
          if (isMember) {
            const memberInfo = members.find((m: any) => m.employee_id === employeeId);
            employeeTeamsList.push({
              ...team,
              joined_at: memberInfo?.joined_at,
              left_at: memberInfo?.left_at,
              is_active: memberInfo?.is_active,
            });
          }
        }
      }

      return employeeTeamsList;
    } catch (error) {
      console.error("Erro ao buscar equipes do funcionário:", error);
      return [];
    }
  };

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
              {loadingTeams ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : employeeTeams.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Funcionário não participa de nenhuma equipe
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Gerente</TableHead>
                        <TableHead>Data de Entrada</TableHead>
                        <TableHead>Data de Saída</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeTeams.map((team) => (
                        <TableRow key={team.id}>
                          <TableCell className="font-medium">{team.name}</TableCell>
                          <TableCell>{team.manager_name || "-"}</TableCell>
                          <TableCell>
                            {team.joined_at 
                              ? new Date(team.joined_at).toLocaleDateString("pt-BR")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {team.left_at 
                              ? new Date(team.left_at).toLocaleDateString("pt-BR")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={team.is_active ? "default" : "secondary"}>
                              {team.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

