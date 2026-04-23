import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { initializeRealtime } from "@/utils/realtimeInit";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Páginas críticas (Index=funil + Login) carregam eager para não ter spinner nas rotas mais usadas.
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Demais páginas: lazy-loaded — cada rota vira seu próprio chunk JS, carregado sob demanda.
// Reduz bundle inicial de ~4.7 MB para chunks pequenos por feature.
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const BroadcastCampaigns = lazy(() => import("./pages/BroadcastCampaigns"));
const BroadcastCampaigns2 = lazy(() => import("./pages/BroadcastCampaigns2"));
const PeriodicWorkflows = lazy(() => import("./pages/PeriodicWorkflows"));
const AuthLogs = lazy(() => import("./pages/AuthLogs"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Organization = lazy(() => import("./pages/Organization"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const SuperAdminCosts = lazy(() => import("./pages/SuperAdminCosts"));
const SuperAdminVersions = lazy(() => import("./pages/SuperAdminVersions"));
const AgentsDashboard = lazy(() => import("./pages/AgentsDashboard"));
const RLSDiagnostics = lazy(() => import("./pages/RLSDiagnostics"));
const NovaFuncao = lazy(() => import("./pages/NovaFuncao"));
const BubbleIntegration = lazy(() => import("./pages/BubbleIntegration"));
const N8nIntegration = lazy(() => import("./pages/N8nIntegration"));
const Calendar = lazy(() => import("./pages/Calendar"));
const CRM = lazy(() => import("./pages/CRM"));
const Gmail = lazy(() => import("./pages/Gmail"));
const FormBuilder = lazy(() => import("./pages/FormBuilder"));
const AutomationFlows = lazy(() => import("./pages/AutomationFlows"));
const GoogleBusinessPosts = lazy(() => import("./pages/GoogleBusinessPosts"));
const PostSale = lazy(() => import("./pages/PostSale"));
const AgilizeEmbed = lazy(() => import("./pages/AgilizeEmbed"));
const Assistant = lazy(() => import("./pages/Assistant"));
const ReconnectInstance = lazy(() => import("./pages/ReconnectInstance"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const MessagesCenter = lazy(() => import("./pages/MessagesCenter"));
const Contracts = lazy(() => import("./pages/Contracts"));
const ContractsNewSafe = lazy(() => import("./pages/ContractsNewSafe"));
const BudgetsModule = lazy(() => import("./pages/BudgetsModule"));
const SignContract = lazy(() => import("./pages/SignContract"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Employees = lazy(() => import("./pages/Employees"));
const PublicSurvey = lazy(() => import("./pages/PublicSurvey"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const DigitalContracts = lazy(() => import("./pages/DigitalContracts"));
const DigitalContractsNew = lazy(() => import("./pages/DigitalContractsNew"));
const DigitalContractView = lazy(() => import("./pages/DigitalContractView"));
const DigitalContractSign = lazy(() => import("./pages/DigitalContractSign"));
const LandingPageAdmin = lazy(() => import("./pages/LandingPageAdmin"));
const LandingPagePublic = lazy(() => import("./pages/LandingPagePublic"));

// QueryClient com cache apropriado — EVITA refetch a cada navegação entre páginas.
// Antes: staleTime=0 → TODA troca de rota refazia todas as queries do zero (~200-500ms por tela).
// Agora: staleTime 2min → dados frescos reaproveitados entre navegações; gcTime 10min.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 minutos
      gcTime: 10 * 60 * 1000,          // 10 minutos em cache
      refetchOnWindowFocus: false,     // evita burst de queries ao voltar a aba
      refetchOnMount: false,           // usa cache se estiver fresh
      retry: 1,                         // falhas de rede: 1 retry (não 3 = default)
    },
  },
});

// Spinner leve usado em transições de página (lazy chunks).
const PageSpinner = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => {
  // Realtime só após haver sessão — evita WebSocket/erros na landing e acelera primeiro ecrã
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRealtime = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!cancelled) {
          console.log("🚀 Aplicação carregada. Inicializando Realtime (utilizador autenticado)...");
          initializeRealtime();
        }
      }, 600);
    };

    const tryInitFromSession = (session: unknown) => {
      if (session) scheduleRealtime();
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      tryInitFromSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION")
      ) {
        tryInitFromSession(session);
      }
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Suspense fallback={<PageSpinner />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/broadcast" element={<BroadcastCampaigns />} />
                <Route path="/broadcast-2" element={<BroadcastCampaigns2 />} />
                <Route path="/workflows" element={<PeriodicWorkflows />} />
                <Route path="/auth-logs" element={<AuthLogs />} />
                <Route path="/diagnostics" element={<Diagnostics />} />
                <Route path="/organization" element={<Organization />} />
                <Route path="/superadmin" element={<SuperAdmin />} />
                <Route path="/superadmin/costs" element={<SuperAdminCosts />} />
                <Route path="/superadmin/versions" element={<SuperAdminVersions />} />
                <Route path="/rls-diagnostics" element={<RLSDiagnostics />} />
                <Route path="/lista-telefonica" element={<NovaFuncao />} />
                <Route path="/bubble" element={<BubbleIntegration />} />
                <Route path="/n8n" element={<N8nIntegration />} />
                <Route path="/agents" element={<AgentsDashboard />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/messages-center" element={<MessagesCenter />} />
                <Route path="/gmail" element={<Gmail />} />
                <Route path="/form-builder" element={<FormBuilder />} />
                <Route path="/automation-flows" element={<AutomationFlows />} />
                <Route path="/google-business-posts" element={<GoogleBusinessPosts />} />
                <Route path="/post-sale" element={<PostSale />} />
                <Route path="/agilize" element={<AgilizeEmbed />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/contracts" element={<Contracts />} />
                <Route path="/contracts/new-safe" element={<ContractsNewSafe />} />
                <Route path="/contracts/new-safe-v2" element={<ContractsNewSafe />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/budgets-module" element={<BudgetsModule />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/sign-contract/:contractId" element={<SignContract />} />
                <Route path="/sign-contract/:contractId/:token" element={<SignContract />} />
                <Route path="/contratos-digitais" element={<DigitalContracts />} />
                <Route path="/contratos-digitais/novo" element={<DigitalContractsNew />} />
                <Route path="/contratos-digitais/:id" element={<DigitalContractView />} />
                <Route path="/contratos-digitais/assinar/:contractId" element={<DigitalContractSign />} />
                <Route path="/contratos-digitais/assinar/:contractId/:token" element={<DigitalContractSign />} />
                <Route path="/reconnect/:notificationId" element={<ReconnectInstance />} />
                <Route path="/reconnect-instance/:instanceId" element={<ReconnectInstance />} />
                <Route path="/survey/:slug" element={<PublicSurvey />} />
                <Route path="/book/:organizationSlug" element={<PublicBooking />} />
                <Route path="/admin/landing-page" element={<LandingPageAdmin />} />
                <Route path="/p/:slug" element={<LandingPagePublic />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
