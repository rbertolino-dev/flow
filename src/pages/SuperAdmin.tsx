import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { SuperAdminDashboard } from "@/components/superadmin/SuperAdminDashboard";
import { useNavigate } from "react-router-dom";

export default function SuperAdmin() {
  const navigate = useNavigate();

  const handleViewChange = (view: "kanban" | "calls" | "contacts" | "settings" | "users" | "broadcast" | "whatsapp" | "superadmin" | "phonebook" | "workflows" | "agents") => {
    if (view === "users") {
      navigate('/users');
    } else if (view === "broadcast") {
      navigate('/broadcast');
    } else if (view === "whatsapp") {
      navigate('/whatsapp');
    } else if (view === "settings") {
      navigate('/settings');
    } else if (view === "phonebook") {
      navigate('/lista-telefonica');
    } else if (view === "superadmin") {
      // já estamos aqui
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="superadmin" onViewChange={handleViewChange}>
        <SuperAdminDashboard />
      </CRMLayout>
    </AuthGuard>
  );
}
