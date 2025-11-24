import { CRMLayout } from "@/components/crm/CRMLayout";
import { GmailPortal } from "@/components/gmail/GmailPortal";

export default function Gmail() {
  return (
    <CRMLayout activeView="crm" onViewChange={() => {}}>
      <GmailPortal />
    </CRMLayout>
  );
}

