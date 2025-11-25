import { AutomationFlowsList } from "@/components/crm/AutomationFlowsList";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AutomationFlows() {
  return (
    <AuthGuard>
      <AutomationFlowsList />
    </AuthGuard>
  );
}

