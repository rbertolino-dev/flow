import { AuthGuard } from "@/components/auth/AuthGuard";
import { CRMLayout, CRMView } from "@/components/crm/CRMLayout";
import { AgilizeProdutosImportWizard } from "@/components/superadmin/agilize-produtos/ImportWizard";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldAlert } from "lucide-react";

export default function SuperAdminAgilizeProdutos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        setLoading(false);
        return;
      }
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const { data: isPubdigFn } = await supabase.rpc("is_pubdigital_user", {
        _user_id: user.id,
      });
      setAllowed(!!roleData || !!isPubdigFn);
      setLoading(false);
    };
    void check();
  }, []);

  const handleViewChange = (view: CRMView) => {
    if (view === "broadcast") navigate("/broadcast");
    else if (view === "settings") navigate("/settings");
    else if (view === "phonebook") navigate("/lista-telefonica");
    else if (view === "superadmin") navigate("/superadmin");
    else navigate("/");
  };

  return (
    <AuthGuard>
      <CRMLayout activeView="superadmin" onViewChange={handleViewChange}>
        <div className="h-full overflow-auto bg-background p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !allowed ? (
            <div className="flex justify-center p-6">
              <Alert variant="destructive" className="max-w-md">
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription>
                  <strong>Acesso Negado</strong>
                  <p className="mt-2">
                    Esta área é restrita a Super Administradores.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <AgilizeProdutosImportWizard />
          )}
        </div>
      </CRMLayout>
    </AuthGuard>
  );
}
