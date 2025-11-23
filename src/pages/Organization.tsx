import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { OrganizationSettings } from "@/components/crm/OrganizationSettings";

export default function Organization() {
  const handleViewChange = (view: "kanban" | "calls" | "settings" | "users" | "broadcast" | "agilizechat") => {
    if (view === "users") window.location.href = '/users';
    else if (view === "broadcast") window.location.href = '/broadcast';
    else if (view === "agilizechat") window.location.href = '/agilizechat';
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
