import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { OrganizationSettings } from "@/components/crm/OrganizationSettings";

export default function Organization() {
  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") window.location.href = '/broadcast';
    else if (view === "settings") window.location.href = '/settings';
    else window.location.href = '/';
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="settings" onViewChange={handleViewChange}>
        <div className="container mx-auto p-6 max-w-5xl">
          <h1 className="text-3xl font-bold mb-6">Organização</h1>
          <OrganizationSettings />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
