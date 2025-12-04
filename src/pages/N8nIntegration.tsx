import N8nIntegration from "@/components/n8n/N8nIntegration";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function N8nIntegrationPage() {
  return (
    <AuthGuard>
      <N8nIntegration />
    </AuthGuard>
  );
}

