import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { ChatInterface } from "@/components/assistant/ChatInterface";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Assistant() {
  const [organizationId, setOrganizationId] = useState<string | undefined>();

  useEffect(() => {
    const fetchOrganization = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: org } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (org) {
          setOrganizationId(org.organization_id);
        }
      }
    };

    fetchOrganization();
  }, []);

  return (
    <AuthGuard>
      <CRMLayout activeView="assistant" onViewChange={() => {}}>
        <div className="h-[calc(100vh-4rem)]">
          <ChatInterface organizationId={organizationId} />
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}

