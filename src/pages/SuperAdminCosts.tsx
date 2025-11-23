import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { CostsDashboard } from "@/components/superadmin/CostsDashboard";
import { useNavigate } from "react-router-dom";

export default function SuperAdminCosts() {
  const navigate = useNavigate();

  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "agilizechat" | "superadmin" | "phonebook" | "workflows" | "agents" | "calendar") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "agilizechat") {
      navigate('/agilizechat');
    } else if (view === "settings") {
      navigate('/settings');
    } else if (view === "phonebook") {
      navigate('/lista-telefonica');
    } else if (view === "superadmin") {
      navigate('/superadmin');
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="superadmin" onViewChange={handleViewChange}>
        <CostsDashboard />
      </CRMLayout>
    </AuthGuard>
  );
}
