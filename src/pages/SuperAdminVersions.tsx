import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { VersionsDashboard } from "@/components/superadmin/VersionsDashboard";
import { useNavigate } from "react-router-dom";

export default function SuperAdminVersions() {
  const navigate = useNavigate();

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") {
      navigate('/broadcast');
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
        <VersionsDashboard />
      </CRMLayout>
    </AuthGuard>
  );
}







