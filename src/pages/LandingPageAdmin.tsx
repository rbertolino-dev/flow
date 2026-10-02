import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { LandingPageConfigurator } from "@/components/landing-page/LandingPageConfigurator";
import { useOrganizationFeatures } from "@/hooks/useOrganizationFeatures";
import { Loader2 } from "lucide-react";

export default function LandingPageAdmin() {
  const navigate = useNavigate();
  const { hasFeature, loading: featuresLoading } = useOrganizationFeatures();

  const handleViewChange = (view: CRMView) => {
    if (view === "settings") {
      navigate("/settings");
    } else if (view === "kanban") {
      navigate("/");
    } else {
      navigate("/");
    }
  };

  const blocked = !featuresLoading && !hasFeature("landing_page");

  return (
    <AuthGuard>
      <CRMLayout activeView="landing-page" onViewChange={handleViewChange}>
        {featuresLoading ? (
          <div className="flex items-center justify-center min-h-[240px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : blocked ? (
          <div className="p-6 text-center text-muted-foreground">
            A landing page não está habilitada para esta organização.
          </div>
        ) : (
          <LandingPageConfigurator />
        )}
      </CRMLayout>
    </AuthGuard>
  );
}
