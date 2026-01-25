import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { LandingPageConfigurator } from "@/components/landing-page/LandingPageConfigurator";

export default function LandingPageAdmin() {
  const navigate = useNavigate();

  const handleViewChange = (view: CRMView) => {
    if (view === "settings") {
      navigate('/settings');
    } else if (view === "kanban") {
      navigate('/');
    } else {
      navigate('/');
    }
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="settings" onViewChange={handleViewChange}>
        <LandingPageConfigurator />
      </CRMLayout>
    </AuthGuard>
  );
}
