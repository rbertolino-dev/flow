import { useState } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { StockModule } from "@/components/stock/StockModule";

export default function Estoque() {
  const [activeView, setActiveView] = useState<CRMView>("estoque");

  return (
    <AuthGuard>
      <CRMLayout activeView={activeView} onViewChange={setActiveView}>
        <StockModule />
      </CRMLayout>
    </AuthGuard>
  );
}
