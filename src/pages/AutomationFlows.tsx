import { AutomationFlowsList } from "@/components/crm/AutomationFlowsList";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";

export default function AutomationFlows() {
  return (
    <AuthGuard>
      <CRMLayout activeView="kanban" onViewChange={() => {}}>
        <AutomationFlowsList />
      </CRMLayout>
    </AuthGuard>
  );
}

