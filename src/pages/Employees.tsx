import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { EmployeesList } from "@/components/employees/EmployeesList";
import { PositionManager } from "@/components/employees/PositionManager";
import { TeamManager } from "@/components/employees/TeamManager";
import { EmployeesReports } from "@/components/employees/EmployeesReports";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/useEmployees";
import { usePositions } from "@/hooks/usePositions";
import { useTeams } from "@/hooks/useTeams";

export default function Employees() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<CRMView>("employees");
  const { fetchEmployees } = useEmployees();
  const { fetchPositions } = usePositions();
  const { fetchTeams } = useTeams();

  // Prefetch de dados ao montar o componente
  useEffect(() => {
    fetchEmployees(1);
    fetchPositions(false);
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthGuard>
      <CRMLayout activeView={activeView} onViewChange={setActiveView}>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold">Colaboradores</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie funcionários, cargos, salários e equipes
              </p>
            </div>
            <Tabs defaultValue="employees" className="space-y-4">
              <TabsList>
                <TabsTrigger value="employees">Funcionários</TabsTrigger>
                <TabsTrigger value="positions">Cargos</TabsTrigger>
                <TabsTrigger value="teams">Equipes</TabsTrigger>
                <TabsTrigger value="reports">Relatórios</TabsTrigger>
              </TabsList>
              <TabsContent value="employees">
                <EmployeesList />
              </TabsContent>
              <TabsContent value="positions">
                <PositionManager />
              </TabsContent>
              <TabsContent value="teams">
                <TeamManager />
              </TabsContent>
              <TabsContent value="reports">
                <EmployeesReports />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

